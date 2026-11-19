import { randomUUID } from "crypto"
import { Worker } from "worker_threads"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "../db/index"
import { file as fileTable, model3d } from "../db/schema"
import type { Optimized, OptimizeReply } from "./glb-optimize.worker"
import { HttpError } from "./http"
import { deleteObject, readObject, writeObject } from "./storage"
import { type FileRow, type Tx } from "./uploads"

//THE OPTIMIZED COPIES OF A STORED GLB, shared by the model routes and
//scripts/optimize-models.ts. Each copy is a new file row and new bytes next to
//the source in the bucket; the original row and bytes stay, the model keeps them
//in source_glb_file_id. The phone copy (phone_glb_file_id) is what touch
//devices load: the same model with smaller textures. A model whose textures
//already fit a phone has one copy for both.

export type ModelRow = typeof model3d.$inferSelect

//one optimization at a time, each in its own worker: a big GLB holds a core
//and several times its size in memory for minutes
const OPTIMIZE_TIMEOUT_MS = 5 * 60 * 1000
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  //the caller gets the outcome from `run`; the queue only waits for it to settle
  queue = run.then(() => undefined, () => undefined)
  return run
}

function optimizeInWorker(name: string, input: Uint8Array): Promise<Optimized> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./glb-optimize.worker.ts", import.meta.url))
    //terminate() fires "exit" after the answer: only the first event counts
    let settled = false
    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      settle()
    }
    const timer = setTimeout(() => finish(() => reject(new HttpError(504,
      `optimizing ${name} took longer than ${OPTIMIZE_TIMEOUT_MS / 60000} min and was stopped`))), OPTIMIZE_TIMEOUT_MS)
    worker.once("message", (reply: OptimizeReply) => finish(() => {
      if ("error" in reply) reject(new Error(reply.error))
      else resolve(reply)
    }))
    worker.once("messageerror", (e) => finish(() => reject(new Error(`the optimizer's answer for ${name} could not be read: ${e}`))))
    worker.once("error", (e) => finish(() => reject(e)))
    worker.once("exit", (code) => finish(() => reject(new Error(`the optimizer stopped (exit ${code}) before answering for ${name}`))))
    //the bytes move to the worker, they are not copied
    worker.postMessage(input, [input.buffer as ArrayBuffer])
  })
}

export function isGlb(file: FileRow): boolean {
  return /\.glb$/i.test(file.storedFilename)
}

export async function optimizeStoredGlb(source: FileRow): Promise<Optimized> {
  if (!isGlb(source)) {
    throw new HttpError(422, `only a .glb can be optimized, ${source.originalFilename} is not one`)
  }
  return enqueue(async () => optimizeInWorker(source.originalFilename, new Uint8Array(await readObject(source.storedFilename))))
}

//one copy to store: its bytes, and the word its file name carries
export interface GlbCopy {
  bytes: Uint8Array
  label: "optimized" | "phone"
}

export function optimizedCopies(optimized: Optimized): GlbCopy[] {
  const copies: GlbCopy[] = [{ bytes: optimized.output, label: "optimized" }]
  if (optimized.phone) copies.push({ bytes: optimized.phone, label: "phone" })
  return copies
}

//Writes the bytes, then the file rows and whatever `link` writes, in one
//transaction. A failure removes the bytes: no row points at them. The rows
//come in the order of the copies.
export async function saveGlbCopies(
  source: FileRow,
  copies: GlbCopy[],
  link: (tx: Tx, rows: FileRow[]) => Promise<void>,
): Promise<FileRow[]> {
  //next to their source: same project folder
  const folder = source.storedFilename.slice(0, source.storedFilename.lastIndexOf("/"))
  const name = source.originalFilename.replace(/\.glb$/i, "")
  const files = copies.map((copy) => {
    const id = randomUUID()
    return { ...copy, id, stored: `${folder}/${id}.glb` }
  })
  const written: string[] = []
  try {
    for (const f of files) {
      await writeObject(f.stored, f.bytes)
      written.push(f.stored)
    }
    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(fileTable).values(files.map((f) => ({
        id:               f.id,
        originalFilename: `${name}.${f.label}.glb`,
        storedFilename:   f.stored,
        mimeType:         "model/gltf-binary",
        sizeBytes:        f.bytes.byteLength,
        kind:             source.kind,
        uploadedBy:       source.uploadedBy,
        mainProjectId:    source.mainProjectId,
      }))).returning()
      const rows = files.map((f) => inserted.find((row) => row.id === f.id)!)
      await link(tx, rows)
      return rows
    })
  } catch (e) {
    for (const stored of written) await deleteObject(stored)
    throw e
  }
}

export async function fileRow(id: string): Promise<FileRow> {
  const [row] = await db.select().from(fileTable).where(eq(fileTable.id, id))
  if (!row) throw new HttpError(400, `file ${id} does not exist`)
  return row
}

//the file a model may point at: a stored .glb, nothing else
export async function glbFileRow(id: string): Promise<FileRow> {
  const row = await fileRow(id)
  if (!isGlb(row)) throw new HttpError(400, `a model needs a .glb file, ${row.originalFilename} is not one`)
  return row
}

//An existing model: its GLB becomes the optimized copy, the original moves to
//source_glb_file_id. A model optimized already is refused, also when another
//request optimized it while this one was running: its bytes are removed.
export async function optimizeModel(model: ModelRow): Promise<{ report: Optimized["report"]; file: FileRow }> {
  if (model.sourceGlbFileId) throw new HttpError(409, "this model is already optimized")
  const source = await fileRow(model.glbFileId)
  const optimized = await optimizeStoredGlb(source)
  const [file] = await saveGlbCopies(source, optimizedCopies(optimized), async (tx, [full, phone = full]) => {
    const updated = await tx.update(model3d)
      .set({ glbFileId: full!.id, sourceGlbFileId: source.id, phoneGlbFileId: phone!.id, updatedAt: new Date() })
      .where(and(eq(model3d.id, model.id), isNull(model3d.sourceGlbFileId)))
      .returning({ id: model3d.id })
    if (updated.length === 0) throw new HttpError(409, "this model was optimized or deleted while this request ran")
  })
  return { report: optimized.report, file: file! }
}

//A model optimized before phones had their own copy: the copy is made now,
//from the source. Refused when the model changed while this ran.
export async function addPhoneCopy(model: ModelRow): Promise<FileRow> {
  if (!model.sourceGlbFileId) throw new HttpError(409, "this model is not optimized yet")
  if (model.phoneGlbFileId) throw new HttpError(409, "this model already has its phone copy")
  const source = await fileRow(model.sourceGlbFileId)
  const { phone } = await optimizeStoredGlb(source)
  const point = async (tx: Tx | typeof db, fileId: string) => {
    const updated = await tx.update(model3d)
      .set({ phoneGlbFileId: fileId, updatedAt: new Date() })
      .where(and(eq(model3d.id, model.id), eq(model3d.glbFileId, model.glbFileId), isNull(model3d.phoneGlbFileId)))
      .returning({ id: model3d.id })
    if (updated.length === 0) throw new HttpError(409, "this model changed while its phone copy was made")
  }
  //its textures already fit a phone: one copy for both
  if (!phone) {
    await point(db, model.glbFileId)
    return fileRow(model.glbFileId)
  }
  const [row] = await saveGlbCopies(source, [{ bytes: phone, label: "phone" }], (tx, [copy]) => point(tx, copy!.id))
  return row!
}

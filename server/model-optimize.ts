import { randomUUID } from "crypto"
import { Worker } from "worker_threads"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "../db/index"
import { file as fileTable, model3d } from "../db/schema"
import type { OptimizeReport } from "./glb-optimize"
import type { OptimizeReply } from "./glb-optimize.worker"
import { HttpError } from "./http"
import { deleteObject, readObject, writeObject } from "./storage"
import { type FileRow, type Tx } from "./uploads"

//THE OPTIMIZED COPY OF A STORED GLB, shared by the model routes and
//scripts/optimize-models.ts. The copy is a new file row and new bytes next to
//the source in the bucket; the original row and bytes stay, the model keeps them
//in source_glb_file_id.

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

function optimizeInWorker(name: string, input: Uint8Array): Promise<{ output: Uint8Array; report: OptimizeReport }> {
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

export async function optimizeStoredGlb(source: FileRow): Promise<{ output: Uint8Array; report: OptimizeReport }> {
  if (!isGlb(source)) {
    throw new HttpError(422, `only a .glb can be optimized, ${source.originalFilename} is not one`)
  }
  return enqueue(async () => optimizeInWorker(source.originalFilename, new Uint8Array(await readObject(source.storedFilename))))
}

//Writes the bytes, then the file row and whatever `link` writes, in one
//transaction. A failure removes the bytes: no row points at them.
export async function saveOptimizedGlb(
  source: FileRow,
  output: Uint8Array,
  link: (tx: Tx, optimized: FileRow) => Promise<void>,
): Promise<FileRow> {
  const id = randomUUID()
  //next to its source: same project folder
  const stored = `${source.storedFilename.slice(0, source.storedFilename.lastIndexOf("/"))}/${id}.glb`
  await writeObject(stored, output)
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(fileTable).values({
        id,
        originalFilename: source.originalFilename.replace(/\.glb$/i, "") + ".optimized.glb",
        storedFilename:   stored,
        mimeType:         "model/gltf-binary",
        sizeBytes:        output.byteLength,
        kind:             source.kind,
        uploadedBy:       source.uploadedBy,
        mainProjectId:    source.mainProjectId,
      }).returning()
      await link(tx, row!)
      return row!
    })
  } catch (e) {
    await deleteObject(stored)
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
export async function optimizeModel(model: ModelRow): Promise<{ report: OptimizeReport; file: FileRow }> {
  if (model.sourceGlbFileId) throw new HttpError(409, "this model is already optimized")
  const source = await fileRow(model.glbFileId)
  const { output, report } = await optimizeStoredGlb(source)
  const file = await saveOptimizedGlb(source, output, async (tx, optimized) => {
    const updated = await tx.update(model3d)
      .set({ glbFileId: optimized.id, sourceGlbFileId: source.id, updatedAt: new Date() })
      .where(and(eq(model3d.id, model.id), isNull(model3d.sourceGlbFileId)))
      .returning({ id: model3d.id })
    if (updated.length === 0) throw new HttpError(409, "this model was optimized or deleted while this request ran")
  })
  return { report, file }
}

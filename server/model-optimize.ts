import { randomUUID } from "crypto"
import { readFileSync, unlinkSync, writeFileSync } from "fs"
import { join } from "path"
import { eq } from "drizzle-orm"
import { db } from "../db/index"
import { file as fileTable, model3d } from "../db/schema"
import { optimizeGlb, type OptimizeReport } from "./glb-optimize"
import { HttpError } from "./http"
import { type FileRow, STORAGE_DIR, type Tx } from "./uploads"

//THE OPTIMIZED COPY OF A STORED GLB, shared by the model routes and
//scripts/optimize-models.ts. The copy is a new file row and new bytes under
//storage/files/models; the original row and bytes stay, the model keeps them
//in source_glb_file_id.

export type ModelRow = typeof model3d.$inferSelect

export async function optimizeStoredGlb(source: FileRow): Promise<{ output: Uint8Array; report: OptimizeReport }> {
  if (!/\.glb$/i.test(source.storedFilename)) {
    throw new HttpError(422, `only a .glb can be optimized, ${source.originalFilename} is not one`)
  }
  const input = new Uint8Array(readFileSync(join(STORAGE_DIR, source.storedFilename)))
  return optimizeGlb(input)
}

//Writes the bytes, then the file row and whatever `link` writes, in one
//transaction. A failure removes the bytes: no row points at them.
export async function saveOptimizedGlb(
  source: FileRow,
  output: Uint8Array,
  link: (tx: Tx, optimized: FileRow) => Promise<void>,
): Promise<FileRow> {
  const id = randomUUID()
  const stored = `models/${id}.glb`
  writeFileSync(join(STORAGE_DIR, stored), output)
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
      }).returning()
      await link(tx, row!)
      return row!
    })
  } catch (e) {
    unlinkSync(join(STORAGE_DIR, stored))
    throw e
  }
}

export async function fileRow(id: string): Promise<FileRow> {
  const [row] = await db.select().from(fileTable).where(eq(fileTable.id, id))
  if (!row) throw new HttpError(400, `file ${id} does not exist`)
  return row
}

//An existing model: its GLB becomes the optimized copy, the original moves to
//source_glb_file_id. A model optimized already is refused.
export async function optimizeModel(model: ModelRow): Promise<{ report: OptimizeReport; file: FileRow }> {
  if (model.sourceGlbFileId) throw new HttpError(409, "this model is already optimized")
  const source = await fileRow(model.glbFileId)
  const { output, report } = await optimizeStoredGlb(source)
  const file = await saveOptimizedGlb(source, output, async (tx, optimized) => {
    await tx.update(model3d)
      .set({ glbFileId: optimized.id, sourceGlbFileId: source.id, updatedAt: new Date() })
      .where(eq(model3d.id, model.id))
  })
  return { report, file }
}

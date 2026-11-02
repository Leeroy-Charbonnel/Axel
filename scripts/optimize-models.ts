#!/usr/bin/env bun
//OPTIMIZE EVERY 3D MODEL IN THE DATABASE DATABASE_URL POINTS AT.
//
//For each model_3d row not optimized yet (source_glb_file_id empty): reads its
//GLB from storage/files, writes the optimized copy as a new file row and file
//under storage/files/models, points glb_file_id at it, and keeps the original
//in source_glb_file_id. Nothing is deleted. A row already optimized is skipped.
//
//Usage: bun scripts/optimize-models.ts

import { randomUUID } from "crypto"
import { readFileSync, unlinkSync, writeFileSync } from "fs"
import { join } from "path"
import { eq, isNull } from "drizzle-orm"
import { db } from "../db/index"
import { file as fileTable, model3d } from "../db/schema"
import { optimizeGlb } from "../server/glb-optimize"
import { STORAGE_DIR } from "../server/uploads"

const mb = (bytes: number) => (bytes / 1048576).toFixed(1)

async function optimizeModel(model: typeof model3d.$inferSelect): Promise<void> {
  const [source] = await db.select().from(fileTable).where(eq(fileTable.id, model.glbFileId))
  if (!source) throw new Error(`glb file ${model.glbFileId} has no row`)
  const input = new Uint8Array(readFileSync(join(STORAGE_DIR, source.storedFilename)))
  const { output, report } = await optimizeGlb(input)

  const id = randomUUID()
  const stored = `models/${id}.glb`
  writeFileSync(join(STORAGE_DIR, stored), output)
  try {
    await db.transaction(async (tx) => {
      await tx.insert(fileTable).values({
        id,
        originalFilename: source.originalFilename.replace(/\.glb$/i, "") + ".optimized.glb",
        storedFilename:   stored,
        mimeType:         "model/gltf-binary",
        sizeBytes:        output.byteLength,
        kind:             source.kind,
        uploadedBy:       source.uploadedBy,
      })
      await tx.update(model3d)
        .set({ glbFileId: id, sourceGlbFileId: source.id, updatedAt: new Date() })
        .where(eq(model3d.id, model.id))
    })
  } catch (e) {
    //no row points at the bytes yet
    unlinkSync(join(STORAGE_DIR, stored))
    throw e
  }
  console.log(`${model.name}: ${mb(report.bytesBefore)} MB -> ${mb(report.bytesAfter)} MB, ${report.triangles} triangles, ${report.textures} textures -> ${stored}`)
}

async function main() {
  const all = await db.select().from(model3d)
  const pending = await db.select().from(model3d).where(isNull(model3d.sourceGlbFileId))
  console.log(`${all.length} model(s), ${all.length - pending.length} already optimized, ${pending.length} to do`)
  let failed = 0
  for (const model of pending) {
    try {
      await optimizeModel(model)
    } catch (e) {
      failed++
      console.error(`${model.name} (${model.id}) FAILED:`, e)
    }
  }
  if (failed > 0) throw new Error(`${failed} model(s) could not be optimized`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

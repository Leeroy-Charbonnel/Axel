#!/usr/bin/env bun
//OPTIMIZE EVERY 3D MODEL IN THE DATABASE DATABASE_URL POINTS AT.
//
//For each model_3d row not optimized yet (source_glb_file_id empty): reads its
//GLB from the storage bucket, writes the optimized copy as a new file row and
//file under models/ in the bucket, points glb_file_id at it, and keeps the original
//in source_glb_file_id. Nothing is deleted. A row already optimized is skipped.
//
//Usage: bun scripts/optimize-models.ts

import { isNull } from "drizzle-orm"
import { db } from "../db/index"
import { model3d } from "../db/schema"
import { optimizeModel } from "../server/model-optimize"

const mb = (bytes: number) => (bytes / 1048576).toFixed(1)

async function main() {
  const all = await db.select().from(model3d)
  const pending = await db.select().from(model3d).where(isNull(model3d.sourceGlbFileId))
  console.log(`${all.length} model(s), ${all.length - pending.length} already optimized, ${pending.length} to do`)
  let failed = 0
  for (const model of pending) {
    try {
      const { report, file } = await optimizeModel(model)
      console.log(`${model.name}: ${mb(report.bytesBefore)} MB -> ${mb(report.bytesAfter)} MB, ${report.triangles} triangles, ${report.textures} textures -> ${file.storedFilename}`)
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

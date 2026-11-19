import { Router, type RequestHandler } from "express"
import { asc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index"
import { file as fileTable, mainProject, model3d } from "../../db/schema"
import { notFound, parse, parsePatch, requireAdmin, uuidParam } from "../http"
import { glbFileRow, optimizedCopies, optimizeModel, optimizeStoredGlb, saveGlbCopies, type ModelRow } from "../model-optimize"
import { modelCreate, modelPatch, viewerSettingsBody } from "../validation"

//MODEL_3D - reusable 3D assets, admin only. The files (.glb, thumbnail) are
//uploaded first through POST /api/files; these routes handle the row.

async function mediaUrlFor(fileId: string | null): Promise<string | null> {
  if (!fileId) return null
  const [f] = await db.select({ storedFilename: fileTable.storedFilename }).from(fileTable).where(eq(fileTable.id, fileId))
  return f ? `/media/${f.storedFilename}` : null
}

//where a model is used: main_project.model_3d_id and viewer3d detail blocks
async function findModelUsages(modelId: string): Promise<Array<{ projectId: number; kind: "main" | "block"; blockId?: string }>> {
  const direct = await db.select({ id: mainProject.id }).from(mainProject).where(eq(mainProject.model3dId, modelId))
  const blocks = await db.execute<{ project_id: number; block_id: string }>(sql`
    SELECT mp.id AS project_id, blk->>'id' AS block_id
    FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') AS blk
    WHERE blk->>'type' = 'viewer3d' AND blk->'content'->>'model3dId' = ${modelId}
  `)
  return [
    ...direct.map((r) => ({ projectId: r.id, kind: "main" as const })),
    ...blocks.map((r) => ({ projectId: r.project_id, kind: "block" as const, blockId: r.block_id })),
  ]
}

//PUT /api/models/:id/viewer-settings replaces the editor snapshot. The only
//route allowed a large body: server.ts mounts it with its own 10mb parser,
//before the small global one.
export const putViewerSettings: RequestHandler = async (req, res) => {
  const id = uuidParam(req, "id")
  const [row] = await db.update(model3d)
    .set({ viewerSettings: parse(viewerSettingsBody, req.body), updatedAt: new Date() })
    .where(eq(model3d.id, id))
    .returning({ id: model3d.id })
  if (!row) notFound()
  res.json({ ok: true })
}

export const modelsRouter = Router()

modelsRouter.get("/api/models", requireAdmin, async (_req, res) => {
  res.json(await db.select().from(model3d).orderBy(asc(model3d.name), asc(model3d.id)))
})

//the model editor (/edit-3d/:id) loads this, urls resolved for the viewer
modelsRouter.get("/api/models/:id", requireAdmin, async (req, res) => {
  const [row] = await db.select().from(model3d).where(eq(model3d.id, uuidParam(req, "id")))
  if (!row) notFound()
  res.json({ ...row, glbUrl: await mediaUrlFor(row.glbFileId), thumbnailUrl: await mediaUrlFor(row.thumbnailFileId) })
})

//The GLB is optimized on the way in: the model points at the optimized copy
//and at the phone copy, and keeps the upload in source_glb_file_id. When the
//optimizer refuses the file the model is created on the upload as it is, and
//the answer says why.
modelsRouter.post("/api/models", requireAdmin, async (req, res) => {
  const body = parse(modelCreate, req.body)
  const values = {
    name:            body.name,
    thumbnailFileId: body.thumbnailFileId ?? null,
    views:           body.views ?? [],
  }
  const source = await glbFileRow(body.glbFileId)
  let optimized: Awaited<ReturnType<typeof optimizeStoredGlb>> | null = null
  let optimizeError: string | null = null
  try {
    optimized = await optimizeStoredGlb(source)
  } catch (e) {
    optimizeError = e instanceof Error ? e.message : String(e)
    console.error(`[models] optimizing ${source.originalFilename} failed, the model keeps the upload:`, e)
  }
  let row: ModelRow
  if (optimized) {
    let inserted: ModelRow | undefined
    await saveGlbCopies(source, optimizedCopies(optimized), async (tx, [full, phone = full]) => {
      [inserted] = await tx.insert(model3d)
        .values({ ...values, glbFileId: full!.id, sourceGlbFileId: source.id, phoneGlbFileId: phone!.id })
        .returning()
    })
    row = inserted!
  } else {
    [row] = await db.insert(model3d).values({ ...values, glbFileId: source.id }).returning() as [ModelRow]
  }
  res.status(201).json({ ...row, optimizeReport: optimized?.report ?? null, optimizeError })
})

//the editor's Optimise action, for a model created before the optimizer
modelsRouter.post("/api/models/:id/optimize", requireAdmin, async (req, res) => {
  const [model] = await db.select().from(model3d).where(eq(model3d.id, uuidParam(req, "id")))
  if (!model) notFound()
  const { report, file } = await optimizeModel(model)
  res.json({ report, glbUrl: `/media/${file.storedFilename}`, sourceGlbFileId: model.glbFileId })
})

//patches only the fields sent: the Views tab must not clobber the GLB, etc.
modelsRouter.put("/api/models/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const patch = parsePatch(modelPatch, req.body)
  if (patch.glbFileId) await glbFileRow(patch.glbFileId)
  //a new file: the phone copy was made from the old one
  const phone = patch.glbFileId ? { phoneGlbFileId: null } : {}
  const [row] = await db.update(model3d)
    .set({ ...patch, ...phone, updatedAt: new Date() })
    .where(eq(model3d.id, id))
    .returning({ id: model3d.id })
  if (!row) notFound()
  res.json({ ok: true })
})

//409 with the usages while a project or a viewer3d block still uses it
modelsRouter.delete("/api/models/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const usages = await findModelUsages(id)
  if (usages.length > 0) {
    res.status(409).json({ error: "model in use", usages })
    return
  }
  await db.delete(model3d).where(eq(model3d.id, id))
  res.json({ ok: true })
})

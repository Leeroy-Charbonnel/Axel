import { Router, type RequestHandler } from "express"
import { asc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index"
import { file as fileTable, mainProject, model3d } from "../../db/schema"
import { notFound, parse, parsePatch, requireAdmin, uuidParam } from "../http"
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

modelsRouter.post("/api/models", requireAdmin, async (req, res) => {
  const body = parse(modelCreate, req.body)
  const [row] = await db.insert(model3d).values({
    name:            body.name,
    glbFileId:       body.glbFileId,
    thumbnailFileId: body.thumbnailFileId ?? null,
    views:           body.views ?? [],
  }).returning()
  res.status(201).json(row)
})

//patches only the fields sent: the Views tab must not clobber the GLB, etc.
modelsRouter.put("/api/models/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const [row] = await db.update(model3d)
    .set({ ...parsePatch(modelPatch, req.body), updatedAt: new Date() })
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

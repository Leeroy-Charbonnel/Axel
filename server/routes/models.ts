import { randomUUID } from "crypto"
import { Router, type RequestHandler } from "express"
import { asc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index"
import { file as fileTable, mainProject, model3d } from "../../db/schema"
import { MODEL_THUMB } from "../../src/lib/media"
import { adminId, HttpError, notFound, parse, parsePatch, requireAdmin, uuidParam } from "../http"
import { fileRow, glbFileRow, optimizedCopies, optimizeModel, optimizeStoredGlb, saveGlbCopies, type ModelRow } from "../model-optimize"
import { deleteObject, writeObject } from "../storage"
import { encodePicture, pictureBody, receivedPicture } from "../picture"
import { MODEL_THUMB_KIND } from "../thumbs"
import { folderFor, type Tx } from "../uploads"
import { modelCreate, modelPatch, viewerSettingsBody } from "../validation"
import { deleteStoredFile, fileRefCountSql } from "./files"

//MODEL_3D - reusable 3D assets, admin only. The .glb is uploaded first
//through POST /api/files; these routes handle the row.
//
//THE MODEL'S PICTURE (thumbnail_file_id) is a render of the model from its
//start view, made by the admin's browser and stored as a file of kind
//MODEL_THUMB_KIND, which the library does not list. It shows one look: a
//write that changes the look removes it, and the next admin screen that
//shows the model renders it again.

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

//A render nothing else uses goes with its row; an image picked by hand stays
//in the library. Answers the stored name to remove after the transaction.
async function deleteRender(tx: Tx, fileId: string): Promise<string | null> {
  const [gone] = await tx.execute<{ stored_filename: string }>(sql`
    DELETE FROM file f
    WHERE f.id = ${fileId}::uuid AND f.kind = ${MODEL_THUMB_KIND} AND ${fileRefCountSql(sql.raw("f.id"))} = 0
    RETURNING f.stored_filename
  `)
  return gone?.stored_filename ?? null
}

//Inside the transaction that changes the model's look, or deletes it: the
//model loses its picture. The row stays locked until the transaction ends.
async function dropPicture(tx: Tx, modelId: string): Promise<string | null> {
  const [model] = await tx.select({ fileId: model3d.thumbnailFileId }).from(model3d).where(eq(model3d.id, modelId)).for("update")
  if (!model?.fileId) return null
  await tx.update(model3d).set({ thumbnailFileId: null }).where(eq(model3d.id, modelId))
  return deleteRender(tx, model.fileId)
}

//PUT /api/models/:id/viewer-settings replaces the editor snapshot. The only
//route allowed a large body: server.ts mounts it with its own 10mb parser,
//before the small global one.
export const putViewerSettings: RequestHandler = async (req, res) => {
  const id = uuidParam(req, "id")
  const viewerSettings = parse(viewerSettingsBody, req.body)
  const stale = await db.transaction(async (tx) => {
    const picture = await dropPicture(tx, id)
    const [row] = await tx.update(model3d)
      .set({ viewerSettings, updatedAt: new Date() })
      .where(eq(model3d.id, id))
      .returning({ id: model3d.id })
    if (!row) notFound()
    return picture
  })
  if (stale) await deleteStoredFile(stale)
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
  const values = { name: body.name, views: body.views ?? [] }
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
  //a new file: the phone copy and the picture were made from the old one
  const phone = patch.glbFileId ? { phoneGlbFileId: null } : {}
  const stale = await db.transaction(async (tx) => {
    const picture = patch.glbFileId ? await dropPicture(tx, id) : null
    const [row] = await tx.update(model3d)
      .set({ ...patch, ...phone, updatedAt: new Date() })
      .where(eq(model3d.id, id))
      .returning({ id: model3d.id })
    if (!row) notFound()
    return picture
  })
  if (stale) await deleteStoredFile(stale)
  res.json({ ok: true })
})

//THE MODEL'S PICTURE, rendered by the admin's browser: the body is the
//picture, ?rev= the updatedAt of the model it was rendered from. 409 when the
//model changed since: that picture shows a look that is gone.
modelsRouter.put("/api/models/:id/thumbnail", requireAdmin, pictureBody, async (req, res) => {
  const id = uuidParam(req, "id")
  const rev = typeof req.query.rev === "string" ? Date.parse(req.query.rev) : NaN
  if (Number.isNaN(rev)) throw new HttpError(400, "rev must be the model's updatedAt")
  const changed = () => new HttpError(409, "the model changed while its picture was made")
  const [model] = await db.select().from(model3d).where(eq(model3d.id, id))
  if (!model) notFound()
  if (model.updatedAt.getTime() !== rev) throw changed()
  const picture = await encodePicture(receivedPicture(req), MODEL_THUMB.width)
  //next to the model's file: same project folder
  const glb = await fileRow(model.glbFileId)
  const fileId = randomUUID()
  const stored = `${folderFor(glb.mainProjectId)}/images/${fileId}.webp`
  await writeObject(stored, picture.data)
  let stale: string | null
  try {
    stale = await db.transaction(async (tx) => {
      const [current] = await tx.select({ updatedAt: model3d.updatedAt, fileId: model3d.thumbnailFileId })
        .from(model3d).where(eq(model3d.id, id)).for("update")
      if (!current) notFound()
      if (current.updatedAt.getTime() !== rev) throw changed()
      await tx.insert(fileTable).values({
        id:               fileId,
        originalFilename: `${model.name}.thumbnail.webp`,
        storedFilename:   stored,
        mimeType:         "image/webp",
        sizeBytes:        picture.data.byteLength,
        width:            picture.width,
        height:           picture.height,
        kind:             MODEL_THUMB_KIND,
        uploadedBy:       adminId(res),
        mainProjectId:    glb.mainProjectId,
      })
      //updatedAt stays: it names the look this picture shows
      await tx.update(model3d).set({ thumbnailFileId: fileId }).where(eq(model3d.id, id))
      return current.fileId ? deleteRender(tx, current.fileId) : null
    })
  } catch (e) {
    //no row points at the new bytes
    await deleteObject(stored)
    throw e
  }
  if (stale) await deleteStoredFile(stale)
  res.json({ thumbnailFileId: fileId, thumbnailUrl: `/media/${stored}`, width: picture.width, height: picture.height })
})

//409 with the usages while a project or a viewer3d block still uses it
modelsRouter.delete("/api/models/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const usages = await findModelUsages(id)
  if (usages.length > 0) {
    res.status(409).json({ error: "model in use", usages })
    return
  }
  const stale = await db.transaction(async (tx) => {
    const picture = await dropPicture(tx, id)
    await tx.delete(model3d).where(eq(model3d.id, id))
    return picture
  })
  if (stale) await deleteStoredFile(stale)
  res.json({ ok: true })
})

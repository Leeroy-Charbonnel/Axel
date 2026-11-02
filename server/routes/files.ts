import { Router } from "express"
import { eq, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index"
import { file as fileTable } from "../../db/schema"
import { adminId, notFound, requireAdmin, uuidParam } from "../http"
import { receiveMedia, recordUpload } from "../uploads"

//FILE REFERENCE COUNT - single source of truth for "which rows point at a
//file id". The list, the orphan sweep and the delete all derive from it, so a
//new reference to `file` is added HERE and nowhere else. Covers the fk
//columns, main_project.thumbnails, the profile avatar (a /media URL, matched
//on stored_filename), the HDRs picked in a viewerSettings snapshot (hdrId,
//or hdrUrl as a /media URL) and every detail-page block shape: fileId,
//beforeFileId / afterFileId and items[].fileId.
export function fileRefCountSql(idExpr: SQL): SQL {
  const id   = sql`(${idExpr})::text`
  const url  = sql`(SELECT '/media/' || fu.stored_filename FROM file fu WHERE fu.id = ${idExpr})`
  const hdrIn = (col: SQL) => sql`(
    ${col}->'normalMode'->>'hdrId' = ${id} OR ${col}->'wireframeMode'->>'hdrId' = ${id} OR
    ${col}->'normalMode'->>'hdrUrl' = ${url} OR ${col}->'wireframeMode'->>'hdrUrl' = ${url}
  )`
  return sql`(
    (SELECT COUNT(*) FROM main_project    WHERE main_image_file_id = ${idExpr} OR main_wireframe_file_id = ${idExpr}) +
    (SELECT COUNT(*) FROM gallery_project WHERE image_file_id = ${idExpr}) +
    (SELECT COUNT(*) FROM software        WHERE logo_file_id = ${idExpr}) +
    (SELECT COUNT(*) FROM model_3d        WHERE glb_file_id = ${idExpr} OR thumbnail_file_id = ${idExpr}
                                                OR source_glb_file_id = ${idExpr}) +
    (SELECT COUNT(*) FROM profile         WHERE cv_file_id = ${idExpr} OR avatar_url = ${url}) +
    (SELECT COUNT(*) FROM model_3d        WHERE ${hdrIn(sql.raw("viewer_settings"))}) +
    (SELECT COUNT(*) FROM main_project mp, jsonb_array_elements(mp.thumbnails) AS thumb
      WHERE thumb->>'fileId' = ${id} OR thumb->>'wireframeFileId' = ${id}) +
    (SELECT COUNT(*) FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') AS blk
      WHERE blk->'content'->>'fileId' = ${id}
         OR blk->'content'->>'beforeFileId' = ${id}
         OR blk->'content'->>'afterFileId' = ${id}) +
    (SELECT COUNT(*) FROM main_project mp,
        jsonb_array_elements(mp.detail_page->'blocks') AS blk,
        jsonb_array_elements(COALESCE(blk->'content'->'items', '[]'::jsonb)) AS item
      WHERE item->>'fileId' = ${id})
  )::int`
}

export async function fileRefCount(id: string): Promise<number> {
  const [row] = await db.execute<{ c: number }>(sql`SELECT ${fileRefCountSql(sql`${id}::uuid`)} AS c`)
  return Number(row!.c)
}

export const filesRouter = Router()

//the file manager in /settings and the HDR picker of the model editor
filesRouter.get("/api/files", requireAdmin, async (_req, res) => {
  const rows = await db.execute<{
    id: string; original_filename: string; stored_filename: string; mime_type: string
    size_bytes: number; kind: string; created_at: string; reference_count: number
  }>(sql`
    SELECT f.id, f.original_filename, f.stored_filename, f.mime_type, f.size_bytes, f.kind, f.created_at,
           ${fileRefCountSql(sql.raw("f.id"))} AS reference_count
    FROM file f
    ORDER BY f.created_at DESC
  `)
  res.json(rows.map((row) => ({
    id:               row.id,
    originalFilename: row.original_filename,
    storedFilename:   row.stored_filename,
    mimeType:         row.mime_type,
    sizeBytes:        row.size_bytes,
    kind:             row.kind,
    createdAt:        row.created_at,
    referenceCount:   Number(row.reference_count),
    url:              `/media/${row.stored_filename}`,
  })))
})

//Deletes every unreferenced row, the bytes stay on disk. HDRs and models are
//kept even unreferenced: the editor picker swaps between them. Declared
//before /api/files/:id so "orphans" is not read as an id.
filesRouter.delete("/api/files/orphans", requireAdmin, async (_req, res) => {
  const deleted = await db.execute<{ id: string }>(sql`
    DELETE FROM file f
    WHERE f.original_filename !~* '\\.(hdr|exr|hdri|glb|gltf)$'
      AND ${fileRefCountSql(sql.raw("f.id"))} = 0
    RETURNING f.id
  `)
  res.json({ deletedCount: deleted.length })
})

//Deletes the row, the bytes stay on disk. 409 while anything references it.
filesRouter.delete("/api/files/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const [row] = await db.select({ id: fileTable.id }).from(fileTable).where(eq(fileTable.id, id))
  if (!row) notFound()
  const referenceCount = await fileRefCount(id)
  if (referenceCount > 0) {
    res.status(409).json({ error: "file is still referenced", referenceCount })
    return
  }
  await db.delete(fileTable).where(eq(fileTable.id, id))
  res.json({ ok: true })
})

//returns the new file row and its /media url
filesRouter.post("/api/files", requireAdmin, async (req, res) => {
  const file = await receiveMedia("file", req, res)
  res.json(await recordUpload(file, adminId(res)))
})


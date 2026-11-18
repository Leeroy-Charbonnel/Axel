import { Router, type Request } from "express"
import { eq, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index"
import { file as fileTable, mainProject } from "../../db/schema"
import { adminId, HttpError, notFound, requireAdmin, uuidParam } from "../http"
import { folderFor, receiveMedia, recordUpload } from "../uploads"
import { deleteObject, listObjects, type StoredObject } from "../storage"
import { derivativeKeys } from "../images"

//FILE REFERENCE COUNT - single source of truth for "which rows point at a
//file id". The list, the orphan sweep and the delete all derive from it, so a
//new reference to `file` is added HERE, and in server/file-projects.ts which
//decides the file's project folder from the same places. Covers the fk
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

//?project=<id>: one main project's files, the ones in its folder. Absent: all.
//For an upload the project must exist, a typo would file it nowhere.
async function projectParam(req: Request, mustExist: boolean): Promise<number | null> {
  const raw = req.query.project
  if (raw === undefined) return null
  const id = Number(raw)
  if (typeof raw !== "string" || !Number.isInteger(id) || id <= 0) throw new HttpError(400, "project must be a positive integer")
  if (mustExist) {
    const [row] = await db.select({ id: mainProject.id }).from(mainProject).where(eq(mainProject.id, id))
    if (!row) throw new HttpError(400, `project ${id} does not exist`)
  }
  return id
}

function projectFilter(project: number | null): SQL {
  return project === null ? sql`TRUE` : sql`f.main_project_id = ${project}`
}

//the file manager in /settings, a project's files tab, the pickers
filesRouter.get("/api/files", requireAdmin, async (req, res) => {
  const project = await projectParam(req, false)
  const rows = await db.execute<{
    id: string; original_filename: string; stored_filename: string; mime_type: string
    size_bytes: number; kind: string; created_at: string; reference_count: number; main_project_id: number | null
  }>(sql`
    SELECT f.id, f.original_filename, f.stored_filename, f.mime_type, f.size_bytes, f.kind, f.created_at,
           f.main_project_id, ${fileRefCountSql(sql.raw("f.id"))} AS reference_count
    FROM file f
    WHERE ${projectFilter(project)}
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
    projectId:        row.main_project_id === null ? null : Number(row.main_project_id),
  })))
})

//WHAT A ROW-LESS OBJECT IS. The bucket holds the stored files (one row each)
//and .cache/{format}/{width}/{stored}.{format}, the resized copies of a still.
//An object is stray when its row is gone, or for a copy, its source's row.
const CACHE_PREFIX = ".cache/"
const CACHE_KEY = /^\.cache\/[a-z]+\/\d+\/(.+)\.[a-z]+$/

function sourceOf(key: string): string {
  return CACHE_KEY.exec(key)?.[1] ?? key
}

//rows with no reference, as the sweep deletes them. HDRs and models are kept
//even unreferenced: the editor picker swaps between them.
const ORPHAN_ROWS = sql`
  f.original_filename !~* '\\.(hdr|exr|hdri|glb|gltf)$'
  AND ${fileRefCountSql(sql.raw("f.id"))} = 0
`

async function storedNames(): Promise<Set<string>> {
  const rows = await db.select({ stored: fileTable.storedFilename }).from(fileTable)
  return new Set(rows.map((r) => r.stored))
}

function strayObjects(objects: StoredObject[], names: Set<string>): StoredObject[] {
  return objects.filter((o) => !names.has(sourceOf(o.key)))
}

//deletes the objects a few at a time, so a big sweep does not open hundreds of requests at once
async function deleteKeys(keys: string[]): Promise<void> {
  const BATCH = 8
  for (let i = 0; i < keys.length; i += BATCH) {
    await Promise.all(keys.slice(i, i + BATCH).map(deleteObject))
  }
}

function sum(objects: StoredObject[]): number {
  return objects.reduce((total, o) => total + o.size, 0)
}

//the bucket, or one project's folder with the resized copies of its stills
async function objectsOf(project: number | null): Promise<StoredObject[]> {
  const all = await listObjects()
  if (project === null) return all
  const folder = `${folderFor(project)}/`
  return all.filter((o) => sourceOf(o.key).startsWith(folder))
}

//WHAT THE BUCKET HOLDS (or ?project=<id>, one project's folder): total,
//resized copies, and what the sweep would free
filesRouter.get("/api/files/storage", requireAdmin, async (req, res) => {
  const project = await projectParam(req, false)
  const [objects, names, orphanRows] = await Promise.all([
    objectsOf(project),
    storedNames(),
    db.execute<{ stored_filename: string }>(sql`
      SELECT f.stored_filename FROM file f WHERE ${ORPHAN_ROWS} AND ${projectFilter(project)}
    `),
  ])
  const orphanNames = new Set(orphanRows.map((r) => r.stored_filename))
  const stray = strayObjects(objects, names)
  const ofOrphanRows = objects.filter((o) => orphanNames.has(sourceOf(o.key)))
  res.json({
    totalBytes:   sum(objects),
    cacheBytes:   sum(objects.filter((o) => o.key.startsWith(CACHE_PREFIX))),
    objectCount:  objects.length,
    orphans: {
      rows:        orphanNames.size,
      strayFiles:  stray.length,
      bytes:       sum(ofOrphanRows) + sum(stray),
    },
  })
})

//THE SWEEP (or ?project=<id>, inside one project's folder). Deletes every
//unreferenced row and its bytes with their resized copies, then every object
//left without a row. Declared before the :id route so "orphans" is not read
//as an id.
filesRouter.delete("/api/files/orphans", requireAdmin, async (req, res) => {
  const project = await projectParam(req, false)
  const deleted = await db.execute<{ stored_filename: string }>(sql`
    DELETE FROM file f WHERE ${ORPHAN_ROWS} AND ${projectFilter(project)} RETURNING f.stored_filename
  `)
  //listed after the rows are gone: their bytes are stray now, like any other
  const [objects, names] = await Promise.all([objectsOf(project), storedNames()])
  const stray = strayObjects(objects, names)
  await deleteKeys(stray.map((o) => o.key))
  res.json({ deletedRows: deleted.length, deletedObjects: stray.length, freedBytes: sum(stray) })
})

//Deletes the row, then its bytes and resized copies. 409 while anything
//references it. A failure on the bytes leaves them stray: the sweep takes them.
filesRouter.delete("/api/files/:id", requireAdmin, async (req, res) => {
  const id = uuidParam(req, "id")
  const [row] = await db.select({ stored: fileTable.storedFilename }).from(fileTable).where(eq(fileTable.id, id))
  if (!row) notFound()
  const referenceCount = await fileRefCount(id)
  if (referenceCount > 0) {
    res.status(409).json({ error: "file is still referenced", referenceCount })
    return
  }
  await db.delete(fileTable).where(eq(fileTable.id, id))
  await deleteKeys([row.stored, ...derivativeKeys(row.stored)])
  res.json({ ok: true })
})

//returns the new file row and its /media url. ?project=<id> files it in that
//project's folder, without it the file goes to shared/.
filesRouter.post("/api/files", requireAdmin, async (req, res) => {
  const project = await projectParam(req, true)
  const file = await receiveMedia("file", req, res)
  const row = await recordUpload(file, adminId(res), undefined, project)
  res.json({ ...row, projectId: row.mainProjectId })
})


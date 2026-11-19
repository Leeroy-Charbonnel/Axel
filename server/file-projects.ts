import { eq, sql } from "drizzle-orm"
import { db } from "../db/index"
import { file as fileTable } from "../db/schema"
import { derivativeKeys } from "./images"
import { deleteObject, objectExists, objectFile, writeObject } from "./storage"
import { folderFor } from "./uploads"

//ONE FOLDER PER PROJECT. A file referenced by one main project only lives in
//projects/{id}/, any other referenced file in shared/ (gallery cards, logos,
//the profile, HDRs, a model no project shows, a file two projects use).
//A file nothing references keeps the folder it was uploaded to.
//
//Every place that holds a file id is listed here AND in fileRefCountSql
//(server/routes/files.ts). Owner 0 means "not a project".

const UUID = sql.raw(`'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`)

const OWNERS = sql`
  WITH project_models AS (
    SELECT mp.id AS pid, mp.model_3d_id AS mid FROM main_project mp WHERE mp.model_3d_id IS NOT NULL
    UNION
    SELECT mp.id, (blk->'content'->>'model3dId')::uuid
      FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') blk
      WHERE blk->'content'->>'model3dId' ~ ${UUID}
    UNION
    SELECT mp.id, (blk->'content'->>'modelId')::uuid
      FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') blk
      WHERE blk->'content'->>'modelId' ~ ${UUID}
  ),
  model_owners AS (
    SELECT m.id AS mid, pm.pid AS owner FROM model_3d m JOIN project_models pm ON pm.mid = m.id
    UNION ALL
    SELECT m.id, 0 FROM model_3d m WHERE m.id NOT IN (SELECT mid FROM project_models)
  ),
  refs AS (
    SELECT main_image_file_id AS fid, id AS owner FROM main_project WHERE main_image_file_id IS NOT NULL
    UNION ALL SELECT main_wireframe_file_id, id FROM main_project WHERE main_wireframe_file_id IS NOT NULL
    UNION ALL SELECT (t->>'fileId')::uuid, mp.id FROM main_project mp, jsonb_array_elements(mp.thumbnails) t
      WHERE t->>'fileId' ~ ${UUID}
    UNION ALL SELECT (t->>'wireframeFileId')::uuid, mp.id FROM main_project mp, jsonb_array_elements(mp.thumbnails) t
      WHERE t->>'wireframeFileId' ~ ${UUID}
    UNION ALL SELECT (blk->'content'->>k)::uuid, mp.id
      FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') blk,
           unnest(ARRAY['fileId', 'beforeFileId', 'afterFileId']) k
      WHERE blk->'content'->>k ~ ${UUID}
    UNION ALL SELECT (item->>'fileId')::uuid, mp.id
      FROM main_project mp, jsonb_array_elements(mp.detail_page->'blocks') blk,
           jsonb_array_elements(COALESCE(blk->'content'->'items', '[]'::jsonb)) item
      WHERE item->>'fileId' ~ ${UUID}
    UNION ALL SELECT m.glb_file_id, mo.owner FROM model_3d m JOIN model_owners mo ON mo.mid = m.id
    UNION ALL SELECT m.thumbnail_file_id, mo.owner FROM model_3d m JOIN model_owners mo ON mo.mid = m.id
      WHERE m.thumbnail_file_id IS NOT NULL
    UNION ALL SELECT m.source_glb_file_id, mo.owner FROM model_3d m JOIN model_owners mo ON mo.mid = m.id
      WHERE m.source_glb_file_id IS NOT NULL
    UNION ALL SELECT m.phone_glb_file_id, mo.owner FROM model_3d m JOIN model_owners mo ON mo.mid = m.id
      WHERE m.phone_glb_file_id IS NOT NULL
    UNION ALL SELECT (m.viewer_settings->mode->>'hdrId')::uuid, 0
      FROM model_3d m, unnest(ARRAY['normalMode', 'wireframeMode']) mode
      WHERE m.viewer_settings->mode->>'hdrId' ~ ${UUID}
    UNION ALL SELECT f.id, 0 FROM model_3d m, unnest(ARRAY['normalMode', 'wireframeMode']) mode, file f
      WHERE m.viewer_settings->mode->>'hdrUrl' = '/media/' || f.stored_filename
    UNION ALL SELECT image_file_id, 0 FROM gallery_project WHERE image_file_id IS NOT NULL
    UNION ALL SELECT logo_file_id, 0 FROM software WHERE logo_file_id IS NOT NULL
    UNION ALL SELECT cv_file_id, 0 FROM profile WHERE cv_file_id IS NOT NULL
    UNION ALL SELECT f.id, 0 FROM profile p JOIN file f ON p.avatar_url = '/media/' || f.stored_filename
  )
  SELECT f.id, f.stored_filename, f.main_project_id,
         CASE WHEN COUNT(r.fid) = 0 THEN f.main_project_id
              WHEN COUNT(DISTINCT r.owner) = 1 AND MIN(r.owner) > 0 THEN MIN(r.owner)
              ELSE NULL END AS owner
  FROM file f LEFT JOIN refs r ON r.fid = f.id
  GROUP BY f.id
`

export interface Filing { id: string; from: string; to: string; mainProjectId: number | null }

//where each file should be, for the files not there yet
export async function planFiling(): Promise<Filing[]> {
  const rows = await db.execute<{ id: string; stored_filename: string; main_project_id: number | null; owner: number | null }>(OWNERS)
  const plan: Filing[] = []
  for (const r of rows) {
    const parts = r.stored_filename.split("/")
    const name = parts.at(-1)
    const subdir = parts.at(-2)
    if (!name || !subdir) {
      console.error(`[file-projects] ${r.stored_filename} has no subdir/name shape, left in place`)
      continue
    }
    const owner = r.owner === null ? null : Number(r.owner)
    const to = `${folderFor(owner)}/${subdir}/${name}`
    if (to !== r.stored_filename || owner !== r.main_project_id) {
      plan.push({ id: r.id, from: r.stored_filename, to, mainProjectId: owner })
    }
  }
  return plan
}

//Moves one file: copy, then the row and every /media URL naming it, then the
//old bytes and their resized copies. Run twice, it finds the copy done.
async function move(f: Filing): Promise<void> {
  if (f.to !== f.from) {
    //Read whole, then write: streaming one object into another fails on large files
    if (!(await objectExists(f.to))) await writeObject(f.to, new Uint8Array(await objectFile(f.from).arrayBuffer()))
  }
  const oldUrl = `/media/${f.from}`
  const newUrl = `/media/${f.to}`
  await db.transaction(async (tx) => {
    await tx.update(fileTable).set({ storedFilename: f.to, mainProjectId: f.mainProjectId }).where(eq(fileTable.id, f.id))
    if (f.to !== f.from) {
      await tx.execute(sql`UPDATE profile SET avatar_url = ${newUrl} WHERE avatar_url = ${oldUrl}`)
      await tx.execute(sql`
        UPDATE model_3d SET viewer_settings = replace(viewer_settings::text, ${oldUrl}, ${newUrl})::jsonb
        WHERE viewer_settings::text LIKE ${`%${oldUrl}%`}
      `)
    }
  })
  if (f.to !== f.from) {
    await Promise.all([f.from, ...derivativeKeys(f.from)].map(deleteObject))
  }
}

const LOG_EVERY = 25

//A file that cannot move stays where it is: /media still serves its old key
export async function fileIntoProjects(log: (line: string) => void): Promise<number> {
  const plan = await planFiling()
  let done = 0
  let failed = 0
  for (const f of plan) {
    try {
      await move(f)
    } catch (e) {
      failed++
      console.error(`[file-projects] ${f.from} -> ${f.to} failed, left in place:`, e)
    }
    done++
    if (done % LOG_EVERY === 0 || done === plan.length) log(`[file-projects] ${done}/${plan.length}, ${failed} failed`)
  }
  return plan.length - failed
}

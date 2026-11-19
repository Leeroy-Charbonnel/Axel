import { Router } from "express"
import { THUMB_SIDE } from "../src/lib/media"
import { STORED_KEY, THUMB_EXT, THUMB_PREFIX, thumbKey } from "./derived"
import { listObjects, sendObject } from "./storage"

//THUMBNAILS THE ADMIN'S BROWSER MAKES. A model, an environment map or a video
//has no picture the server can draw: the admin's browser renders one and sends
//it to an admin route (picture.ts).
//
//A FILE's thumbnail (PUT /api/files/:id/thumbnail) is a derived object of that
//file, like a resized copy (derived.ts), served under
///media/thumb/{side}/{stored}. It is deleted and moved with its file, swept
//once its row is gone and counted in the cache share of the storage. Deleting
//it is always safe: the library makes it again.
//
//A MODEL's picture (PUT /api/models/:id/thumbnail) is a file row of kind
//MODEL_THUMB_KIND, see routes/models.ts.

const YEAR_SECONDS = 60 * 60 * 24 * 365

//the kind of the file row that holds a model's rendered picture
export const MODEL_THUMB_KIND = "thumbnail"

//every file thumbnail in the bucket: stored name to the time it was written
export async function listThumbs(): Promise<Map<string, number>> {
  const found = new Map<string, number>()
  for (const o of await listObjects(THUMB_PREFIX)) {
    found.set(o.key.slice(THUMB_PREFIX.length, -THUMB_EXT.length), o.lastModified)
  }
  return found
}

export const thumbsRouter = Router()

//public like the file itself: both are reached by the file's unguessable name
thumbsRouter.get("/media/thumb/:side/*path", async (req, res) => {
  const stored = (req.params.path as string[]).join("/")
  if (req.params.side !== String(THUMB_SIDE) || !STORED_KEY.test(stored)
    || !(await sendObject(req, res, thumbKey(stored), YEAR_SECONDS))) res.status(404).end()
})

import { reactive } from "vue"
import { applyEditorPrefs } from "../../../composables/useEffectiveViewerSettings"
import { usePortfolio } from "../../../composables/usePortfolio"
import { useTheme } from "../../../composables/useTheme"
import { MODEL_THUMB, THUMB_SIDE } from "../../../lib/media"
import { videoFrame } from "../../../lib/thumb-image"
import type { ModelStills } from "../../../three/thumbnailer"
import type { ViewerSettings } from "../../../three/types"
import { mediaTypeOf, useMediaLibrary, type MediaFile, type MediaType } from "./useMediaLibrary"

//THE PICTURES THE ADMIN'S BROWSER MAKES: the thumbnail of a model file, an
//environment map or a video (kept by the server as a derived object of the
//file), and the picture of a 3D model entry (a render from its start view,
//the viewer's poster). A screen that shows one without its picture asks for
//it here. They are made one at a time, in the background, and sent to the
//server, which stores them: each is made once. One that cannot be made is
//logged with its reason and not tried again before the page reloads.

type Thumbnailer = typeof import("../../../three/thumbnailer")

//What one run of the queue shares: the 3D code, fetched for the first model
//or map, and one hidden canvas for every model.
class Run {
  private code: Promise<Thumbnailer> | null = null
  private models: ModelStills | null = null

  thumbnailer(): Promise<Thumbnailer> {
    this.code ??= import("../../../three/thumbnailer")
    return this.code
  }

  async stills(): Promise<ModelStills> {
    this.models ??= new (await this.thumbnailer()).ModelStills()
    return this.models
  }

  //gives the WebGL context back
  end(): void {
    this.models?.dispose()
  }
}

interface Job {
  key:   string
  //what the log calls it
  label: string
  //times the server refused the picture because its model changed meanwhile
  stale: number
  make(run: Run): Promise<void>
}

//the server refused a picture of a look that is gone: it is made again
class ModelChanged extends Error {}
const STALE_RETRIES = 3

const queue: Job[] = []
let running = false
//the key of the picture being made
let current: string | null = null
//waiting or being made, and failed since the page loaded
const pending = reactive(new Set<string>())
const failed = new Set<string>()
//asked for again while being made: made once more when done
const again = new Set<string>()

const fileKey = (id: string) => `file:${id}`
const modelKey = (id: string) => `model:${id}`

async function work(): Promise<void> {
  if (running) return
  running = true
  const run = new Run()
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      current = job.key
      try {
        await job.make(run)
      } catch (e) {
        if (e instanceof ModelChanged && job.stale < STALE_RETRIES) {
          job.stale++
          again.delete(job.key)
          queue.push(job)
          continue
        }
        failed.add(job.key)
        console.error(`[thumbnails] no picture for ${job.label}:`, e)
      }
      pending.delete(job.key)
      if (again.delete(job.key)) {
        failed.delete(job.key)
        enqueue(job.key, job.label, job.make)
      }
    }
  } finally {
    current = null
    run.end()
    running = false
  }
}

function enqueue(key: string, label: string, make: Job["make"]): void {
  if (pending.has(key) || failed.has(key)) return
  pending.add(key)
  queue.push({ key, label, stale: 0, make })
  void work()
}

//the picture is the body; a refusal throws with the server's reason
async function putPicture<T>(path: string, picture: Blob): Promise<T> {
  const res = await fetch(path, { method: "PUT", credentials: "include", headers: { "Content-Type": picture.type }, body: picture })
  if (res.status === 409) throw new ModelChanged(await res.text())
  if (!res.ok) throw new Error(`PUT ${path} -> ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

const glowColor = () => useTheme().accent.value

//FILES - the types whose picture the browser draws
const DRAWN: Array<MediaType | null> = ["model", "hdr", "video"]

function drawFile(file: MediaFile, run: Run): Promise<Blob> {
  const type = mediaTypeOf(file)
  if (type === "video") return videoFrame(file.url, THUMB_SIDE)
  if (type === "hdr") return run.thumbnailer().then((code) => code.environmentStill(file.url, THUMB_SIDE))
  //a model file on its own: the viewer's automatic lights and framing
  return run.stills().then((stills) => stills.take(file.url, {}, THUMB_SIDE, THUMB_SIDE, glowColor()))
}

//Asks for the thumbnail of a file that has none. Nothing happens for an
//image, a document, or a file already asked for.
function requestFileThumb(file: MediaFile): void {
  if (file.thumbUrl || !DRAWN.includes(mediaTypeOf(file))) return
  enqueue(fileKey(file.id), file.originalFilename, async (run) => {
    const picture = await drawFile(file, run)
    const saved = await putPicture<{ thumbUrl: string }>(`/api/files/${file.id}/thumbnail`, picture)
    useMediaLibrary().setThumb(file.id, saved.thumbUrl)
  })
}

//A tile that left the screen before its turn gives its place up
function cancelFileThumb(id: string): void {
  const key = fileKey(id)
  const at = queue.findIndex((job) => job.key === key)
  if (at === -1) return
  queue.splice(at, 1)
  pending.delete(key)
}

//MODEL ENTRIES - what GET /api/models/:id answers, as far as a render needs it
interface ModelRow {
  glbUrl:         string | null
  viewerSettings: unknown
  updatedAt:      string
}

interface SavedPicture {
  thumbnailFileId: string
  thumbnailUrl:    string
  width:           number
  height:          number
}

async function renderModel(id: string, run: Run): Promise<void> {
  const res = await fetch(`/api/models/${id}`, { credentials: "include" })
  if (!res.ok) throw new Error(`GET /api/models/${id} -> ${res.status} ${await res.text()}`)
  const model = await res.json() as ModelRow
  if (!model.glbUrl) throw new Error("the model has no file")
  const portfolio = usePortfolio()
  //as the site shows it with no view picked: the model's own start view
  const settings: ViewerSettings = { ...applyEditorPrefs(model.viewerSettings, portfolio.data.value?.editorPrefs), startView: null }
  const stills = await run.stills()
  const picture = await stills.take(model.glbUrl, settings, MODEL_THUMB.width, MODEL_THUMB.height, glowColor())
  //rev: the server refuses the picture of a model saved again meanwhile
  const saved = await putPicture<SavedPicture>(`/api/models/${id}/thumbnail?rev=${encodeURIComponent(model.updatedAt)}`, picture)
  const data = portfolio.data.value
  const entry = data?.models.find((m) => m.id === id)
  if (!data || !entry) return
  data.images[saved.thumbnailUrl] = [saved.width, saved.height]
  Object.assign(entry, { thumbnailFileId: saved.thumbnailFileId, thumbnailUrl: saved.thumbnailUrl, thumbnailRendered: true })
}

//Asks for the picture of a model that has none. changed: the model was just
//saved with a new look. The server dropped its picture, so does this page;
//an earlier failure no longer counts, and a render in progress is made again.
function requestModelThumb(id: string, label: string, changed = false): void {
  const key = modelKey(id)
  if (changed) {
    const entry = usePortfolio().data.value?.models.find((m) => m.id === id)
    if (entry) Object.assign(entry, { thumbnailFileId: null, thumbnailUrl: null, thumbnailRendered: false })
    failed.delete(key)
    if (current === key) again.add(key)
  }
  enqueue(key, label, (run) => renderModel(id, run))
}

export function useThumbnails() {
  return {
    requestFileThumb, cancelFileThumb, requestModelThumb,
    //true while a file's thumbnail is waiting or being made
    fileThumbPending: (id: string) => pending.has(fileKey(id)),
  }
}

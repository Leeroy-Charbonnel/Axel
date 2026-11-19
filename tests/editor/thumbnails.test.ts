import { afterAll, describe, expect, mock, test } from "bun:test"
import { ref } from "vue"
import type { MediaFile } from "../../src/components/admin/media/useMediaLibrary"
import type { Model3dDto, PortfolioDto } from "../../src/types/portfolio"

//the queue's collaborators, replaced before it is imported: no DOM, no WebGL,
//no server. Every picture is drawn by a stand-in the test holds or lets go.
const data = ref<PortfolioDto | null>(null)
mock.module("../../src/composables/usePortfolio", () => ({
  usePortfolio: () => ({ data }),
  apiJson:      async () => ({}),
  uploadFile:   async () => ({}),
}))
mock.module("../../src/composables/useToast", () => ({ useToast: () => ({ error: () => {}, info: () => {}, success: () => {} }) }))
mock.module("../../src/composables/useTranslations", () => ({ useTranslations: () => ({ t: (key: string) => key }) }))

//what the stand-in drew, in order, and how many canvases it gave back
const drawn: string[] = []
let disposed = 0
//a URL in here throws; a held one waits for release()
const broken = new Set<string>()
let held: { url: string; release: () => void } | null = null
let holdNext = false

async function draw(url: string): Promise<Blob> {
  drawn.push(url)
  if (holdNext) {
    holdNext = false
    await new Promise<void>((release) => { held = { url, release } })
  }
  if (broken.has(url)) throw new Error("no WebGL")
  return new Blob(["picture"], { type: "image/webp" })
}

mock.module("../../src/three/thumbnailer", () => ({
  ModelStills: class {
    take(url: string) { return draw(url) }
    dispose() { disposed++ }
  },
  environmentStill: (url: string) => draw(url),
}))

//THE SERVER: stores every picture, refuses a model picture while `stale` is set
const puts: string[] = []
const stale = new Set<string>()
const realFetch = globalThis.fetch
afterAll(() => { globalThis.fetch = realFetch })
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const path = String(input)
  if (init?.method === "PUT") {
    puts.push(path)
    const model = /^\/api\/models\/([^/]+)\/thumbnail/.exec(path)?.[1]
    if (model && stale.delete(model)) return new Response("the model changed", { status: 409 })
    if (model) return Response.json({ thumbnailFileId: "f1", thumbnailUrl: `/media/shared/images/${model}.webp`, width: 960, height: 540 })
    return Response.json({ thumbUrl: `${path}?v=1` })
  }
  const id = path.split("/").pop()!
  return Response.json({ glbUrl: `/media/shared/models/${id}.glb`, viewerSettings: null, updatedAt: "2026-01-01T00:00:00.000Z" })
}) as typeof fetch

const { useThumbnails } = await import("../../src/components/admin/media/thumbnails")
const { useMediaLibrary } = await import("../../src/components/admin/media/useMediaLibrary")
const thumbs = useThumbnails()
const library = useMediaLibrary()

function file(id: string, name: string, thumbUrl: string | null = null): MediaFile {
  return {
    id, originalFilename: name, mimeType: "application/octet-stream", sizeBytes: 1, kind: "other",
    createdAt: "", referenceCount: 0, url: `/media/shared/models/${id}`, thumbUrl, projectId: null,
  }
}

function model(id: string): Model3dDto {
  return { id, name: id, thumbnailFileId: "old", thumbnailUrl: "/media/old.jpg", thumbnailRendered: false } as Model3dDto
}

//lets every queued picture be drawn and stored
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0))
}

function reset(files: MediaFile[], models: Model3dDto[] = []) {
  drawn.length = 0
  puts.length = 0
  disposed = 0
  library.files.value = files
  data.value = { models, images: {} } as unknown as PortfolioDto
}

describe("thumbnails the browser makes", () => {
  test("are made one at a time, in the order asked, and reach the library", async () => {
    const a = file("a", "a.glb"), b = file("b", "b.exr")
    reset([a, b])
    holdNext = true
    thumbs.requestFileThumb(a)
    thumbs.requestFileThumb(b)
    await settle()
    //the second one waits while the first is being drawn
    expect(drawn).toEqual([a.url])
    expect(thumbs.fileThumbPending("b")).toBe(true)
    held!.release()
    await settle()
    expect(drawn).toEqual([a.url, b.url])
    expect(puts).toEqual(["/api/files/a/thumbnail", "/api/files/b/thumbnail"])
    expect(library.files.value.map((f) => f.thumbUrl)).toEqual(["/api/files/a/thumbnail?v=1", "/api/files/b/thumbnail?v=1"])
    expect(thumbs.fileThumbPending("a")).toBe(false)
    //one canvas for the run, given back when the queue is empty
    expect(disposed).toBe(1)
  })

  test("only for a model, a map or a video without one, and once", async () => {
    const glb = file("c", "c.glb")
    reset([glb])
    thumbs.requestFileThumb(file("d", "d.glb", "/media/thumb/400/d.glb?v=1"))
    thumbs.requestFileThumb({ ...file("e", "e.png"), mimeType: "image/png" })
    thumbs.requestFileThumb({ ...file("f", "f.pdf"), mimeType: "application/pdf" })
    thumbs.requestFileThumb(glb)
    thumbs.requestFileThumb(glb)
    await settle()
    expect(drawn).toEqual([glb.url])
  })

  test("a tile that leaves before its turn is not drawn", async () => {
    const g = file("g", "g.glb"), h = file("h", "h.glb")
    reset([g, h])
    holdNext = true
    thumbs.requestFileThumb(g)
    thumbs.requestFileThumb(h)
    await settle()
    thumbs.cancelFileThumb("h")
    //the one being drawn is finished whatever happens
    thumbs.cancelFileThumb("g")
    held!.release()
    await settle()
    expect(drawn).toEqual([g.url])
    expect(thumbs.fileThumbPending("h")).toBe(false)
  })

  test("one that cannot be made is logged, not tried again, and does not stop the others", async () => {
    const bad = file("i", "i.glb"), good = file("j", "j.glb")
    reset([bad, good])
    broken.add(bad.url)
    const logged: unknown[][] = []
    const error = console.error
    console.error = (...args: unknown[]) => { logged.push(args) }
    thumbs.requestFileThumb(bad)
    thumbs.requestFileThumb(good)
    await settle()
    thumbs.requestFileThumb(bad)
    await settle()
    console.error = error
    expect(drawn).toEqual([bad.url, good.url])
    expect(logged).toHaveLength(1)
    expect(String(logged[0]![0]).includes("i.glb")).toBe(true)
    expect(library.files.value.map((f) => f.thumbUrl)).toEqual([null, "/api/files/j/thumbnail?v=1"])
  })
})

describe("the picture of a 3D model entry", () => {
  test("is rendered from the model as saved and replaces the one on the page", async () => {
    reset([], [model("m1")])
    thumbs.requestModelThumb("m1", "Piano")
    await settle()
    expect(drawn).toEqual(["/media/shared/models/m1.glb"])
    expect(puts).toEqual(["/api/models/m1/thumbnail?rev=2026-01-01T00%3A00%3A00.000Z"])
    const entry = data.value!.models[0]!
    expect([entry.thumbnailUrl, entry.thumbnailRendered]).toEqual(["/media/shared/images/m1.webp", true])
    expect(data.value!.images["/media/shared/images/m1.webp"]).toEqual([960, 540])
  })

  test("is made again when the server refuses it: the model was saved while it was rendered", async () => {
    reset([], [model("m2")])
    stale.add("m2")
    thumbs.requestModelThumb("m2", "Jukebox")
    await settle()
    expect(drawn).toHaveLength(2)
    expect(data.value!.models[0]!.thumbnailRendered).toBe(true)
  })

  test("is made once more when the page itself saved the model during the render", async () => {
    reset([], [model("m4")])
    holdNext = true
    thumbs.requestModelThumb("m4", "Piano")
    await settle()
    thumbs.requestModelThumb("m4", "Piano", true)
    held!.release()
    await settle()
    expect(drawn).toHaveLength(2)
    expect(data.value!.models[0]!.thumbnailRendered).toBe(true)
  })

  test("a model saved with a new look loses its picture at once, and an earlier failure is forgotten", async () => {
    reset([], [model("m3")])
    broken.add("/media/shared/models/m3.glb")
    const error = console.error
    console.error = () => {}
    thumbs.requestModelThumb("m3", "Clock")
    await settle()
    console.error = error
    broken.clear()
    thumbs.requestModelThumb("m3", "Clock")
    await settle()
    //failed once: not tried again until the model changes
    expect(drawn).toHaveLength(1)
    thumbs.requestModelThumb("m3", "Clock", true)
    expect([data.value!.models[0]!.thumbnailUrl, data.value!.models[0]!.thumbnailRendered]).toEqual([null, false])
    await settle()
    expect(drawn).toHaveLength(2)
    expect(data.value!.models[0]!.thumbnailRendered).toBe(true)
  })
})

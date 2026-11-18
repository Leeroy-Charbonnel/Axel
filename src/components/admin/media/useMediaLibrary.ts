import { ref, shallowRef } from "vue"
import { apiJson, uploadFile } from "../../../composables/usePortfolio"

//THE MEDIA LIBRARY. One list of uploaded files (GET /api/files), one upload
//path, and one picker: every "choose a file" in the app awaits pickMedia() and
//the single <MediaLibraryDialog /> mounted in App.vue answers it.

export type MediaType = "image" | "video" | "model" | "hdr" | "document"

export interface MediaFile {
  id:               string
  originalFilename: string
  mimeType:         string
  sizeBytes:        number
  kind:             string
  createdAt:        string
  referenceCount:   number
  url:              string
}

//REGISTRY of the file types: filter chips, upload accept attribute, detection
type FileFacts = Pick<MediaFile, "originalFilename" | "mimeType">

//uploadPath: a PDF is only accepted as the CV, which its route attaches to the profile
export const MEDIA_TYPES: { type: MediaType; labelKey: string; accept: string; uploadPath: string; test: (f: FileFacts) => boolean }[] = [
  { type: "image",    labelKey: "mediaTypeImage",    accept: "image/*",              uploadPath: "/api/files",      test: (f) => f.mimeType.startsWith("image/") && !/\.(hdr|exr|hdri)$/i.test(f.originalFilename) },
  { type: "video",    labelKey: "mediaTypeVideo",    accept: "video/*",              uploadPath: "/api/files",      test: (f) => f.mimeType.startsWith("video/") },
  { type: "model",    labelKey: "mediaTypeModel",    accept: ".glb,.gltf",           uploadPath: "/api/files",      test: (f) => /\.(glb|gltf)$/i.test(f.originalFilename) },
  { type: "hdr",      labelKey: "mediaTypeHdr",      accept: ".hdr,.exr,.hdri",      uploadPath: "/api/files",      test: (f) => /\.(hdr|exr|hdri)$/i.test(f.originalFilename) },
  { type: "document", labelKey: "mediaTypeDocument", accept: ".pdf,application/pdf", uploadPath: "/api/profile/cv", test: (f) => f.mimeType === "application/pdf" || /\.pdf$/i.test(f.originalFilename) },
]

export function mediaTypeOf(f: FileFacts): MediaType | null {
  return MEDIA_TYPES.find((t) => t.test(f))?.type ?? null
}

//a file of no known type goes to the general route, which answers why it refuses it
function uploadPathFor(f: File): string {
  const type = mediaTypeOf({ originalFilename: f.name, mimeType: f.type })
  return MEDIA_TYPES.find((t) => t.type === type)?.uploadPath ?? "/api/files"
}

export function acceptFor(type: MediaType | null): string | undefined {
  return type ? MEDIA_TYPES.find((t) => t.type === type)?.accept : undefined
}

const files     = ref<MediaFile[]>([])
const loading   = ref(false)
const uploading = ref(false)
const error     = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    files.value = await apiJson<MediaFile[]>("GET", "/api/files")
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

//the list once per page load, for the fields that show original file names
let listed: Promise<void> | null = null
function ensureLoaded(): Promise<void> {
  listed ??= load()
  return listed
}

//uploads one after the other and answers the new rows, as listed by the server
async function upload(list: File[]): Promise<MediaFile[]> {
  if (!list.length) return []
  uploading.value = true
  const ids: string[] = []
  try {
    for (const f of list) ids.push((await uploadFile(f, uploadPathFor(f))).id)
  } catch (e) {
    console.error("[media] upload stopped:", e)
  } finally {
    uploading.value = false
  }
  await load()
  return ids.map((id) => files.value.find((f) => f.id === id)).filter((f): f is MediaFile => Boolean(f))
}

async function remove(file: MediaFile) {
  await apiJson("DELETE", `/api/files/${file.id}`)
  await load()
}

//PICK REQUEST - like useConfirm: one open request, settled by the dialog
export interface PickRequest {
  accept:   MediaType | null
  multiple: boolean
}

const request = shallowRef<PickRequest | null>(null)
let settle: ((picked: MediaFile[]) => void) | null = null

//resolves with the chosen files, or [] when the dialog is dismissed
function pickMedia(opts: { accept?: MediaType; multiple?: boolean } = {}): Promise<MediaFile[]> {
  settle?.([])
  request.value = { accept: opts.accept ?? null, multiple: opts.multiple ?? false }
  return new Promise<MediaFile[]>((resolve) => { settle = resolve })
}

function finish(picked: MediaFile[]) {
  request.value = null
  settle?.(picked)
  settle = null
}

export function useMediaLibrary() {
  return {
    files, loading, uploading, error,
    load, ensureLoaded, upload, remove,
    request, pickMedia,
    resolvePick: finish,
    cancelPick:  () => finish([]),
  }
}

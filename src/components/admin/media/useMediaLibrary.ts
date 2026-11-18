import { ref, shallowRef, watch, type WatchStopHandle } from "vue"
import { apiJson, uploadFile, usePortfolio } from "../../../composables/usePortfolio"
import { useToast } from "../../../composables/useToast"
import { useTranslations } from "../../../composables/useTranslations"

//THE MEDIA LIBRARY. One list of uploaded files (GET /api/files, every file
//with its project), one upload path, and one picker: every "choose a file" in
//the app awaits pickMedia() and the single <MediaLibraryDialog /> mounted in
//App.vue answers it. A file of a main project lives in that project's folder
//on the server (projectId), the rest in shared (projectId null).

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
  projectId:        number | null
}

//GET /api/files/storage: the bucket, or one project's folder. Orphans are
//counted in source files, like the sweep's answer.
export interface StorageSummary {
  totalBytes:  number
  cacheBytes:  number
  objectCount: number
  orphans:     { files: number; bytes: number }
}

//DELETE /api/files/orphans
export interface SweepResult {
  deletedFiles: number
  freedBytes:   number
}

//a project's files, or every file when project is null
export function inScope(f: MediaFile, project: number | null): boolean {
  return project === null || f.projectId === project
}

function withProject(path: string, project: number | null): string {
  return project === null ? path : `${path}?project=${project}`
}

//REGISTRY of the file types: filter chips, upload accept attribute, detection
type FileFacts = Pick<MediaFile, "originalFilename" | "mimeType">

//Every type goes to /api/files; only the profile's CV field makes a PDF the CV
export const MEDIA_TYPES: { type: MediaType; labelKey: string; accept: string; test: (f: FileFacts) => boolean }[] = [
  { type: "image",    labelKey: "mediaTypeImage",    accept: "image/*",              test: (f) => f.mimeType.startsWith("image/") && !/\.(hdr|exr|hdri)$/i.test(f.originalFilename) },
  { type: "video",    labelKey: "mediaTypeVideo",    accept: "video/*",              test: (f) => f.mimeType.startsWith("video/") },
  { type: "model",    labelKey: "mediaTypeModel",    accept: ".glb,.gltf",           test: (f) => /\.(glb|gltf)$/i.test(f.originalFilename) },
  { type: "hdr",      labelKey: "mediaTypeHdr",      accept: ".hdr,.exr,.hdri",      test: (f) => /\.(hdr|exr|hdri)$/i.test(f.originalFilename) },
  { type: "document", labelKey: "mediaTypeDocument", accept: ".pdf,application/pdf", test: (f) => f.mimeType === "application/pdf" || /\.pdf$/i.test(f.originalFilename) },
]

export function mediaTypeOf(f: FileFacts): MediaType | null {
  return MEDIA_TYPES.find((t) => t.test(f))?.type ?? null
}

//The type of a file about to be sent
export function mediaTypeOfUpload(f: File): MediaType | null {
  return mediaTypeOf({ originalFilename: f.name, mimeType: f.type })
}

export function acceptFor(type: MediaType | null): string | undefined {
  return type ? MEDIA_TYPES.find((t) => t.type === type)?.accept : undefined
}

const toast = useToast()
const { t } = useTranslations()

//apiJson and uploadFile toast an HTTP failure; a request that got no answer is toasted here
export function reportFailure(e: unknown, what: string): void {
  console.error(`[media] ${what} failed:`, e)
  if (e instanceof TypeError) toast.error(e.message, what)
}

//The HTTP status in uploadFile's error, or the network message
function failureCode(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  return /failed: (\d{3}) /.exec(e.message)?.[1] ?? e.message
}

const files     = ref<MediaFile[]>([])
const loading   = ref(false)
const uploading = ref(false)
const error     = ref<string | null>(null)

//Only the latest call writes the list
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading.value = true
  error.value = null
  try {
    const list = await apiJson<MediaFile[]>("GET", "/api/files")
    if (seq === loadSeq) files.value = list
  } catch (e) {
    reportFailure(e, "GET /api/files")
    if (seq !== loadSeq) return
    error.value = e instanceof Error ? e.message : String(e)
    listed = null
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

//The list once per page load, then only reloads after a change
let listed: Promise<void> | null = null
let stopSaveWatch: WatchStopHandle | null = null

function ensureLoaded(): Promise<void> {
  listed ??= load()
  //A save changes what uses each file
  stopSaveWatch ??= watch(usePortfolio().data, () => { void load() })
  return listed
}

//THE PROJECT BEING EDITED, set by the project page: the folder of pickers
//whose caller names no project (the block editors). null = shared.
const currentProject = ref<number | null>(null)

function setMediaProject(id: number | null) {
  currentProject.value = id
}

//Uploads one after the other into the project's folder (null = shared). A
//failed file does not stop the others: one toast lists the failures. Answers
//the new rows, as listed by the server.
async function upload(list: File[], project: number | null): Promise<MediaFile[]> {
  if (!list.length) return []
  uploading.value = true
  const ids: string[] = []
  const failed: string[] = []
  try {
    for (const f of list) {
      try {
        ids.push((await uploadFile(f, withProject("/api/files", project))).id)
      } catch (e) {
        console.error(`[media] upload of ${f.name} failed:`, e)
        failed.push(`${f.name} (${failureCode(e)})`)
      }
    }
  } finally {
    uploading.value = false
  }
  if (failed.length) {
    toast.error(failed.join(", "), t("mediaUploadCount").replace("{ok}", String(ids.length)).replace("{total}", String(list.length)))
  }
  await load()
  return ids.map((id) => files.value.find((f) => f.id === id)).filter((f): f is MediaFile => Boolean(f))
}

async function remove(file: MediaFile): Promise<void> {
  await apiJson("DELETE", `/api/files/${file.id}`)
  files.value = files.value.filter((f) => f.id !== file.id)
}

function storage(project: number | null): Promise<StorageSummary> {
  return apiJson<StorageSummary>("GET", withProject("/api/files/storage", project))
}

//deletes the unused rows and the bytes no row names, in the project's folder or everywhere
async function sweepOrphans(project: number | null): Promise<SweepResult> {
  const result = await apiJson<SweepResult>("DELETE", withProject("/api/files/orphans", project))
  await load()
  return result
}

//PICK REQUEST - like useConfirm: one open request, settled by the dialog
interface PickRequest {
  accept:   MediaType | null
  multiple: boolean
  //picking inside a project: its files and the shared ones, uploads go to its folder
  project:  number | null
}

const request = shallowRef<PickRequest | null>(null)
let settle: ((picked: MediaFile[]) => void) | null = null

//resolves with the chosen files, or [] when the dialog is dismissed
function pickMedia(opts: { accept?: MediaType; multiple?: boolean; project?: number | null } = {}): Promise<MediaFile[]> {
  settle?.([])
  const project = opts.project === undefined ? currentProject.value : opts.project
  request.value = { accept: opts.accept ?? null, multiple: opts.multiple ?? false, project }
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
    load, ensureLoaded, upload, remove, storage, sweepOrphans,
    setMediaProject,
    request, pickMedia,
    resolvePick: finish,
    cancelPick:  () => finish([]),
  }
}

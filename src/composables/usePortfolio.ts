import { ref } from "vue"
import { useToast } from "./useToast"
import { receiveSavedTheme } from "./useTheme"
import type { PortfolioDto } from "../types/portfolio"

//SHARED portfolio state - one fetch per page load, cached in module scope so
//every section component reads the same ref. No silent fallback: on error we
//set `error` and surface it via console.error (per project rule #4).
//
//Mutation helpers wrap the admin API and re-fetch the whole portfolio after a
//successful write, so the next render reflects DB truth.

const data    = ref<PortfolioDto | null>(null)
const loading = ref(false)
const loaded  = ref(false)
const error   = ref<string | null>(null)

let inFlight: Promise<void> | null = null

//HOW MANY CARDS THE SKELETON SHOULD DRAW. Not a user preference and not a row in
//the settings table, so localStorage is the right place: it is a note about what
//this browser saw last time, and it is read before any request goes out. A
//missing or unreadable value just means the defaults below.
const SECTION_COUNTS_KEY = "portfolio_section_counts"
const DEFAULT_SECTION_COUNTS = { projects: 2, gallery: 6, experiences: 3 }

export type SectionCounts = typeof DEFAULT_SECTION_COUNTS

export function lastSectionCounts(): SectionCounts {
  try {
    const raw = localStorage.getItem(SECTION_COUNTS_KEY)
    if (!raw) return DEFAULT_SECTION_COUNTS
    const saved = JSON.parse(raw) as Partial<SectionCounts>
    return {
      projects:    saved.projects    ?? DEFAULT_SECTION_COUNTS.projects,
      gallery:     saved.gallery     ?? DEFAULT_SECTION_COUNTS.gallery,
      experiences: saved.experiences ?? DEFAULT_SECTION_COUNTS.experiences,
    }
  } catch (e) {
    //a private window or blocked storage is not a failure worth a toast, but it
    //should not be invisible either
    console.warn("[usePortfolio] could not read the last section counts:", e)
    return DEFAULT_SECTION_COUNTS
  }
}

function rememberSectionCounts(portfolio: PortfolioDto | null) {
  if (!portfolio) return
  try {
    localStorage.setItem(SECTION_COUNTS_KEY, JSON.stringify({
      projects:    portfolio.mainProjects.length,
      gallery:     portfolio.galleryProjects.length,
      experiences: portfolio.experiences.length,
    }))
  } catch (e) {
    console.warn("[usePortfolio] could not store the section counts:", e)
  }
}

async function fetchPortfolio() {
  if (loading.value) return inFlight ?? Promise.resolve()
  loading.value = true
  error.value = null

  inFlight = (async () => {
    try {
      const res = await fetch("/api/portfolio", { credentials: "include" })
      if (!res.ok) throw new Error(`/api/portfolio returned ${res.status}`)
      const portfolio: PortfolioDto = await res.json()
      data.value = portfolio
      receiveSavedTheme(portfolio.theme)
      loaded.value = true
      rememberSectionCounts(data.value)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error("[usePortfolio] fetch failed:", msg)
    } finally {
      loading.value = false
      inFlight = null
    }
  })()

  return inFlight
}

async function reload() {
  loaded.value = false
  await fetchPortfolio()
}

//ADMIN API. Every write funnels through apiJson / uploadFile, which toast the
//server's own reason and throw, so no call site can swallow a failed write.
const toast = useToast()

//the server answers { error } on a refusal; a plain text body is shown as is
async function failureReason(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown }
    const reason = body.error ?? body.message
    if (typeof reason === "string" && reason) return reason
  } catch {
    //not JSON: the text itself is the reason
  }
  return text || res.statusText
}

export async function apiJson<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const reason = await failureReason(res)
    toast.error(reason, `${method} ${path} (${res.status})`)
    throw new Error(`${method} ${path} -> ${res.status} ${reason}`)
  }
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

export interface UploadedFile {
  id:               string
  url:              string
  originalFilename: string
  mimeType:         string
}

//path: the CV has a route of its own (PDF only, attached to the profile on arrival)
export async function uploadFile(file: File, path = "/api/files"): Promise<UploadedFile> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(path, { method: "POST", credentials: "include", body: fd })
  if (!res.ok) {
    const reason = await failureReason(res)
    toast.error(reason, `${file.name} (${res.status})`)
    throw new Error(`upload of ${file.name} failed: ${res.status} ${reason}`)
  }
  return res.json()
}

//MAIN PROJECT mutations
async function updateMainProject(id: number, patch: Record<string, unknown>) { await apiJson("PUT", `/api/main-project/${id}`, patch); await reload() }

//SOFTWARE mutations - create is multipart (logo + key + url in one request)
async function createSoftware(logo: File, key: string, url: string) {
  const fd = new FormData()
  fd.append("logo", logo)
  fd.append("key", key)
  fd.append("url", url)
  const res = await fetch("/api/software", { method: "POST", credentials: "include", body: fd })
  if (!res.ok) {
    const reason = await failureReason(res)
    toast.error(reason, `POST /api/software (${res.status})`)
    throw new Error(`POST /api/software -> ${res.status} ${reason}`)
  }
  await reload()
}

async function updateSoftware(id: number, patch: Record<string, unknown>) { await apiJson("PUT", `/api/software/${id}`, patch); await reload() }
async function deleteSoftware(id: number) { await apiJson("DELETE", `/api/software/${id}`); await reload() }

//3D MODEL mutations - both files are already in the file table (picked from
//the media library). The server optimizes the GLB and answers how it went;
//the views come from the editor's auto setup on first open.
export interface CreatedModel {
  id:             string
  optimizeReport: { bytesBefore: number; bytesAfter: number; triangles: number; textures: number } | null
  optimizeError:  string | null
}

async function createModel(name: string, glbFileId: string, thumbnailFileId: string): Promise<CreatedModel> {
  const row = await apiJson<CreatedModel>("POST", "/api/models", { name, glbFileId, thumbnailFileId })
  await reload()
  return row
}
async function deleteModel(id: string) { await apiJson("DELETE", `/api/models/${id}`); await reload() }

export function usePortfolio() {
  if (typeof window !== "undefined" && !loaded.value && !loading.value) {
    void fetchPortfolio()
  }
  return {
    data, loading, loaded, error, reload,
    updateMainProject,
    createSoftware, updateSoftware, deleteSoftware,
    createModel, deleteModel,
  }
}

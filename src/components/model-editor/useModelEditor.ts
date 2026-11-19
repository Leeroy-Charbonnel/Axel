import { computed, ref, shallowRef } from "vue"
import { VIEWER_DEFAULTS, VIEWER_PREF_KEYS } from "../../lib/viewer-defaults"
import { applyEditorPrefs } from "../../composables/useEffectiveViewerSettings"
import { apiJson, usePortfolio } from "../../composables/usePortfolio"
import { useSettings } from "../../composables/useSettings"
import { useToast } from "../../composables/useToast"
import type { AutoSetup } from "../../three/autoSetup"
import type { MaterialSlot, ModelViewer } from "../../three/modelViewer"
import type { MaterialState, ViewerMode, ViewerSettings, WireframeMaterialParams } from "../../three/types"
import type { EditorPrefsDto, Model3dView } from "../../types/portfolio"
import { stableJson } from "./autoSettings"
import type { LightPick } from "./lightGizmo"

//THE MODEL EDITOR'S STATE, module scoped: one editor page at a time. One
//document holds everything the page saves (the model's viewer settings, its
//camera bookmarks, the global wireframe prefs); every edit goes through
//change(), which records one undo step, and save() writes what differs from
//the last saved copy. The viewer previews the document as visitors will see it.

export interface ModelRow {
  id:              string
  name:            string
  glbUrl:          string | null
  sourceGlbFileId: string | null
  viewerSettings:  ViewerSettings | null
  views:           Model3dView[]
}

//shared by every model on the site: the public viewer layers them over each model
export interface GlobalPrefs {
  modeColor: string
  lineWidth: number
  material:  WireframeMaterialParams
}

export interface EditorDoc {
  settings: ViewerSettings
  views:    Model3dView[]
  prefs:    GlobalPrefs
}

export type PanelKey = "scene" | "lights" | "materials" | "wireframe" | "model"
export const PANELS: PanelKey[] = ["scene", "lights", "materials", "wireframe", "model"]

//the viewport fills its space, or shows the frame of a desktop or phone viewer
export type FrameKind = "free" | "desktop" | "phone"

//typing in one control within this window is one undo step
const COALESCE_MS   = 800
const HISTORY_LIMIT = 100

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same  = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)

const emptyPrefs = (): GlobalPrefs => ({
  modeColor: VIEWER_DEFAULTS.wireframeModeColor,
  lineWidth: VIEWER_DEFAULTS.wireframeLineWidth,
  material:  { ...VIEWER_DEFAULTS.wireframeMaterial },
})

const model   = shallowRef<ModelRow | null>(null)
const doc     = ref<EditorDoc>({ settings: {}, views: [], prefs: emptyPrefs() })
const saved   = shallowRef<EditorDoc>(clone(doc.value))
const past    = shallowRef<EditorDoc[]>([])
const future  = shallowRef<EditorDoc[]>([])
let lastChange = { key: "", at: 0 }

//filled by the viewport once the model is on screen
const viewer = shallowRef<ModelViewer | null>(null)
const setup  = shallowRef<AutoSetup | null>(null)
const slots  = shallowRef<MaterialSlot[]>([])
const meshNames = shallowRef<string[]>([])

const panel   = ref<PanelKey>("scene")
const frame   = ref<FrameKind>("free")
const preview = ref<ViewerMode>("render")
//the light, or the target of a light, that carries the move arrows
const selectedLight = ref<LightPick | null>(null)
//clicks in the viewport pick emissive meshes
const picking = ref(false)

const dirty   = computed(() => !same(doc.value, saved.value))
const canUndo = computed(() => past.value.length > 0)
const canRedo = computed(() => future.value.length > 0)

const toast = useToast()

//what the public viewer would apply: the model settings under the global prefs
function prefsDto(p: GlobalPrefs): EditorPrefsDto {
  return {
    //no longer a shared setting: each model has its own line colour
    wireframeLineColor: null,
    wireframeModeColor: p.modeColor,
    wireframeMaterial:  JSON.stringify(p.material),
    wireframeLineWidth: String(p.lineWidth),
  }
}
const effective = computed<ViewerSettings>(() => applyEditorPrefs(doc.value.settings, prefsDto(doc.value.prefs)))

//A pref that was never saved shows what the viewer uses today: the model's own
//value, else the default.
function prefsFrom(dto: EditorPrefsDto | undefined, settings: ViewerSettings): GlobalPrefs {
  const wf = settings.wireframeMode ?? {}
  const base = emptyPrefs()
  let material = wf.material ?? base.material
  if (dto?.wireframeMaterial) {
    try {
      material = JSON.parse(dto.wireframeMaterial) as WireframeMaterialParams
    } catch (e) {
      console.warn("[model-editor] malformed editor3d_wireframe_material pref, showing the model's value:", e)
    }
  }
  const width = Number(dto?.wireframeLineWidth)
  return {
    modeColor: dto?.wireframeModeColor ?? wf.color ?? base.modeColor,
    lineWidth: Number.isFinite(width) && width > 0 ? width : wf.overlayLineWidth ?? base.lineWidth,
    material,
  }
}

function resetHistory() {
  past.value = []
  future.value = []
  lastChange = { key: "", at: 0 }
}

//Throws with the server's reason when the model cannot be read.
async function open(id: string): Promise<ModelRow> {
  const portfolio = usePortfolio()
  if (!portfolio.loaded.value) await portfolio.reload()
  const row = await apiJson<ModelRow>("GET", `/api/models/${id}`)
  model.value = row
  //startView and startViewMobile were the old editor's camera; projects pick
  //named views now and the viewer never reads them
  const { startView: _view, startViewMobile: _mobile, ...settings } = (row.viewerSettings ?? {}) as ViewerSettings & { startViewMobile?: unknown }
  //it also matched materials by a uuid that changes on every load
  if (settings.materials) {
    settings.materials = settings.materials
      .filter((m) => m.name || m.index !== undefined)
      .map(({ uuid: _uuid, ...m }: MaterialState & { uuid?: string }) => m)
  }
  doc.value = { settings, views: row.views ?? [], prefs: prefsFrom(portfolio.data.value?.editorPrefs, settings) }
  saved.value = clone(doc.value)
  resetHistory()
  viewer.value = null
  setup.value = null
  slots.value = []
  meshNames.value = []
  panel.value = "scene"
  preview.value = "render"
  selectedLight.value = null
  picking.value = false
  return row
}

//One undo step per call, or per burst of calls with the same key. held: the
//same key is one step however long it lasts (a drag).
function change(key: string, mutate: (d: EditorDoc) => void, held = false) {
  const now = Date.now()
  if (!(lastChange.key === key && (held || now - lastChange.at < COALESCE_MS))) {
    past.value = [...past.value, clone(doc.value)].slice(-HISTORY_LIMIT)
    future.value = []
  }
  lastChange = { key, at: now }
  const next = clone(doc.value)
  mutate(next)
  doc.value = next
}

function undo() {
  const prev = past.value[past.value.length - 1]
  if (!prev) return
  future.value = [...future.value, clone(doc.value)]
  past.value = past.value.slice(0, -1)
  doc.value = prev
  lastChange = { key: "", at: 0 }
}

function redo() {
  const next = future.value[future.value.length - 1]
  if (!next) return
  past.value = [...past.value, clone(doc.value)]
  future.value = future.value.slice(0, -1)
  doc.value = next
  lastChange = { key: "", at: 0 }
}

function discard() {
  doc.value = clone(saved.value)
  resetHistory()
}

const PREF_ROWS: { key: string; value: (p: GlobalPrefs) => string; description: string }[] = [
  { key: VIEWER_PREF_KEYS.modeColor,      value: (p) => p.modeColor,                description: "Wireframe mode color (shared across every model)." },
  { key: VIEWER_PREF_KEYS.lineWidth,      value: (p) => String(p.lineWidth),        description: "Wireframe line thickness in pixels (shared across every model)." },
  { key: VIEWER_PREF_KEYS.materialParams, value: (p) => JSON.stringify(p.material), description: "Wireframe material (color, metalness, roughness, env, specular)." },
]

//Writes what changed since the last save. Throws on the first refusal, which
//has toasted its reason; the document stays dirty and keeps its history.
async function save() {
  const row = model.value
  if (!row) throw new Error("no model is open")
  const next = clone(doc.value)
  const before = saved.value
  if (!same(next.settings, before.settings)) {
    await apiJson("PUT", `/api/models/${row.id}/viewer-settings`, next.settings)
    saved.value = { ...saved.value, settings: next.settings }
  }
  if (!same(next.views, before.views)) {
    await apiJson("PUT", `/api/models/${row.id}`, { views: next.views })
    saved.value = { ...saved.value, views: next.views }
  }
  const { update } = useSettings()
  for (const pref of PREF_ROWS) {
    const value = pref.value(next.prefs)
    if (value === pref.value(before.prefs)) continue
    try {
      await update(pref.key, value, { type: "string", group: "editor3d", description: pref.description })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), pref.key)
      throw e
    }
  }
  saved.value = next
}

//STRUCTURAL - the model's file changes at once, outside the document
function setGlb(glbUrl: string, sourceGlbFileId: string | null) {
  if (!model.value) return
  model.value = { ...model.value, glbUrl, sourceGlbFileId }
}

export function useModelEditor() {
  return {
    model, doc, saved, effective, dirty, canUndo, canRedo,
    viewer, setup, slots, meshNames,
    panel, frame, preview, selectedLight, picking,
    open, change, undo, redo, discard, save, setGlb,
  }
}

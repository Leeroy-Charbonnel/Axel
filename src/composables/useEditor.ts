import { computed, ref, shallowRef, watch, type Ref } from "vue"
import { usePortfolio, apiJson } from "./usePortfolio"
import { useToast } from "./useToast"
import { useConfirm } from "./useConfirm"
import { useTranslations } from "./useTranslations"
import { useLang } from "./useLang"
import { useTheme } from "./useTheme"
import { type Lang } from "../lib/lang"
import type { ThemeVars } from "../lib/theme-vars"
import { KINDS, entityKey, type DraftOf, type EntityId, type EntityKind, type EntityOf } from "../components/admin/entities"

export type { DraftOf, EntityId, EntityKind, EntityOf }

//THE EDITING MODEL. One edit mode, one set of drafts, one explicit save.
//Edits never write to the server directly: they patch a draft per entity, the
//page renders display(kind, entity) so the draft shows at once, and saveAll()
//sends one partial PUT per dirty entity. A failed PUT keeps its draft and
//toasts the server's reason. Creating, deleting and reordering items are
//structural and go to the server immediately.

interface DraftEntry {
  kind:  EntityKind
  id:    EntityId
  patch: Record<string, unknown>
}
type Drafts = Record<string, DraftEntry>

//One undo step: the drafts and the theme draft
interface Snapshot {
  drafts: Drafts
  theme:  ThemeVars
}

export interface Selection {
  kind: EntityKind
  id:   EntityId
}

//a page with state of its own (detail page, 3D editor) plugs into the edit bar
export interface PageActions {
  save:     () => Promise<void>
  discard:  () => void
  dirty:    Readonly<Ref<boolean>>
  undo?:    () => void
  redo?:    () => void
  canUndo?: Readonly<Ref<boolean>>
  canRedo?: Readonly<Ref<boolean>>
}

//typing in one field within this window is one undo step
const COALESCE_MS   = 800
const HISTORY_LIMIT = 100
//History key of the theme edits, and the field of a reset of every token
const THEME_KEY      = "theme"
const ALL_THEME_VARS = "*"

const editMode  = ref(false)
const siteLang  = useLang()
//The language being edited is the site's language: switching one switches the other
const editLang  = computed<Lang>({
  get: () => siteLang.lang.value,
  set: (l) => { void siteLang.setLang(l) },
})
const selection = shallowRef<Selection | null>(null)
//bumped when a keyboard selection should move focus into the inspector
const focusTick = ref(0)
const drafts    = ref<Drafts>({})
const past      = shallowRef<Snapshot[]>([])
const future    = shallowRef<Snapshot[]>([])
const saving    = ref(false)
const pageActions = shallowRef<PageActions | null>(null)
let lastPatch = { key: "", fields: "", at: 0 }

const portfolio = usePortfolio()
const toast     = useToast()
const theme     = useTheme()
const { confirm } = useConfirm()
const { t }     = useTranslations()

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
//Object keys sorted, so {fr, en} and {en, fr} compare equal
const sortedKeys = (_key: string, v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)))
    : v
const same  = (a: unknown, b: unknown) => JSON.stringify(a, sortedKeys) === JSON.stringify(b, sortedKeys)

function find<K extends EntityKind>(kind: K, id: EntityId): EntityOf[K] | null {
  const data = portfolio.data.value
  if (!data) return null
  const def = KINDS[kind]
  return def.list(data).find((e) => def.idOf(e) === id) ?? null
}

//HISTORY - whole-draft snapshots: drafts are small and this cannot drift
function current(): Snapshot {
  return { drafts: clone(drafts.value), theme: theme.snapshot() }
}

function restore(snapshot: Snapshot) {
  drafts.value = snapshot.drafts
  theme.restore(snapshot.theme)
}

function pushHistory() {
  past.value = [...past.value, current()].slice(-HISTORY_LIMIT)
  future.value = []
}

//One undo step per field; quick edits of the same field join it
function record(key: string, fields: string) {
  const now = Date.now()
  const coalesce = lastPatch.key === key && lastPatch.fields === fields && now - lastPatch.at < COALESCE_MS
  if (!coalesce) pushHistory()
  lastPatch = { key, fields, at: now }
}

function resetHistory() {
  past.value = []
  future.value = []
  lastPatch = { key: "", fields: "", at: 0 }
}

//out of the drafts and out of every snapshot: an undo must not bring back a
//draft whose entity is gone, its save would 404 forever
function forget(key: string) {
  delete drafts.value[key]
  const strip = (list: Snapshot[]) => list.map((snapshot) => {
    if (!(key in snapshot.drafts)) return snapshot
    const copy = { ...snapshot.drafts }
    delete copy[key]
    return { ...snapshot, drafts: copy }
  })
  past.value = strip(past.value)
  future.value = strip(future.value)
}

//every draft, current or in the history, whose entity the fresh data lacks
function forgetMissing() {
  if (!portfolio.data.value) return
  const entries = new Map<string, DraftEntry>()
  for (const snapshot of [drafts.value, ...[...past.value, ...future.value].map((step) => step.drafts)]) {
    for (const [key, entry] of Object.entries(snapshot)) entries.set(key, entry)
  }
  for (const [key, entry] of entries) {
    if (!find(entry.kind, entry.id)) forget(key)
  }
}

//drop the fields that equal the saved entity, and the draft once it is empty
function prune(key: string) {
  const entry = drafts.value[key]
  if (!entry) return
  const source = find(entry.kind, entry.id) as Record<string, unknown> | null
  const linked = KINDS[entry.kind].linked
  for (const field of Object.keys(entry.patch)) {
    if (source && field in source && same(entry.patch[field], source[field])) delete entry.patch[field]
  }
  for (const [field, partner] of Object.entries(linked)) {
    if (!(partner in entry.patch)) delete entry.patch[field]
  }
  if (Object.keys(entry.patch).length === 0) delete drafts.value[key]
}

function patch<K extends EntityKind>(kind: K, id: EntityId, partial: DraftOf<K>) {
  const key = entityKey(kind, id)
  record(key, Object.keys(partial).sort().join(","))
  const entry = drafts.value[key] ?? { kind, id, patch: {} }
  entry.patch = { ...entry.patch, ...clone(partial) }
  drafts.value[key] = entry
  prune(key)
}

function draft<K extends EntityKind>(kind: K, id: EntityId): DraftOf<K> | null {
  return (drafts.value[entityKey(kind, id)]?.patch as DraftOf<K> | undefined) ?? null
}

function display<K extends EntityKind>(kind: K, entity: EntityOf[K]): EntityOf[K] {
  const entry = drafts.value[entityKey(kind, KINDS[kind].idOf(entity))]
  return entry ? { ...entity, ...entry.patch } as EntityOf[K] : entity
}

function isDirty(kind: EntityKind, id: EntityId): boolean {
  return entityKey(kind, id) in drafts.value
}

//THEME - its draft shares the undo history and the save
function setThemeVar(name: string, value: string) {
  record(THEME_KEY, name)
  theme.set(name, value)
}

function resetTheme() {
  record(THEME_KEY, ALL_THEME_VARS)
  theme.resetAll()
}

const draftCount = computed(() => Object.keys(drafts.value).length)
const pageActive = computed(() => pageActions.value !== null)
const pageDirty  = computed(() => pageActions.value?.dirty.value ?? false)
const dirty      = computed(() => draftCount.value > 0 || theme.dirty.value || pageDirty.value)
const canUndo    = computed(() => past.value.length > 0 || (pageActions.value?.canUndo?.value ?? false))
const canRedo    = computed(() => future.value.length > 0 || (pageActions.value?.canRedo?.value ?? false))
export type EditorStatus = "saved" | "dirty" | "saving"
const status = computed<EditorStatus>(() => saving.value ? "saving" : dirty.value ? "dirty" : "saved")

//the editor's own steps go first; the page's history takes over once they run out
function undo() {
  const prev = past.value[past.value.length - 1]
  if (prev) {
    future.value = [...future.value, current()]
    past.value = past.value.slice(0, -1)
    restore(prev)
    lastPatch = { key: "", fields: "", at: 0 }
    return
  }
  pageActions.value?.undo?.()
}

function redo() {
  const next = future.value[future.value.length - 1]
  if (next) {
    past.value = [...past.value, current()]
    future.value = future.value.slice(0, -1)
    restore(next)
    lastPatch = { key: "", fields: "", at: 0 }
    return
  }
  pageActions.value?.redo?.()
}

//True when the save worked; a failure is logged
async function trySave(what: string, run: () => Promise<void>): Promise<boolean> {
  try {
    await run()
    return true
  } catch (e) {
    console.error(`[editor] save of ${what} failed:`, e)
    return false
  }
}

//SAVE - every dirty entity in turn; whatever fails keeps its draft
async function saveAll(): Promise<boolean> {
  if (saving.value || !dirty.value) return true
  saving.value = true
  let failed = 0
  try {
    for (const entry of Object.values(drafts.value)) {
      if (!(await trySave(entityKey(entry.kind, entry.id), () => KINDS[entry.kind].save(entry.id, entry.patch as never)))) failed++
    }
    if (theme.dirty.value && !(await trySave(THEME_KEY, theme.save))) failed++
    const page = pageActions.value
    if (page?.dirty.value && !(await trySave("page", page.save))) failed++
    await portfolio.reload()
    //saved fields now equal the fresh data and fall away; failed ones stay, with their history
    for (const key of Object.keys(drafts.value)) prune(key)
    if (!failed) resetHistory()
  } finally {
    saving.value = false
  }
  if (failed) toast.error(t("editorSaveFailed").replace("{n}", String(failed)))
  return failed === 0
}

//confirmed before it runs, so it is final: no undo brings a discarded draft back
function discardAll() {
  drafts.value = {}
  theme.discard()
  resetHistory()
  pageActions.value?.discard()
}

//asks before throwing work away; true when nothing is pending any more
async function confirmDiscard(): Promise<boolean> {
  if (!dirty.value) return true
  const ok = await confirm({
    title:       t("editorDiscardTitle"),
    what:        t("editorDiscardWhat"),
    action:      t("editorDiscardAction"),
    destructive: true,
  })
  if (ok) discardAll()
  return ok
}

async function setEditMode(on: boolean): Promise<boolean> {
  if (on === editMode.value) return true
  if (!on && !(await confirmDiscard())) return false
  editMode.value = on
  if (!on) selection.value = null
  return true
}

function select(kind: EntityKind, id: EntityId, opts: { focus?: boolean } = {}) {
  selection.value = { kind, id }
  if (opts.focus) focusTick.value++
}

function clear() {
  selection.value = null
}

function isSelected(kind: EntityKind, id: EntityId): boolean {
  return selection.value?.kind === kind && selection.value.id === id
}

//STRUCTURAL OPERATIONS - immediate, outside the drafts
function collectionBase(kind: EntityKind): string {
  const collection = KINDS[kind].collection
  if (!collection) throw new Error(`${kind} is not a collection`)
  return collection.base
}

async function createItem(kind: EntityKind) {
  const row = await apiJson<{ id: number }>("POST", collectionBase(kind))
  await portfolio.reload()
  select(kind, row.id, { focus: true })
}

async function removeItem(kind: EntityKind, id: number) {
  await apiJson("DELETE", `${collectionBase(kind)}/${id}`)
  forget(entityKey(kind, id))
  if (isSelected(kind, id)) clear()
  await portfolio.reload()
}

//shows the new order at once, sends it, and re-reads the truth if it fails
async function reorder(kind: EntityKind, ids: number[]) {
  const data = portfolio.data.value
  if (!data) return
  const list = KINDS[kind].list(data) as Array<{ id: number }>
  const byId = new Map(list.map((e) => [e.id, e]))
  const next = ids.map((id) => byId.get(id)).filter((e): e is { id: number } => Boolean(e))
  list.splice(0, list.length, ...next)
  try {
    await apiJson("PUT", `${collectionBase(kind)}/order`, { ids })
  } catch (e) {
    console.error(`[editor] reorder of ${kind} failed:`, e)
    await portfolio.reload()
  }
}

async function move(kind: EntityKind, id: number, delta: -1 | 1) {
  const data = portfolio.data.value
  if (!data) return
  const ids = (KINDS[kind].list(data) as Array<{ id: number }>).map((e) => e.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  ids.splice(to, 0, ...ids.splice(from, 1))
  await reorder(kind, ids)
}

function registerPageActions(actions: PageActions): () => void {
  pageActions.value = actions
  return () => {
    if (pageActions.value === actions) pageActions.value = null
  }
}

//GLOBAL GUARDS - a reload or a closed tab with pending edits asks first, and
//the editor shortcuts work anywhere on the page while editing
const INSPECTOR_SELECTOR = "#editor-inspector"

//A form field; with editable, also a text typed in place
export function isTextTarget(target: EventTarget | null, opts: { editable: boolean }): boolean {
  if (!(target instanceof HTMLElement)) return false
  const field = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
  return field || (opts.editable && target.isContentEditable)
}

//Form fields keep their own undo, except the inspector's: they show the drafts
function usesEditorHistory(target: EventTarget | null): boolean {
  return !isTextTarget(target, { editable: false }) || (target as HTMLElement).closest(INSPECTOR_SELECTOR) !== null
}

function onKeydown(e: KeyboardEvent) {
  if (!editMode.value || e.isComposing || !(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === "s") {
    e.preventDefault()
    void saveAll()
    return
  }
  if ((k === "z" || k === "y") && usesEditorHistory(e.target)) {
    e.preventDefault()
    if (k === "y" || e.shiftKey) redo()
    else undo()
  }
}

//An undo or a redo picked from a menu instead of a key
function onBeforeInput(e: InputEvent) {
  const history = e.inputType === "historyUndo" || e.inputType === "historyRedo"
  if (!editMode.value || !history || !usesEditorHistory(e.target)) return
  e.preventDefault()
  if (e.inputType === "historyUndo") undo()
  else redo()
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  //older engines still need the legacy property set to show the prompt
  e.returnValue = ""
}

//a reload can lose an entity, deleted here or in another tab: its drafts go too
watch(portfolio.data, forgetMissing)

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onKeydown)
  window.addEventListener("beforeinput", onBeforeInput)
  window.addEventListener("beforeunload", onBeforeUnload)
}

export function useEditor() {
  return {
    editMode, editLang, selection, focusTick, saving, status, dirty, canUndo, canRedo,
    setEditMode, select, clear, isSelected,
    find, draft, patch, display, isDirty,
    setThemeVar, resetTheme,
    saveAll, discardAll, confirmDiscard, undo, redo,
    createItem, removeItem, reorder, move,
    registerPageActions, pageActive,
  }
}

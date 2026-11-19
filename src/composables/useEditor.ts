import { computed, ref, shallowRef, watch, type Ref } from "vue"
import { usePortfolio, apiJson } from "./usePortfolio"
import { useMediaLibrary } from "../components/admin/media/useMediaLibrary"
import { useToast } from "./useToast"
import { useConfirm } from "./useConfirm"
import { useTranslations } from "./useTranslations"
import { useLang } from "./useLang"
import { useTheme } from "./useTheme"
import { LANGS, type Lang } from "../lib/lang"
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

//Typed texts of the fixed labels of the site, by language then by key
type LabelDrafts = Record<Lang, Record<string, string>>

//One undo step: the drafts, the theme draft and the label drafts
interface Snapshot {
  drafts: Drafts
  theme:  ThemeVars
  labels: LabelDrafts
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
//History key of the label edits
const LABEL_KEY      = "label"

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
//The label of the inspector field whose text is being typed on the page
const activeField = ref<string | null>(null)
const drafts    = ref<Drafts>({})
const labelDrafts = ref<LabelDrafts>({ fr: {}, en: {} })
const past      = shallowRef<Snapshot[]>([])
const future    = shallowRef<Snapshot[]>([])
const saving    = ref(false)
const pageActions = shallowRef<PageActions | null>(null)
let lastPatch = { key: "", fields: "", at: 0 }

const portfolio = usePortfolio()
const toast     = useToast()
const theme     = useTheme()
const { confirm } = useConfirm()
const translations = useTranslations()
const { t }     = translations

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
  return { drafts: clone(drafts.value), theme: theme.snapshot(), labels: clone(labelDrafts.value) }
}

function restore(snapshot: Snapshot) {
  drafts.value = snapshot.drafts
  theme.restore(snapshot.theme)
  labelDrafts.value = snapshot.labels
}

//Selects the first item whose draft differs between two steps, so an undo shows what it changed
function revealChange(before: Drafts, after: Drafts) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key]?.patch, after[key]?.patch)) continue
    const entry = after[key] ?? before[key]!
    if (find(entry.kind, entry.id)) selection.value = { kind: entry.kind, id: entry.id }
    return
  }
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

//LABELS - the fixed texts of the site, in the language being edited
function label(key: string): string {
  return labelDrafts.value[editLang.value][key] ?? t(key)
}

//A text equal to the saved one drops its draft
function setLabel(key: string, text: string) {
  const lang = editLang.value
  record(LABEL_KEY, `${lang}:${key}`)
  const next = { ...labelDrafts.value[lang] }
  if (text === t(key)) delete next[key]
  else next[key] = text
  labelDrafts.value = { ...labelDrafts.value, [lang]: next }
}

function isLabelDirty(key: string): boolean {
  return key in labelDrafts.value[editLang.value]
}

const labelsDirty = computed(() => LANGS.some(({ code }) => Object.keys(labelDrafts.value[code]).length > 0))

//One request per language; the saved texts go to the page without a reload
async function saveLabels() {
  for (const { code } of LANGS) {
    const sent = labelDrafts.value[code]
    if (Object.keys(sent).length === 0) continue
    const saved = await apiJson<Record<string, string>>("PUT", "/api/translations", { lang: code, values: sent })
    translations.setSaved(code, saved)
    //A text typed during the request stays a draft
    const left = Object.fromEntries(Object.entries(labelDrafts.value[code]).filter(([key, text]) => sent[key] !== text))
    labelDrafts.value = { ...labelDrafts.value, [code]: left }
  }
}

const draftCount = computed(() => Object.keys(drafts.value).length)
const pageActive = computed(() => pageActions.value !== null)
const pageDirty  = computed(() => pageActions.value?.dirty.value ?? false)
//STRUCTURE - new order, removed and created items, all waiting for Save
interface ItemRef { kind: EntityKind; id: number }
const pendingOrder   = ref<Partial<Record<EntityKind, number[]>>>({})
const pendingRemoved = ref<ItemRef[]>([])
const pendingCreated = ref<ItemRef[]>([])
const structureDirty = computed(() =>
  Object.keys(pendingOrder.value).length > 0 || pendingRemoved.value.length > 0 || pendingCreated.value.length > 0)

const media = useMediaLibrary()
const dirty      = computed(() =>
  draftCount.value > 0 || theme.dirty.value || labelsDirty.value || pageDirty.value || structureDirty.value || media.filesDirty.value)
const canUndo    = computed(() => past.value.length > 0 || (pageActions.value?.canUndo?.value ?? false))
const canRedo    = computed(() => future.value.length > 0 || (pageActions.value?.canRedo?.value ?? false))
export type EditorStatus = "saved" | "dirty" | "saving"
const status = computed<EditorStatus>(() => saving.value ? "saving" : dirty.value ? "dirty" : "saved")

//the editor's own steps go first; the page's history takes over once they run out
function undo() {
  const prev = past.value[past.value.length - 1]
  if (prev) {
    const now = current()
    future.value = [...future.value, now]
    past.value = past.value.slice(0, -1)
    restore(prev)
    revealChange(now.drafts, prev.drafts)
    lastPatch = { key: "", fields: "", at: 0 }
    return
  }
  pageActions.value?.undo?.()
}

function redo() {
  const next = future.value[future.value.length - 1]
  if (next) {
    const now = current()
    past.value = [...past.value, now]
    future.value = future.value.slice(0, -1)
    restore(next)
    revealChange(now.drafts, next.drafts)
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
    if (structureDirty.value && !(await trySave("structure", saveStructure))) failed++
    for (const entry of Object.values(drafts.value)) {
      if (!(await trySave(entityKey(entry.kind, entry.id), () => KINDS[entry.kind].save(entry.id, entry.patch as never)))) failed++
    }
    if (theme.dirty.value && !(await trySave(THEME_KEY, theme.save))) failed++
    if (labelsDirty.value && !(await trySave(LABEL_KEY, saveLabels))) failed++
    const page = pageActions.value
    if (page?.dirty.value && !(await trySave("page", page.save))) failed++
    //Files go after the content, which may stop using them
    if (media.filesDirty.value && !(await trySave("files", media.commitDeletes))) failed++
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
  labelDrafts.value = { fr: {}, en: {} }
  resetHistory()
  pageActions.value?.discard()
  if (structureDirty.value) void discardStructure()
  if (media.filesDirty.value) void media.discardDeletes()
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
  activeField.value = null
}

function isSelected(kind: EntityKind, id: EntityId): boolean {
  return selection.value?.kind === kind && selection.value.id === id
}

//STRUCTURAL OPERATIONS - shown at once, sent by Save, undone by Discard
function collectionBase(kind: EntityKind): string {
  const collection = KINDS[kind].collection
  if (!collection) throw new Error(`${kind} is not a collection`)
  return collection.base
}

function liveList(kind: EntityKind): Array<{ id: number }> {
  const data = portfolio.data.value
  if (!data) throw new Error("[editor] no portfolio loaded")
  return KINDS[kind].list(data) as Array<{ id: number }>
}

//The row is made hidden; Save publishes it, Discard deletes it
async function createItem(kind: EntityKind) {
  const row = await apiJson<{ id: number }>("POST", collectionBase(kind))
  await portfolio.reload()
  pendingCreated.value = [...pendingCreated.value, { kind, id: row.id }]
  patch(kind, row.id, { published: true } as never)
  select(kind, row.id, { focus: true })
}

//Hidden from the page now, deleted on Save
async function removeItem(kind: EntityKind, id: number) {
  const list = liveList(kind)
  const index = list.findIndex((e) => e.id === id)
  if (index >= 0) list.splice(index, 1)
  forget(entityKey(kind, id))
  if (isSelected(kind, id)) clear()
  if (pendingCreated.value.some((c) => c.kind === kind && c.id === id)) {
    pendingCreated.value = pendingCreated.value.filter((c) => !(c.kind === kind && c.id === id))
    await apiJson("DELETE", `${collectionBase(kind)}/${id}`)
    return
  }
  pendingRemoved.value = [...pendingRemoved.value, { kind, id }]
}

//The new order shows at once and is sent on Save
async function reorder(kind: EntityKind, ids: number[]) {
  const list = liveList(kind)
  const byId = new Map(list.map((e) => [e.id, e]))
  const next = ids.map((id) => byId.get(id)).filter((e): e is { id: number } => Boolean(e))
  list.splice(0, list.length, ...next)
  pendingOrder.value = { ...pendingOrder.value, [kind]: ids }
}

//Fresh data from the server gets the pending order and removals back
function applyStructure() {
  if (!portfolio.data.value) return
  for (const [kind, ids] of Object.entries(pendingOrder.value) as [EntityKind, number[]][]) {
    const list = liveList(kind)
    const rank = (id: number) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i }
    list.sort((a, b) => rank(a.id) - rank(b.id))
  }
  for (const { kind, id } of pendingRemoved.value) {
    const list = liveList(kind)
    const index = list.findIndex((e) => e.id === id)
    if (index >= 0) list.splice(index, 1)
  }
}
watch(() => portfolio.data.value, applyStructure)

async function saveStructure() {
  for (const { kind, id } of pendingRemoved.value) await apiJson("DELETE", `${collectionBase(kind)}/${id}`)
  pendingRemoved.value = []
  for (const kind of Object.keys(pendingOrder.value) as EntityKind[]) {
    await apiJson("PUT", `${collectionBase(kind)}/order`, { ids: liveList(kind).map((e) => e.id) })
  }
  pendingOrder.value = {}
  pendingCreated.value = []
}

//Created rows are deleted, then the saved order and items come back
async function discardStructure() {
  const created = pendingCreated.value
  pendingCreated.value = []
  pendingRemoved.value = []
  pendingOrder.value = {}
  for (const { kind, id } of created) await apiJson("DELETE", `${collectionBase(kind)}/${id}`)
  await portfolio.reload()
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
//The Properties pane of the home panel
const INSPECTOR_SELECTOR = "#inspector-pane-props"

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

//The home page, where a click beside every item drops the selection
const PAGE_SELECTOR = ".portfolio"
const ITEM_SELECTOR = "[data-edit-key]"

function onClick(e: MouseEvent) {
  if (!editMode.value || !selection.value || !(e.target instanceof Element)) return
  if (e.target.closest(PAGE_SELECTOR) && !e.target.closest(ITEM_SELECTOR)) clear()
}

//Escape drops the selection, once no text box and no dialog takes the key
function onEscape(e: KeyboardEvent) {
  if (e.defaultPrevented || !selection.value || isTextTarget(e.target, { editable: true })) return
  if (document.querySelector("dialog[open]")) return
  e.preventDefault()
  clear()
}

function onKeydown(e: KeyboardEvent) {
  if (!editMode.value || e.isComposing) return
  if (e.key === "Escape") return onEscape(e)
  if (!(e.ctrlKey || e.metaKey)) return
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
  window.addEventListener("click", onClick)
  window.addEventListener("beforeinput", onBeforeInput)
  window.addEventListener("beforeunload", onBeforeUnload)
}

export function useEditor() {
  return {
    editMode, editLang, selection, focusTick, activeField, saving, status, dirty, canUndo, canRedo,
    setEditMode, select, clear, isSelected,
    find, draft, patch, display, isDirty,
    setThemeVar, resetTheme,
    label, setLabel, isLabelDirty,
    saveAll, discardAll, confirmDiscard, undo, redo,
    createItem, removeItem, reorder, move,
    registerPageActions, pageActive,
  }
}

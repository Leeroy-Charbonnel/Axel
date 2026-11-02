import { computed, ref, shallowRef, type Ref } from "vue"
import { usePortfolio, apiJson } from "./usePortfolio"
import { useToast } from "./useToast"
import { useConfirm } from "./useConfirm"
import { useTranslations } from "./useTranslations"
import { LANG_DEFAULT, type Lang } from "../lib/lang"
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

const editMode  = ref(false)
const editLang  = ref<Lang>(LANG_DEFAULT)
const selection = shallowRef<Selection | null>(null)
//bumped when a keyboard selection should move focus into the inspector
const focusTick = ref(0)
const drafts    = ref<Drafts>({})
const past      = shallowRef<Drafts[]>([])
const future    = shallowRef<Drafts[]>([])
const saving    = ref(false)
const pageActions = shallowRef<PageActions | null>(null)
let lastPatch = { key: "", fields: "", at: 0 }

const portfolio = usePortfolio()
const toast     = useToast()
const { confirm } = useConfirm()
const { t }     = useTranslations()

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same  = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function find<K extends EntityKind>(kind: K, id: EntityId): EntityOf[K] | null {
  const data = portfolio.data.value
  if (!data) return null
  const def = KINDS[kind]
  return def.list(data).find((e) => def.idOf(e) === id) ?? null
}

//HISTORY - whole-draft snapshots: drafts are small and this cannot drift
function pushHistory() {
  past.value = [...past.value, clone(drafts.value)].slice(-HISTORY_LIMIT)
  future.value = []
}

function resetHistory() {
  past.value = []
  future.value = []
  lastPatch = { key: "", fields: "", at: 0 }
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
  const key    = entityKey(kind, id)
  const fields = Object.keys(partial).sort().join(",")
  const now    = Date.now()
  const coalesce = lastPatch.key === key && lastPatch.fields === fields && now - lastPatch.at < COALESCE_MS
  if (!coalesce) pushHistory()
  lastPatch = { key, fields, at: now }

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

const draftCount = computed(() => Object.keys(drafts.value).length)
const pageActive = computed(() => pageActions.value !== null)
const pageDirty  = computed(() => pageActions.value?.dirty.value ?? false)
const dirty      = computed(() => draftCount.value > 0 || pageDirty.value)
const canUndo    = computed(() => past.value.length > 0 || (pageActions.value?.canUndo?.value ?? false))
const canRedo    = computed(() => future.value.length > 0 || (pageActions.value?.canRedo?.value ?? false))
export type EditorStatus = "saved" | "dirty" | "saving"
const status = computed<EditorStatus>(() => saving.value ? "saving" : dirty.value ? "dirty" : "saved")

//the editor's own steps go first; the page's history takes over once they run out
function undo() {
  const prev = past.value[past.value.length - 1]
  if (prev) {
    future.value = [...future.value, clone(drafts.value)]
    past.value = past.value.slice(0, -1)
    drafts.value = prev
    lastPatch = { key: "", fields: "", at: 0 }
    return
  }
  pageActions.value?.undo?.()
}

function redo() {
  const next = future.value[future.value.length - 1]
  if (next) {
    past.value = [...past.value, clone(drafts.value)]
    future.value = future.value.slice(0, -1)
    drafts.value = next
    lastPatch = { key: "", fields: "", at: 0 }
    return
  }
  pageActions.value?.redo?.()
}

//SAVE - every dirty entity in turn; whatever fails keeps its draft
async function saveAll(): Promise<boolean> {
  if (saving.value || !dirty.value) return true
  saving.value = true
  let failed = 0
  try {
    for (const entry of Object.values(drafts.value)) {
      try {
        await KINDS[entry.kind].save(entry.id, entry.patch as never)
      } catch (e) {
        failed++
        console.error(`[editor] save of ${entityKey(entry.kind, entry.id)} failed:`, e)
      }
    }
    const page = pageActions.value
    if (page?.dirty.value) {
      try {
        await page.save()
      } catch (e) {
        failed++
        console.error("[editor] page save failed:", e)
      }
    }
    await portfolio.reload()
    //saved fields now equal the fresh data and fall away; failed ones stay
    for (const key of Object.keys(drafts.value)) prune(key)
    resetHistory()
  } finally {
    saving.value = false
  }
  if (failed) toast.error(t("editorSaveFailed").replace("{n}", String(failed)))
  return failed === 0
}

function discardAll() {
  if (draftCount.value) pushHistory()
  drafts.value = {}
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
  delete drafts.value[entityKey(kind, id)]
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
function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))
}

function onKeydown(e: KeyboardEvent) {
  if (!editMode.value || !(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === "s") {
    e.preventDefault()
    void saveAll()
    return
  }
  if ((k === "z" || k === "y") && !isTextTarget(e.target)) {
    e.preventDefault()
    if (k === "y" || e.shiftKey) redo()
    else undo()
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  //older engines still need the legacy property set to show the prompt
  e.returnValue = ""
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onKeydown)
  window.addEventListener("beforeunload", onBeforeUnload)
}

export function useEditor() {
  return {
    editMode, editLang, selection, focusTick, saving, status, dirty, canUndo, canRedo,
    setEditMode, select, clear, isSelected,
    find, draft, patch, display, isDirty,
    saveAll, discardAll, confirmDiscard, undo, redo,
    createItem, removeItem, reorder, move,
    registerPageActions, pageActive,
  }
}

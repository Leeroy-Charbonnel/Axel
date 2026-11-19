<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from "vue"
import { useRoute } from "vue-router"
import { ArrowDown, ArrowUp, ChevronDown, Folder, GripVertical, Palette, SlidersHorizontal, Trash2, X } from "lucide-vue-next"
import ToggleField from "./fields/ToggleField.vue"
import EditLangSwitch from "./EditLangSwitch.vue"
import EditorTabs, { type EditorTab } from "./EditorTabs.vue"
import MediaBrowser from "./media/MediaBrowser.vue"
import ThemeEditor from "./theme/ThemeEditor.vue"
import ProfileForm from "./forms/ProfileForm.vue"
import MainProjectForm from "./forms/MainProjectForm.vue"
import GalleryItemForm from "./forms/GalleryItemForm.vue"
import ExperienceForm from "./forms/ExperienceForm.vue"
import LabelsForm from "./forms/LabelsForm.vue"
import { KINDS, entityKey, idOf, listOf, titleOf, type EntityKind } from "./entities"
import { useSortable, moveItem } from "./useSortable"
import { useEditor } from "../../composables/useEditor"
import { usePortfolio } from "../../composables/usePortfolio"
import { useConfirm } from "../../composables/useConfirm"
import { useTranslations } from "../../composables/useTranslations"
import { useInspectorResize } from "./useInspectorResize"

//THE INSPECTOR - the home page's edit panel, open for the whole edit mode
//(elsewhere only while an item is selected). Tabs: Properties (the selected
//entity's form, or the site labels when nothing is selected), Files (every file) and
//CSS (the site theme). A side panel above 1024px (the page makes room for it,
//see style.css), a bottom sheet below that can be folded: it opens folded,
//unfolds on a selected item and stays as it is while a text is typed in place.

const FORMS: Record<EntityKind, Component> = {
  profile:     ProfileForm,
  mainProject: MainProjectForm,
  galleryItem: GalleryItemForm,
  experience:  ExperienceForm,
}
const SHEET_QUERY = "(max-width: 1024px)"
const OPEN_CLASS   = "editor-inspector-open"
const FOLDED_CLASS = "editor-inspector-folded"

const editor = useEditor()
const { data } = usePortfolio()
const { confirm } = useConfirm()
const { t } = useTranslations()
const { selection, editLang } = editor
const route = useRoute()

type TabKey = "props" | "files" | "css"
const TABS: { key: TabKey; icon: Component; labelKey: string }[] = [
  { key: "props", icon: SlidersHorizontal, labelKey: "detailTabProps" },
  { key: "files", icon: Folder,            labelKey: "detailTabFiles" },
  { key: "css",   icon: Palette,           labelKey: "themeTab" },
]
const tab  = ref<TabKey>("props")
const tabs = computed<EditorTab<TabKey>[]>(() => TABS.map((tb) => ({ key: tb.key, icon: tb.icon, label: t(tb.labelKey) })))

const kind   = computed(() => selection.value?.kind ?? null)
const entity = computed(() => selection.value ? editor.find(selection.value.kind, selection.value.id) : null)
const shown  = computed(() => kind.value && entity.value ? editor.display(kind.value, entity.value) : null)
//The home page keeps the panel for the whole edit mode
const open   = computed(() => editor.editMode.value && (route.path === "/" || shown.value !== null))
const key    = computed(() => selection.value ? entityKey(selection.value.kind, selection.value.id) : "")
const title  = computed(() => kind.value && shown.value ? titleOf(kind.value, shown.value, editLang.value) || t("editorUntitled") : "")
const isCollection = computed(() => Boolean(kind.value && KINDS[kind.value].collection))
const published = computed(() => Boolean((shown.value as { published?: boolean } | null)?.published))

//the collection as the page shows it, drafts included
const items = computed(() => {
  if (!kind.value || !data.value || !isCollection.value) return []
  const k = kind.value
  return listOf(k, data.value).map((e) => ({ id: idOf(k, e) as number, title: titleOf(k, editor.display(k, e), editLang.value) || t("editorUntitled") }))
})
const index = computed(() => items.value.findIndex((i) => i.id === selection.value?.id))

const collapsed = ref(false)
const orderOpen = ref(false)
const heading   = ref<HTMLElement | null>(null)
const propsEl   = ref<HTMLElement | null>(null)
const orderList = ref<HTMLElement | null>(null)

const sortable = useSortable(orderList, (from, to) => {
  if (kind.value) void editor.reorder(kind.value, moveItem(items.value, from, to).map((i) => i.id))
})
const orderShown = computed(() => sortable.preview(items.value))

//an item deleted elsewhere (or a reload without it) closes the panel
watch([selection, data], () => {
  if (selection.value && data.value && !entity.value) editor.clear()
})

const panelEl = ref<HTMLElement | null>(null)
const resize = useInspectorResize(() => panelEl.value)

watch(open, async (isOpen) => {
  document.documentElement.classList.toggle(OPEN_CLASS, isOpen)
  if (!isOpen) return resize.stop()
  //The sheet covers most of a small screen: with nothing selected it opens folded
  collapsed.value = !selection.value
  await nextTick()
  resize.measure()
}, { immediate: true })
//The page keeps room under its end for the sheet, a folded one needs less
watch([open, collapsed], ([isOpen, folded]) => {
  document.documentElement.classList.toggle(FOLDED_CLASS, isOpen && folded)
}, { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove(OPEN_CLASS, FOLDED_CLASS))

//The text box of the page that has the keyboard
function typedText(): HTMLElement | null {
  const el = document.activeElement
  return el instanceof HTMLElement && el.isContentEditable && !panelEl.value?.contains(el) ? el : null
}

//The region of the selected item the admin is in; an item picked from the panel has its first one
function region(): HTMLElement | null {
  const regions = [...document.querySelectorAll<HTMLElement>(`[data-edit-key="${key.value}"]`)]
  const used = regions.find((el) => el.contains(document.activeElement))
  if (used) return used
  return typedText() ? null : regions[0] ?? null
}

//Where the item was selected on the page: scrolled to, and given the focus back
let origin: HTMLElement | null = null
watch(selection, () => { origin = selection.value ? region() : null })

//The field of the text being typed on the page, marked and scrolled into view
const LINKED_CLASS = "ed-field--linked"
let linked: Element | null = null
watch([editor.activeField, key], async ([field]) => {
  linked?.classList.remove(LINKED_CLASS)
  linked = null
  if (!field) return
  tab.value = "props"
  await nextTick()
  if (editor.activeField.value !== field) return
  linked = propsEl.value?.querySelector(`[data-field="${CSS.escape(field)}"]`) ?? null
  if (!linked) return
  linked.classList.add(LINKED_CLASS)
  linked.scrollIntoView({ block: "nearest", behavior: motion() })
})

function motion(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

//the selected item stays visible: beside the panel, or above the sheet; a text
//typed in place keeps only itself in view and leaves the sheet as it is
watch(key, async (next) => {
  if (!next) {
    collapsed.value = true
    return
  }
  tab.value = "props"
  const typed = typedText()
  if (!typed) collapsed.value = false
  await nextTick()
  const behavior = motion()
  if (typed) return typed.scrollIntoView({ block: "nearest", behavior })
  origin?.scrollIntoView({ block: window.matchMedia(SHEET_QUERY).matches ? "start" : "nearest", behavior })
})

watch(editor.focusTick, async () => {
  tab.value = "props"
  await nextTick()
  heading.value?.focus()
})

//Drops the selection; the home page keeps the panel open
function close() {
  const target = origin
  editor.clear()
  target?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented || !selection.value) return
  e.preventDefault()
  close()
}

function setPublished(value: boolean) {
  if (kind.value && selection.value) editor.patch(kind.value, selection.value.id, { published: value })
}

function move(delta: -1 | 1) {
  const id = selection.value?.id
  if (kind.value && typeof id === "number") void editor.move(kind.value, id, delta)
}

async function remove() {
  const id = selection.value?.id
  if (!kind.value || typeof id !== "number") return
  const ok = await confirm({
    title:       t("editorDeleteTitle").replace("{kind}", t(KINDS[kind.value].labelKey)),
    what:        title.value,
    action:      t("editorDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  try {
    await editor.removeItem(kind.value, id)
  } catch (e) {
    console.error("[inspector] delete failed:", e)
  }
}
</script>

<template>
  <Transition name="inspector">
    <aside
      v-if="open"
      id="editor-inspector"
      ref="panelEl"
      class="inspector ed-ui"
      :class="{ 'inspector--collapsed': collapsed }"
      :aria-label="t('editorInspector')"
      @keydown="onKeydown"
    >
      <div
        class="inspector__resize"
        role="separator"
        aria-orientation="vertical"
        aria-controls="editor-inspector"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="resize.percent.value"
        tabindex="0"
        :aria-label="t('editorResizePanel')"
        :title="t('editorResizePanel')"
        @pointerdown="resize.start"
        @keydown="resize.onKey"
        @focus="resize.measure"
      ></div>
      <button
        type="button"
        class="inspector__grab"
        :aria-expanded="!collapsed"
        :aria-label="collapsed ? t('editorExpand') : t('editorCollapse')"
        @click="collapsed = !collapsed"
      >
        <span class="inspector__grip"></span>
      </button>

      <EditorTabs v-model="tab" class="inspector__tabs" :tabs="tabs" :label="t('editorInspector')" id-prefix="inspector" keep rail>
        <template #end>
          <EditLangSwitch />
        </template>

        <template #props>
          <div v-if="kind && entity" ref="propsEl" class="inspector__props">
            <header class="inspector__head">
              <div class="inspector__titles">
                <span class="inspector__kind">
                  {{ t(KINDS[kind].labelKey) }}
                  <span v-if="selection && editor.isDirty(kind, selection.id)" class="inspector__dirty">{{ t('editorStatusDirty') }}</span>
                </span>
                <h2 ref="heading" class="inspector__title" tabindex="-1">{{ title }}</h2>
              </div>
              <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorClose')" :title="t('editorClose')" @click="close">
                <X :size="16" />
              </button>
            </header>

            <div v-if="isCollection" class="inspector__tools">
              <ToggleField :label="t('editorPublished')" :model-value="published" @update:model-value="setPublished" />
              <div class="inspector__tools-end">
                <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorMoveUp')" :title="t('editorMoveUp')" :disabled="index <= 0" @click="move(-1)">
                  <ArrowUp :size="14" />
                </button>
                <button
                  type="button"
                  class="ed-btn ed-btn--ghost ed-btn--icon"
                  :aria-label="t('editorMoveDown')"
                  :title="t('editorMoveDown')"
                  :disabled="index < 0 || index >= items.length - 1"
                  @click="move(1)"
                >
                  <ArrowDown :size="14" />
                </button>
                <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon ed-btn--danger" :aria-label="t('editorDeleteAction')" :title="t('editorDeleteAction')" @click="remove">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="inspector__body">
              <section v-if="isCollection" class="inspector__order">
                <button
                  type="button"
                  class="inspector__order-toggle"
                  :aria-expanded="orderOpen"
                  @click="orderOpen = !orderOpen"
                >
                  <span>{{ t('editorOrder') }} ({{ items.length }})</span>
                  <ChevronDown :size="14" class="inspector__chevron" :class="{ 'inspector__chevron--open': orderOpen }" />
                </button>
                <ol v-if="orderOpen" ref="orderList" class="inspector__order-list">
                  <li
                    v-for="(item, i) in orderShown"
                    :key="i"
                    class="inspector__order-item"
                    :class="{
                      'inspector__order-item--current': item.id === selection?.id,
                      'inspector__order-item--dragging': sortable.draggingIndex.value === i,
                    }"
                  >
                    <button
                      type="button"
                      class="ed-btn ed-btn--ghost ed-btn--icon"
                      :aria-label="`${t('fieldReorder')} ${item.title}`"
                      v-bind="sortable.handleProps(i)"
                    >
                      <GripVertical :size="14" />
                    </button>
                    <button type="button" class="inspector__order-title" @click="editor.select(kind, item.id)">
                      <span class="inspector__order-index">{{ String(i + 1).padStart(2, "0") }}</span>
                      <span>{{ item.title }}</span>
                    </button>
                  </li>
                </ol>
              </section>

              <component :is="FORMS[kind]" :key="key" :entity="entity" />
            </div>
          </div>
          <div v-else ref="propsEl" class="inspector__props">
            <header class="inspector__head">
              <div class="inspector__titles">
                <span class="inspector__kind">{{ t('editorSelectHint') }}</span>
                <h2 class="inspector__title">{{ t('labelsTitle') }}</h2>
              </div>
            </header>
            <div class="inspector__body">
              <LabelsForm />
            </div>
          </div>
        </template>

        <template #files>
          <MediaBrowser mode="manage" compact />
        </template>

        <template #css>
          <ThemeEditor />
        </template>
      </EditorTabs>
    </aside>
  </Transition>
</template>

<style scoped>
.inspector {
  position: fixed;
  top: 0;
  right: 0;
  bottom: var(--editor-bar-offset);
  z-index: var(--editor-z-inspector);
  display: flex;
  flex-direction: column;
  width: var(--editor-inspector-width);
  background-color: var(--editor-surface);
  border-left: var(--border-width) solid var(--editor-line);
}

.inspector__head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
  padding: var(--vsui-space-xs) var(--vsui-space-xs) var(--vsui-space-xs) var(--vsui-space-sm);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.inspector__grab { display: none; }

.inspector__tabs {
  flex: 1;
  min-height: 0;
}

/*Head and tools stay put, the form scrolls*/
.inspector__props {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/*The left edge, wider than the line it draws*/
.inspector__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(-1 * var(--vsui-space-xs));
  width: var(--vsui-space-sm);
  cursor: col-resize;
  touch-action: none;
}

.inspector__resize:hover,
.inspector__resize:focus-visible {
  outline: none;
  background: linear-gradient(to right,
    transparent calc(50% - var(--border-width)), var(--editor-accent) calc(50% - var(--border-width)),
    var(--editor-accent) calc(50% + var(--border-width)), transparent calc(50% + var(--border-width)));
}

:global(html.editor-resizing) { cursor: col-resize; user-select: none; }
:global(html.editor-resizing body) { transition: none; }

.inspector__titles {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.inspector__kind {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
}

.inspector__dirty { color: var(--editor-warning); }

.inspector__title {
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector__title:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.inspector__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-2xs) var(--vsui-space-xs) var(--vsui-space-2xs) var(--vsui-space-sm);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.inspector__tools-end {
  display: flex;
  gap: var(--vsui-space-2xs);
}

.inspector__body {
  container: editor / inline-size;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--vsui-space-sm);
}

/*ORDER LIST*/
.inspector__order {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  padding-bottom: var(--vsui-space-sm);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.inspector__order-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--editor-control);
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text);
  border-radius: var(--editor-radius);
}

.inspector__order-toggle:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.inspector__chevron { color: var(--editor-text-muted); transition: transform var(--transition-fast) ease; }
.inspector__chevron--open { transform: rotate(180deg); }

.inspector__order-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-2xs);
}

.inspector__order-item {
  display: flex;
  align-items: center;
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid transparent;
  border-radius: var(--editor-radius);
}

.inspector__order-item--current { border-color: var(--editor-accent-line); }
.inspector__order-item--dragging { border-color: var(--editor-accent); }

.inspector__order-title {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  flex: 1;
  min-width: 0;
  min-height: var(--editor-control);
  padding-right: var(--vsui-space-sm);
  font-size: var(--editor-fs);
  text-align: left;
  color: var(--editor-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector__order-title:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.inspector__order-index {
  font-size: var(--editor-fs-xs);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text-muted);
}

/*SHEET - tablet and phone*/
@media (max-width: 1024px) {
  /*The end of the page scrolls clear of the sheet, unfolded or folded*/
  :global(html.editor-editing.editor-inspector-open body) {
    padding-bottom: calc(var(--editor-bar-height) + var(--editor-sheet-height));
  }
  :global(html.editor-editing.editor-inspector-folded body) {
    padding-bottom: calc(var(--editor-bar-height) + var(--editor-control));
  }

  .inspector {
    top: auto;
    left: 0;
    width: auto;
    max-height: var(--editor-sheet-height);
    border-left: none;
    border-top: var(--border-width) solid var(--editor-line);
    box-shadow: var(--editor-shadow);
  }

  .inspector__resize { display: none; }

  .inspector__grab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--editor-control);
    flex-shrink: 0;
    border-bottom: var(--border-width) solid var(--editor-line-soft);
  }

  .inspector__grab:focus-visible { outline: none; box-shadow: var(--editor-focus); }

  .inspector__grip {
    width: var(--vsui-space-lg);
    height: var(--vsui-space-xs);
    border-radius: var(--border-radius-full);
    background-color: var(--editor-text-muted);
  }

  .inspector--collapsed .inspector__tabs { display: none; }

  .inspector__tools { padding-left: var(--vsui-space-sm); }
  .inspector__body  { padding: var(--vsui-space-sm); }
}

/*MOTION - slides in from its edge, nothing under reduced motion*/
.inspector-enter-active,
.inspector-leave-active { transition: transform var(--transition-slow) ease; }
.inspector-enter-from,
.inspector-leave-to { transform: translateX(100%); }

@media (max-width: 1024px) {
  .inspector-enter-from,
  .inspector-leave-to { transform: translateY(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .inspector-enter-active,
  .inspector-leave-active { transition: none; }
}
</style>

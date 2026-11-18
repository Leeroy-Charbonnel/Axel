<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from "vue"
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Trash2, X } from "lucide-vue-next"
import ToggleField from "./fields/ToggleField.vue"
import ProfileForm from "./forms/ProfileForm.vue"
import MainProjectForm from "./forms/MainProjectForm.vue"
import GalleryItemForm from "./forms/GalleryItemForm.vue"
import ExperienceForm from "./forms/ExperienceForm.vue"
import { KINDS, entityKey, idOf, listOf, titleOf, type EntityKind } from "./entities"
import { useSortable, moveItem } from "./useSortable"
import { useEditor } from "../../composables/useEditor"
import { usePortfolio } from "../../composables/usePortfolio"
import { useConfirm } from "../../composables/useConfirm"
import { useTranslations } from "../../composables/useTranslations"

//THE INSPECTOR - the form of the selected entity. A side panel above 1024px
//(the page makes room for it, see style.css), a bottom sheet below that can be
//folded to its header. The header carries what every item shares: kind, title,
//published, move, delete, and the order of its whole collection.

const FORMS: Record<EntityKind, Component> = {
  profile:     ProfileForm,
  mainProject: MainProjectForm,
  galleryItem: GalleryItemForm,
  experience:  ExperienceForm,
}
const SHEET_QUERY = "(max-width: 1024px)"

const editor = useEditor()
const { data } = usePortfolio()
const { confirm } = useConfirm()
const { t } = useTranslations()
const { selection, editLang } = editor

const kind   = computed(() => selection.value?.kind ?? null)
const entity = computed(() => selection.value ? editor.find(selection.value.kind, selection.value.id) : null)
const shown  = computed(() => kind.value && entity.value ? editor.display(kind.value, entity.value) : null)
const open   = computed(() => editor.editMode.value && shown.value !== null)
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
const orderList = ref<HTMLElement | null>(null)

const sortable = useSortable(orderList, (from, to) => {
  if (kind.value) void editor.reorder(kind.value, moveItem(items.value, from, to).map((i) => i.id))
})
const orderShown = computed(() => sortable.preview(items.value))

//an item deleted elsewhere (or a reload without it) closes the panel
watch([selection, data], () => {
  if (selection.value && data.value && !entity.value) editor.clear()
})

watch(open, (isOpen) => document.documentElement.classList.toggle("editor-inspector-open", isOpen), { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove("editor-inspector-open"))

function region(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-edit-key="${key.value}"]`)
}

//the selected item stays visible: beside the panel, or above the sheet
watch(key, async (next) => {
  if (!next) return
  collapsed.value = false
  await nextTick()
  const sheet = window.matchMedia(SHEET_QUERY).matches
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  region()?.scrollIntoView({ block: sheet ? "start" : "nearest", behavior: reduced ? "auto" : "smooth" })
})

watch(editor.focusTick, async () => {
  await nextTick()
  heading.value?.focus()
})

function close() {
  const target = region()
  editor.clear()
  target?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return
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
      v-if="open && kind && entity"
      class="inspector ed-ui"
      :class="{ 'inspector--collapsed': collapsed }"
      :aria-label="t('editorInspector')"
      @keydown="onKeydown"
    >
      <header class="inspector__head">
        <button
          type="button"
          class="inspector__grab"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? t('editorExpand') : t('editorCollapse')"
          @click="collapsed = !collapsed"
        >
          <span class="inspector__grip"></span>
        </button>
        <div class="inspector__titles">
          <span class="inspector__kind">
            {{ t(KINDS[kind].labelKey) }}
            <span v-if="selection && editor.isDirty(kind, selection.id)" class="inspector__dirty">{{ t('editorStatusDirty') }}</span>
          </span>
          <h2 ref="heading" class="inspector__title" tabindex="-1">{{ title }}</h2>
        </div>
        <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorClose')" @click="close">
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
  padding: var(--vsui-space-sm) var(--vsui-space-xs) var(--vsui-space-sm) var(--vsui-space-md);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.inspector__grab { display: none; }

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
  padding: var(--vsui-space-2xs) var(--vsui-space-xs) var(--vsui-space-2xs) var(--vsui-space-md);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.inspector__tools-end {
  display: flex;
  gap: var(--vsui-space-2xs);
}

.inspector__body {
  container: editor / inline-size;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-md);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--vsui-space-md);
}

/*ORDER LIST*/
.inspector__order {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  padding-bottom: var(--vsui-space-md);
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
  .inspector {
    top: auto;
    left: 0;
    width: auto;
    max-height: var(--editor-sheet-height);
    border-left: none;
    border-top: var(--border-width) solid var(--editor-line);
    box-shadow: var(--editor-shadow);
  }

  .inspector__head { padding-left: var(--vsui-space-xs); }

  .inspector__grab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--editor-control);
    height: var(--editor-control);
    flex-shrink: 0;
  }

  .inspector__grab:focus-visible { outline: none; box-shadow: var(--editor-focus); }

  .inspector__grip {
    width: var(--vsui-space-lg);
    height: var(--vsui-space-xs);
    border-radius: var(--border-radius-full);
    background-color: var(--editor-text-muted);
  }

  .inspector--collapsed .inspector__tools,
  .inspector--collapsed .inspector__body { display: none; }

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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Box } from "lucide-vue-next"
import { useBentoGrid } from "../../../composables/useBentoGrid"
import { useConfirm } from "../../../composables/useConfirm"
import { useEditor } from "../../../composables/useEditor"
import { usePortfolio } from "../../../composables/usePortfolio"
import { useTranslations } from "../../../composables/useTranslations"
import { phoneAuthored, type GridLayout } from "../../../lib/bento-layout"
import type { Lang } from "../../../lib/lang"
import { blockType, FILL_TYPES } from "./block-types"
import DetailBlockRenderer from "./DetailBlockRenderer.vue"
import BlockBorder from "./BlockBorder.vue"
import BlockPanel from "./BlockPanel.vue"
import type { DetailBlock, TextBlockContent, Viewer3dBlockContent } from "../../../types/portfolio"

//THE BENTO EDITOR - the canvas is drawn at the width a visitor sees (the
//public content width, or a phone), scaled down when the space beside the
//panel is narrower, so what is placed here is what the page will show.
//Two layouts: desktop (3 columns) and phone (mobileY / mobileH).

const blocks = defineModel<DetailBlock[]>("blocks", { required: true })
const props = defineProps<{
  lang:   Lang
  //closes the history step in progress, around every structural write
  commit: () => void
}>()

const { t } = useTranslations()
const { confirm } = useConfirm()
const editor = useEditor()
const { data } = usePortfolio()

const layout   = ref<GridLayout>("desktop")
const selectedId = ref<string | null>(null)
const editingId  = ref<string | null>(null)
const selected = computed(() => blocks.value.find((b) => b.id === selectedId.value) ?? null)
const authored = computed(() => phoneAuthored(blocks.value))

const stage  = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const blockEls = new Map<string, HTMLElement>()

function select(id: string | null) {
  selectedId.value = id
  if (id !== editingId.value) editingId.value = null
  if (!id) return
  editor.clear()
  //a block just added is not drawn yet, and may land off screen
  void nextTick(() => {
    const el = blockEls.get(id)
    if (!el) return
    el.focus({ preventScroll: true })
    const box = el.getBoundingClientRect()
    if (box.bottom < 0 || box.top > window.innerHeight) el.scrollIntoView({ block: "center" })
  })
}

const grid = useBentoGrid({ blocks, layout, grid: gridEl, select, commit: props.commit })

//an undo can take the selected block away
watch(blocks, (list) => {
  if (selectedId.value && !list.some((b) => b.id === selectedId.value)) select(null)
})
//the inspector and this panel share the right edge: one at a time
watch(editor.selection, (s) => { if (s) select(null) })

//SCALE - the canvas keeps its public width; the stage gives it what fits
const scale  = ref(1)
const stageH = ref(0)
let observer: ResizeObserver | null = null
function measure() {
  const s = stage.value, c = canvas.value
  if (!s || !c || !c.offsetWidth) return
  scale.value = Math.min(1, s.clientWidth / c.offsetWidth)
  stageH.value = c.offsetHeight * scale.value
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (stage.value) observer.observe(stage.value)
  if (canvas.value) observer.observe(canvas.value)
})
onBeforeUnmount(() => observer?.disconnect())

function cellStyle(id: string) {
  const r = grid.rects.value.get(id)
  if (!r) throw new Error(`[bento] block ${id} has no rect`)
  return { gridColumn: `${r.x + 1} / span ${r.w}`, gridRow: `${r.y + 1} / span ${r.h}` }
}

function blockLabel(b: DetailBlock): string {
  const r = grid.rects.value.get(b.id)!
  return t("detailBlockAria")
    .replace("{type}", t(blockType(b.type).labelKey))
    .replace("{x}", String(r.x + 1)).replace("{y}", String(r.y + 1))
    .replace("{w}", String(r.w)).replace("{h}", String(r.h))
}

function viewerThumb(b: DetailBlock): string | null {
  const id = (b.content as Viewer3dBlockContent).model3dId
  return data.value?.models.find((m) => m.id === id)?.thumbnailUrl ?? null
}

//INLINE TEXT - text, heading and quote are typed on the canvas, in the
//language the edit bar is set to
const inlineEl = ref<HTMLTextAreaElement | null>(null)
async function startInline(b: DetailBlock) {
  if (!blockType(b.type).inline) return
  select(b.id)
  editingId.value = b.id
  await nextTick()
  inlineEl.value?.focus()
}
function onInline(b: DetailBlock, value: string) {
  const c = b.content as TextBlockContent
  c.text = { ...c.text, [props.lang]: value }
}
function stopInline(refocus: boolean) {
  const id = editingId.value
  editingId.value = null
  if (refocus && id) blockEls.get(id)?.focus({ preventScroll: true })
}

async function removeSelected() {
  const b = selected.value
  if (!b) return
  const ok = await confirm({
    title:       t("editorDeleteTitle").replace("{kind}", t(blockType(b.type).labelKey)),
    action:      t("editorDeleteAction"),
    destructive: true,
  })
  if (ok) grid.removeBlock(b.id)
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}
function onBlockKeydown(e: KeyboardEvent, b: DetailBlock) {
  if (e.target !== e.currentTarget) return
  const arrow = ARROWS[e.key]
  if (arrow) {
    e.preventDefault()
    select(b.id)
    grid.nudge(b.id, arrow[0], arrow[1], e.shiftKey)
  } else if (e.key === "Enter") {
    e.preventDefault()
    if (blockType(b.type).inline) void startInline(b)
    else select(b.id)
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault()
    select(b.id)
    void removeSelected()
  } else if (e.key === "Escape") {
    select(null)
  }
}

function onBlockPointerDown(e: PointerEvent, b: DetailBlock) {
  if (editingId.value === b.id || e.button !== 0) return
  grid.startMove(e, b)
}

function setLayout(next: GridLayout) {
  layout.value = next
  void nextTick(measure)
}

async function resetPhone() {
  const ok = await confirm({ title: t("detailPhoneReset"), what: t("detailPhoneAuto"), action: t("detailPhoneResetAction") })
  if (ok) grid.resetPhone()
}
</script>

<template>
  <div class="bento">
    <div class="bento__toolbar">
      <div class="bento__tabs" role="radiogroup" :aria-label="t('detailLayoutLabel')">
        <button
          v-for="l in (['desktop', 'phone'] as const)"
          :key="l"
          type="button"
          role="radio"
          class="ed-btn"
          :class="{ 'ed-btn--active': layout === l }"
          :aria-checked="layout === l"
          @click="setLayout(l)"
        >{{ t(l === 'desktop' ? 'detailLayoutDesktop' : 'detailLayoutPhone') }}</button>
      </div>
      <span class="bento__scale">{{ t('detailPreviewScale').replace('{n}', String(Math.round(scale * 100))) }}</span>
      <template v-if="layout === 'phone'">
        <button v-if="authored" type="button" class="ed-btn ed-btn--ghost" @click="resetPhone">{{ t('detailPhoneReset') }}</button>
        <p v-else class="ed-hint bento__hint">{{ t('detailPhoneAuto') }}</p>
      </template>
    </div>

    <div ref="stage" class="bento__stage" :style="{ height: `${stageH}px` }">
      <div
        ref="canvas"
        class="bento__canvas"
        :class="{ 'bento__canvas--phone': layout === 'phone' }"
        :style="{ transform: `scale(${scale})` }"
      >
        <div
          ref="gridEl"
          class="bento__grid"
          :style="{ '--cols': grid.cols.value, '--rows': grid.rows.value }"
          @pointerdown.self="select(null)"
        >
          <div class="bento__ghost" aria-hidden="true">
            <span v-for="n in grid.cols.value * grid.rows.value" :key="n" class="bento__ghost-cell"></span>
          </div>

          <div
            v-for="b in blocks"
            :key="b.id"
            :ref="(el) => { if (el) blockEls.set(b.id, el as HTMLElement); else blockEls.delete(b.id) }"
            class="bento__block"
            :class="{
              'bento__block--fill': FILL_TYPES.has(b.type),
              'bento__block--selected': selectedId === b.id,
              'bento__block--dragging': grid.drag.value?.id === b.id && grid.drag.value.moved,
            }"
            :style="cellStyle(b.id)"
            role="button"
            tabindex="0"
            :aria-label="blockLabel(b)"
            :aria-pressed="selectedId === b.id"
            @pointerdown="onBlockPointerDown($event, b)"
            @dblclick="startInline(b)"
            @keydown="onBlockKeydown($event, b)"
          >
            <span class="bento__tag" aria-hidden="true">{{ t(blockType(b.type).labelKey) }}</span>

            <div v-if="editingId === b.id" class="bento__inline">
              <span class="bento__inline-lang">{{ t('detailInlineLang').replace('{lang}', lang.toUpperCase()) }}</span>
              <textarea
                :ref="(el) => (inlineEl = el as HTMLTextAreaElement | null)"
                class="bento__inline-input"
                :lang="lang"
                :value="(b.content as TextBlockContent).text[lang]"
                @input="onInline(b, ($event.target as HTMLTextAreaElement).value)"
                @blur="stopInline(false)"
                @keydown.escape.prevent="stopInline(true)"
              ></textarea>
            </div>

            <div v-else-if="b.type === 'viewer3d'" class="bento__viewer">
              <img v-if="viewerThumb(b)" :src="viewerThumb(b)!" alt="" class="bento__viewer-img" />
              <span class="bento__viewer-label">
                <Box :size="20" aria-hidden="true" />
                {{ (b.content as Viewer3dBlockContent).model3dId ? t('blockTypeViewer3d') : t('detailViewerPick') }}
              </span>
            </div>

            <div v-else class="bento__preview">
              <DetailBlockRenderer :block="b" :lang="lang" :mobile="layout === 'phone'" />
            </div>
            <BlockBorder :bstyle="b.style" />

            <span
              class="bento__resize"
              :title="t('detailResize')"
              aria-hidden="true"
              @pointerdown="grid.startResize($event, b)"
            ></span>
          </div>

          <div
            v-if="grid.phantom.value"
            class="bento__phantom"
            :style="{
              gridColumn: `${grid.phantom.value.x + 1} / span ${grid.phantom.value.w}`,
              gridRow: `${grid.phantom.value.y + 1} / span ${grid.phantom.value.h}`,
            }"
          >
            <component :is="blockType(grid.drag.value!.type).icon" :size="28" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>

    <BlockPanel
      :selected="selected"
      @add="grid.addBlock"
      @create="grid.startCreate"
      @remove="removeSelected"
    />
  </div>
</template>

<style scoped>
.bento {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.bento__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}
.bento__tabs { display: flex; gap: var(--spacing-xxs); }
.bento__scale {
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--editor-text-muted);
}
.bento__hint { flex-basis: 100%; }

/*clip, not hidden: a hidden box can still be scrolled by focus or
scrollIntoView, which would shift the canvas under its own toolbar*/
.bento__stage {
  position: relative;
  width: 100%;
  overflow: clip;
}
/*the desktop layout is never drawn narrower than a laptop: on a tablet or a
phone it is scaled down instead of squeezed*/
.bento__canvas {
  width: max(var(--detail-content-width), var(--detail-canvas-min));
  transform-origin: top left;
  --row: var(--detail-row-h);
  --gap: var(--detail-gap);
}
.bento__canvas--phone {
  width: var(--detail-phone-width);
  margin-inline: auto;
  --row: var(--detail-row-h-phone);
  --gap: var(--detail-gap-phone);
}
.bento__grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), minmax(var(--row), auto));
  gap: var(--gap);
  touch-action: none;
  user-select: none;
}
.bento__ghost {
  display: grid;
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
  pointer-events: none;
}
.bento__ghost-cell {
  border: var(--border-width) dashed var(--editor-text-muted);
  opacity: var(--detail-ghost-opacity);
}

.bento__block {
  position: relative;
  display: flex;
  min-width: 0;
  overflow: hidden;
  cursor: grab;
  outline: var(--border-width) dashed transparent;
  outline-offset: calc(-1 * var(--border-width));
  transition: outline-color var(--transition-fast) ease;
}
/*as on the public grid: media take the cell's size, text sets it*/
.bento__block--fill { contain: size; }
.bento__block:hover { outline-color: var(--editor-text-muted); }
.bento__block:focus-visible { outline: var(--editor-outline-width) solid hsl(var(--ring)); }
.bento__block--selected,
.bento__block--selected:hover {
  outline: var(--editor-outline-width) solid var(--editor-accent);
  outline-offset: calc(-1 * var(--editor-outline-width));
}
.bento__block--dragging { z-index: 2; cursor: grabbing; opacity: var(--vsui-disabled-opacity); }

.bento__tag {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  padding: var(--vsui-space-2xs) var(--spacing-xs);
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--editor-on-accent);
  background-color: var(--editor-accent);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast) ease;
}
.bento__block:hover .bento__tag,
.bento__block--selected .bento__tag,
.bento__block:focus-visible .bento__tag { opacity: 1; }

.bento__preview {
  display: flex;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.bento__viewer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--color-background-gray-50);
  pointer-events: none;
}
.bento__viewer-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: var(--vsui-disabled-opacity);
}
.bento__viewer-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.bento__inline {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  cursor: text;
}
.bento__inline-lang {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  padding: var(--vsui-space-2xs) var(--spacing-xs);
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  color: var(--editor-on-accent);
  background-color: var(--editor-accent);
}
.bento__inline-input {
  width: 100%;
  height: 100%;
  padding: var(--spacing-lg) var(--spacing-md);
  font: inherit;
  font-size: var(--site-fs-body);
  line-height: var(--site-lh-body);
  color: var(--site-text-heading);
  background-color: var(--editor-input-bg);
  border: none;
  resize: none;
  touch-action: auto;
  user-select: text;
}
.bento__inline-input:focus-visible { outline: none; }

.bento__resize {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 6;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--editor-accent) 50%);
  opacity: 0;
  transition: opacity var(--transition-fast) ease;
}
.bento__block:hover .bento__resize,
.bento__block--selected .bento__resize { opacity: 1; }
@media (hover: none) {
  .bento__resize { opacity: 1; }
}

.bento__phantom {
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--editor-accent);
  background-color: var(--editor-accent-soft);
  border: var(--border-width) dashed var(--editor-accent);
  pointer-events: none;
}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Box } from "lucide-vue-next"
import { useBentoGrid } from "../../../composables/useBentoGrid"
import { useConfirm } from "../../../composables/useConfirm"
import { useEditor } from "../../../composables/useEditor"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import { useToast } from "../../../composables/useToast"
import { useTranslations } from "../../../composables/useTranslations"
import { phoneAuthored, RESIZE_EDGES, rowTracks, type GridLayout, type ResizeEdge } from "../../../lib/bento-layout"
import type { Lang } from "../../../lib/lang"
import { blockType, FILL_TYPES, sectionAnchor } from "./block-types"
import { SECTION_PRESETS } from "../../../lib/section-presets"
import DetailBlockRenderer from "./DetailBlockRenderer.vue"
import BlockBorder from "./BlockBorder.vue"
import BlockPanel from "./BlockPanel.vue"
import { gridStyle } from "../../../lib/detail-grid"
import type { DetailBlock, DetailGridSettings, Viewer3dBlockContent } from "../../../types/portfolio"

//THE BENTO EDITOR - the canvas is drawn at the width a visitor sees (the
//public content width, or a phone), scaled down when the space beside the
//panel is narrower, so what is placed here is what the page will show: the
//same rows and the live viewers, over the cells the blocks are placed on.
//Two layouts: desktop (the page's column count) and phone (mobileY / mobileH).
//A click selects a block, a drag moves it, its edges and corners resize it,
//and a click on one of its texts types there.

const blocks = defineModel<DetailBlock[]>("blocks", { required: true })
//The page's desktop grid: columns, row height, gap
const settings = defineModel<DetailGridSettings>("grid", { required: true })
const props = defineProps<{
  lang:   Lang
  //The project this page belongs to: its files tab and uploads
  projectId: number
  //Closes the history step in progress, around every structural write
  commit: () => void
}>()

const { t } = useTranslations()
const { confirm } = useConfirm()
const toast = useToast()
const editor = useEditor()
const reducedMotion = useReducedMotion()

//The text boxes of a block, typed in place
const INLINE_TEXT = ".inline-text"
//How long a block takes to slide to its new cell
const SLIDE_MS = 160
//The phone stack has one column: only the height changes
const PHONE_EDGES: readonly ResizeEdge[] = ["s"]

const layout   = ref<GridLayout>("desktop")
const selectedId = ref<string | null>(null)
const selected = computed(() => blocks.value.find((b) => b.id === selectedId.value) ?? null)
const authored = computed(() => phoneAuthored(blocks.value))
const edges    = computed(() => layout.value === "phone" ? PHONE_EDGES : RESIZE_EDGES)

const stage  = ref<HTMLElement | null>(null)
const canvas = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const panel  = ref<InstanceType<typeof BlockPanel> | null>(null)
const blockEls = new Map<string, HTMLElement>()

function textOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>(INLINE_TEXT) : null
}

//With focus, the keyboard goes to the block: arrows, Enter, Delete
function select(id: string | null, focus = true) {
  selectedId.value = id
  if (!id) return
  editor.clear()
  //A block just added is not drawn yet, and may land off screen
  void nextTick(() => {
    const el = blockEls.get(id)
    if (!el) return
    if (focus) el.focus({ preventScroll: true })
    const box = el.getBoundingClientRect()
    if (box.bottom < 0 || box.top > window.innerHeight) el.scrollIntoView({ block: "center" })
  })
}

//Puts the caret in a text: where it was clicked, or at its end
function typeIn(text: HTMLElement, at?: { x: number; y: number }) {
  text.focus({ preventScroll: true })
  const selection = window.getSelection()
  if (!selection) return
  const point = at ? document.caretPositionFromPoint(at.x, at.y) : null
  if (point && text.contains(point.offsetNode)) {
    selection.collapse(point.offsetNode, point.offset)
    return
  }
  selection.selectAllChildren(text)
  selection.collapseToEnd()
}

//A block picked on the canvas, with the pointer or a key, opens its
//properties. The keyboard goes to the given text of the block, or to the block
function pick(id: string, text: HTMLElement | null = null, at?: { x: number; y: number }) {
  select(id, !text)
  panel.value?.showProperties()
  if (text) typeIn(text, at)
}

//A click on a text of the block starts typing there
function pickAt(id: string, at: { x: number; y: number }) {
  const hit = textOf(document.elementFromPoint(at.x, at.y))
  pick(id, hit && blockEls.get(id)?.contains(hit) ? hit : null, at)
}

const grid = useBentoGrid({
  blocks, layout, grid: gridEl, select, pick: pickAt, commit: props.commit,
  desktopCols: computed(() => settings.value.cols),
})

//The grid's CSS variables, with the columns of the layout being edited
const canvasVars = computed(() => gridStyle({ ...settings.value, cols: grid.cols.value }))

//One setting of the page grid. A new column count refits the blocks in the
//same undo step; the other settings follow the slider and the history groups them
function setGridValue(key: keyof DetailGridSettings, value: number) {
  if (key !== "cols") {
    settings.value = { ...settings.value, [key]: value }
    return
  }
  const from = settings.value.cols
  props.commit()
  settings.value = { ...settings.value, cols: value }
  grid.fitColumns(from, value)
  props.commit()
}

//An undo can take the selected block away
watch(blocks, (list) => {
  if (selectedId.value && !list.some((b) => b.id === selectedId.value)) select(null)
})
//The inspector and this panel share the right edge: one at a time
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

//The rows as the public grid draws them
const tracks = computed(() => rowTracks(
  blocks.value, grid.rects.value, grid.rows.value, layout.value === "phone" ? "var(--detail-row-h-phone)" : "var(--detail-row-h)",
))

//SLIDE - a block whose cell changes glides there from where it was drawn
const slides = new Map<string, Animation>()
let slideLayout: GridLayout = layout.value
function placeOf(el: HTMLElement, origin: DOMRect) {
  const box = el.getBoundingClientRect()
  return { x: box.left - origin.left, y: box.top - origin.top }
}
watch(() => grid.rects.value, () => {
  const host = gridEl.value
  //A layout switch redraws the whole canvas: nothing slides
  const switched = slideLayout !== layout.value
  slideLayout = layout.value
  if (!host || switched || reducedMotion.value) return
  const origin = host.getBoundingClientRect()
  const before = new Map([...blockEls].map(([id, el]) => [id, placeOf(el, origin)]))
  void nextTick(() => {
    const now = host.getBoundingClientRect()
    for (const [id, el] of blockEls) {
      const from = before.get(id)
      if (!from) continue
      slides.get(id)?.cancel()
      slides.delete(id)
      const to = placeOf(el, now)
      const dx = (from.x - to.x) / scale.value
      const dy = (from.y - to.y) / scale.value
      if (!dx && !dy) continue
      slides.set(id, el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: SLIDE_MS, easing: "ease-out" },
      ))
    }
  })
})

//A section goes under the selected block's band, or at the end of the page
function addSection(key: string) {
  const preset = SECTION_PRESETS.find((p) => p.key === key)
  if (!preset) throw new Error(`[bento] unknown section preset: ${key}`)
  grid.addSection(preset, selectedId.value)
}

//No question asked: the edit bar's undo brings the block back
function remove(b: DetailBlock) {
  grid.removeBlock(b.id)
  toast.info(t("detailBlockDeleted").replace("{kind}", t(blockType(b.type).labelKey)))
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}
function onBlockKeydown(e: KeyboardEvent, b: DetailBlock) {
  if (e.target !== e.currentTarget) return
  const arrow = ARROWS[e.key]
  if (arrow) {
    e.preventDefault()
    pick(b.id)
    grid.nudge(b.id, arrow[0], arrow[1], e.shiftKey)
  } else if (e.key === "Enter") {
    e.preventDefault()
    pick(b.id, (e.currentTarget as HTMLElement).querySelector<HTMLElement>(INLINE_TEXT))
  } else if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    grid.duplicateBlock(b.id)
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault()
    remove(b)
  } else if (e.key === "Escape") {
    select(null)
  }
}

function onBlockPointerDown(e: PointerEvent, b: DetailBlock) {
  if (e.button !== 0) return
  //A text being typed keeps the pointer: caret and selection
  const text = textOf(e.target)
  if (text && text === document.activeElement) return
  grid.startMove(e, b)
}

//A text reached with Tab selects its block
function onBlockFocusIn(e: FocusEvent, b: DetailBlock) {
  if (!textOf(e.target) || selectedId.value === b.id) return
  select(b.id, false)
  panel.value?.showProperties()
}

//A text left with Escape or Enter hands the keyboard back to its block
function onBlockFocusOut(e: FocusEvent, b: DetailBlock) {
  if (!textOf(e.target) || e.relatedTarget) return
  void nextTick(() => {
    if (document.activeElement === document.body && selectedId.value === b.id) blockEls.get(b.id)?.focus({ preventScroll: true })
  })
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
    <div class="bento__toolbar ed-ui">
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
      <button v-if="layout === 'phone' && authored" type="button" class="ed-btn ed-btn--ghost" @click="resetPhone">{{ t('detailPhoneReset') }}</button>
      <span class="bento__scale">{{ t('detailPreviewScale').replace('{n}', String(Math.round(scale * 100))) }}</span>
      <p v-if="layout === 'phone' && !authored" class="ed-hint bento__hint">{{ t('detailPhoneAuto') }}</p>
    </div>

    <div ref="stage" class="bento__stage" :style="{ height: `${stageH}px` }">
      <!--The chrome drawn over the blocks keeps its screen size whatever the canvas scale-->
      <div
        ref="canvas"
        class="bento__canvas"
        :class="{ 'bento__canvas--phone': layout === 'phone' }"
        :style="{ ...canvasVars, transform: `scale(${scale})`, '--bento-unscale': 1 / scale }"
      >
        <div
          ref="gridEl"
          class="bento__grid"
          :style="{ '--tracks': tracks }"
          @pointerdown.self="select(null)"
        >
          <div class="bento__ghost" aria-hidden="true">
            <span v-for="n in grid.cols.value * grid.rows.value" :key="n" class="bento__ghost-cell"></span>
          </div>

          <div
            v-for="b in blocks"
            :id="b.type === 'heading' ? sectionAnchor(b.id) : undefined"
            :key="b.id"
            :ref="(el) => { if (el) blockEls.set(b.id, el as HTMLElement); else blockEls.delete(b.id) }"
            class="bento__block"
            :class="{
              'bento__block--heading': b.type === 'heading',
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
            @focusin="onBlockFocusIn($event, b)"
            @focusout="onBlockFocusOut($event, b)"
            @keydown="onBlockKeydown($event, b)"
          >
            <span class="bento__tag ed-ui" aria-hidden="true">{{ t(blockType(b.type).labelKey) }}</span>

            <div v-if="b.type === 'viewer3d' && !(b.content as Viewer3dBlockContent).model3dId" class="bento__viewer">
              <span class="bento__viewer-label ed-ui">
                <Box :size="16" aria-hidden="true" />
                {{ t('detailViewerPick') }}
              </span>
            </div>

            <div v-else class="bento__preview">
              <DetailBlockRenderer :block="b" :lang="lang" :cols="settings.cols" :mobile="layout === 'phone'" />
            </div>
            <BlockBorder :bstyle="b.style" />

            <template v-if="selectedId === b.id">
              <span
                v-for="edge in edges"
                :key="edge"
                class="bento__handle"
                :class="`bento__handle--${edge}`"
                aria-hidden="true"
                @pointerdown="grid.startResize($event, b, edge)"
              ></span>
            </template>
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
      ref="panel"
      :selected="selected"
      :grid="settings"
      :project-id="projectId"
      @set-grid="setGridValue"
      @add="grid.addBlock"
      @create="grid.startCreate"
      @add-section="addSection"
      @duplicate="selected && grid.duplicateBlock(selected.id)"
      @remove="selected && remove(selected)"
    />
  </div>
</template>

<style scoped>
.bento {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-md);
}
/*TOOLBAR - layout switch, phone reset, preview scale*/
.bento__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line-soft);
  border-radius: var(--editor-radius);
}
.bento__tabs { display: flex; gap: var(--vsui-space-2xs); }
.bento__scale {
  margin-inline-start: auto;
  padding-inline: var(--vsui-space-xs);
  font-size: var(--editor-fs-sm);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text-muted);
}
.bento__hint {
  flex-basis: 100%;
  padding: 0 var(--vsui-space-xs) var(--vsui-space-2xs);
}

/*Clip, not hidden: focus and scrollIntoView never scroll a clipped box*/
.bento__stage {
  position: relative;
  width: 100%;
  overflow: clip;
}
/*The desktop layout is never drawn narrower than a laptop: on a tablet or a
phone it is scaled down instead of squeezed*/
.bento__canvas {
  width: max(var(--detail-content-width), var(--detail-canvas-min));
  transform-origin: top left;
}
.bento__canvas--phone {
  width: var(--detail-phone-width);
  margin-inline: auto;
}
.bento__grid {
  /*Handle sizes on screen: the hit strip, its mark, the grip bar and the corner*/
  --bento-edge:   calc(var(--vsui-space-sm) * var(--bento-unscale));
  --bento-mark:   calc(var(--vsui-space-xs) * var(--bento-unscale));
  --bento-grip:   calc(var(--vsui-space-xl) * var(--bento-unscale));
  --bento-corner: calc(var(--vsui-space-lg) * var(--bento-unscale));
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--detail-cols), minmax(0, 1fr));
  grid-template-rows: var(--tracks);
  gap: var(--detail-gap);
  touch-action: none;
  user-select: none;
}
.bento__canvas--phone .bento__grid { gap: var(--detail-gap-phone); }
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
/*As on the public grid: media take the cell's size, text sets it*/
.bento__block--fill { contain: size; }
/*A heading the rail scrolls to clears the top bar*/
.bento__block--heading { scroll-margin-top: var(--site-chrome-top); }
.bento__block:hover { outline-color: var(--editor-text-muted); }
.bento__block:focus-visible { outline: calc(var(--editor-outline-width) * var(--bento-unscale)) solid hsl(var(--ring)); }
.bento__block--selected,
.bento__block--selected:hover {
  outline: calc(var(--editor-outline-width) * var(--bento-unscale)) solid var(--editor-accent);
  outline-offset: calc(-1 * var(--editor-outline-width) * var(--bento-unscale));
}
.bento__block--dragging { z-index: 2; cursor: grabbing; opacity: var(--vsui-disabled-opacity); }

.bento__tag {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  padding: var(--vsui-space-2xs) var(--vsui-space-xs);
  font-size: var(--editor-fs-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  color: var(--editor-on-accent);
  background-color: var(--editor-accent);
  border-bottom-right-radius: var(--editor-radius);
  opacity: 0;
  pointer-events: none;
  transform: scale(var(--bento-unscale));
  transform-origin: top left;
  transition: opacity var(--transition-fast) ease;
}
/*Clear of the corner handle*/
.bento__block--selected .bento__tag { left: var(--bento-corner); }
.bento__block:hover .bento__tag,
.bento__block--selected .bento__tag,
.bento__block:focus-visible .bento__tag { opacity: 1; }

.bento__preview {
  display: flex;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
/*The texts of a block are typed in place; the rest of it is a still preview*/
.bento__preview :deep(.inline-text) {
  pointer-events: auto;
  touch-action: auto;
  user-select: text;
}

.bento__viewer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: var(--editor-surface);
  pointer-events: none;
}
.bento__viewer-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--vsui-space-xs);
  font-size: var(--editor-fs-sm);
  color: var(--editor-text-muted);
  transform: scale(var(--bento-unscale));
}

/*RESIZE HANDLES - a strip along each edge and a square in each corner of the
selected block, at their screen size whatever the canvas scale*/
.bento__handle {
  position: absolute;
  z-index: 6;
}
.bento__handle::after {
  content: "";
  position: absolute;
  background-color: var(--editor-accent);
}
.bento__handle--n,
.bento__handle--s {
  right: var(--bento-corner);
  left: var(--bento-corner);
  height: var(--bento-edge);
  cursor: ns-resize;
}
.bento__handle--e,
.bento__handle--w {
  top: var(--bento-corner);
  bottom: var(--bento-corner);
  width: var(--bento-edge);
  cursor: ew-resize;
}
.bento__handle--n { top: 0; }
.bento__handle--s { bottom: 0; }
.bento__handle--e { right: 0; }
.bento__handle--w { left: 0; }
/*The mark of an edge: a short bar at its middle*/
.bento__handle--n::after,
.bento__handle--s::after {
  left: calc(50% - var(--bento-grip) / 2);
  width: var(--bento-grip);
  height: var(--bento-mark);
}
.bento__handle--e::after,
.bento__handle--w::after {
  top: calc(50% - var(--bento-grip) / 2);
  width: var(--bento-mark);
  height: var(--bento-grip);
}
.bento__handle--n::after { top: 0; }
.bento__handle--s::after { bottom: 0; }
.bento__handle--e::after { right: 0; }
.bento__handle--w::after { left: 0; }
.bento__handle--ne,
.bento__handle--nw,
.bento__handle--se,
.bento__handle--sw {
  width: var(--bento-corner);
  height: var(--bento-corner);
}
.bento__handle--nw,
.bento__handle--se { cursor: nwse-resize; }
.bento__handle--ne,
.bento__handle--sw { cursor: nesw-resize; }
.bento__handle--ne,
.bento__handle--nw { top: 0; }
.bento__handle--se,
.bento__handle--sw { bottom: 0; }
.bento__handle--nw,
.bento__handle--sw { left: 0; }
.bento__handle--ne,
.bento__handle--se { right: 0; }
/*The mark of a corner: a square in the corner itself*/
.bento__handle--ne::after,
.bento__handle--nw::after,
.bento__handle--se::after,
.bento__handle--sw::after {
  width: var(--bento-edge);
  height: var(--bento-edge);
}
.bento__handle--ne::after,
.bento__handle--nw::after { top: 0; }
.bento__handle--se::after,
.bento__handle--sw::after { bottom: 0; }
.bento__handle--nw::after,
.bento__handle--sw::after { left: 0; }
.bento__handle--ne::after,
.bento__handle--se::after { right: 0; }

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

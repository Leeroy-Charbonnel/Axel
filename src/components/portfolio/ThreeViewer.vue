<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from "vue"
import { Box, Cylinder, Grid3x3, Maximize, Minimize, TriangleAlert } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import SiteImage from "../SiteImage.vue"
import { inLoadTurn } from "../../three/loadQueue"
import { useTheme } from "../../composables/useTheme"
import type { LabelPoint, ModelViewer } from "../../three/modelViewer"
import type { ViewerMode, ViewerSettings } from "../../three/types"

//PUBLIC 3D VIEWER, transparent so the model floats on the page. Fetches three.js
//and the GLB when the viewer comes near the viewport or once the page settled
//(not when the browser asks to save data), and flies
//the camera in once a good part of it is on screen. The poster only shows when
//the model cannot be. Rendering pauses offscreen and in a hidden tab. The scene itself lives in src/three/modelViewer.ts.

const props = withDefaults(defineProps<{
  glbUrl:      string
  settings:    ViewerSettings | null
  //wireframe mode, two-way: the card's thumbnails follow the viewer's own toolbar
  wireframe?:  boolean
  //image shown when the model cannot be, and how wide the viewer is drawn
  poster?:      string | null
  posterSizes?: string
  //what the model is, for screen readers
  alt?:         string
  autoRotate?:  boolean
  //the mode buttons and fullscreen; a card with its own controls hides them
  toolbar?:     boolean
  //under the model, or a column of icons at its right
  toolbarSide?: "bottom" | "right"
  //the model's label points drawn as numbered marks (an exploded view)
  labels?:      boolean
}>(), { labels: false, wireframe: false, poster: null, posterSizes: "100vw", alt: "", autoRotate: false, toolbar: true, toolbarSide: "bottom" })

//plain: the model shown without its materials (wireframe or clay), for the
//thumbnails beside it to turn to their clay renders
const emit = defineEmits<{ "update:wireframe": [on: boolean]; "update:plain": [on: boolean] }>()

const { t } = useLanguage()
const { accent } = useTheme()

//start loading a screen before the viewer scrolls into view
const PRELOAD_MARGIN = "100%"
//every viewer of the page starts loading this long after the page shows, in the background
const EAGER_START_MS = 1500
//the wheel zooms once the pointer rested this long on the viewer without a page scroll
const ZOOM_ARM_MS = 600
//share of the viewer on screen before the intro flight starts
const INTRO_THRESHOLD = 0.3
const DESKTOP_MAX_DPR = 2
const TOUCH_MAX_DPR   = 1.5

type Phase = "idle" | "loading" | "ready" | "error" | "lost"

const root   = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const phase  = ref<Phase>("idle")
//0..1, null while the size is unknown
const progress = ref<number | null>(0)
const errorDetail = ref("")
const mode = ref<ViewerMode>(props.wireframe ? "wireframe" : "render")
const isFullscreen = ref(false)
const canFullscreen = ref(false)
const near    = ref(false)
const visible = ref(false)
const onScreen = ref(false)
const pageHidden = ref(false)
const viewer = shallowRef<ModelViewer | null>(null)
//MARKS - one numbered box per label point on a leader line, written straight
//to the DOM on every frame drawn
const marksEl = ref<SVGSVGElement | null>(null)
const labelCount = ref(0)
//how far the columns of boxes stand from the model's outermost parts
const LEADER_PX = 56
//half a mark box and a little air: how close a box comes to the viewer's edge
const MARK_INSET_PX = 18
//two box centres closer than this overlap
const MARK_GAP_PX = 32
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
//The boxes stand in two columns, left and right of the model, each box level
//with its part when there is room, the leaders straight and level wherever
//they can be: a technical drawing's callouts.
function placeMarks(points: LabelPoint[]) {
  labelCount.value = points.length
  const svg = marksEl.value
  if (!svg) return
  const w = svg.clientWidth, h = svg.clientHeight
  const shown = points.map((p, i) => ({ ...p, i })).filter((p) => p.visible)
  if (!shown.length) return
  const minX = Math.min(...shown.map((p) => p.x)), maxX = Math.max(...shown.map((p) => p.x))
  const middle = (minX + maxX) / 2
  const columns = [
    { side: shown.filter((p) => p.x < middle), x: clamp(minX - LEADER_PX, MARK_INSET_PX, w - MARK_INSET_PX) },
    { side: shown.filter((p) => p.x >= middle), x: clamp(maxX + LEADER_PX, MARK_INSET_PX, w - MARK_INSET_PX) },
  ]
  const at = new Map<number, { x: number; y: number }>()
  for (const { side, x } of columns) {
    //top to bottom, each box at least a box below the one above
    const sorted = [...side].sort((a, b) => a.y - b.y)
    const ys = sorted.map((p) => clamp(p.y, MARK_INSET_PX, h - MARK_INSET_PX))
    for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k]!, ys[k - 1]! + MARK_GAP_PX)
    //a column run past the bottom moves up as a whole
    const over = (ys[ys.length - 1] ?? 0) - (h - MARK_INSET_PX)
    if (over > 0) for (let k = 0; k < ys.length; k++) ys[k] = Math.max(MARK_INSET_PX + k * MARK_GAP_PX, ys[k]! - over)
    sorted.forEach((p, k) => at.set(p.i, { x, y: ys[k]! }))
  }
  points.forEach((p, i) => {
    const group = svg.children[i] as SVGGElement | undefined
    if (!group) return
    const box = at.get(i)
    group.style.display = box ? "" : "none"
    if (!box) return
    const line = group.children[0] as SVGLineElement
    line.setAttribute("x1", String(p.x))
    line.setAttribute("y1", String(p.y))
    line.setAttribute("x2", String(box.x))
    line.setAttribute("y2", String(box.y))
    const dot = group.children[1] as SVGCircleElement
    dot.setAttribute("cx", String(p.x))
    dot.setAttribute("cy", String(p.y))
    ;(group.children[2] as SVGForeignObjectElement).setAttribute("transform", `translate(${box.x} ${box.y})`)
  })
}

let reducedMotion = false
let touch = false
//bumped on every start / teardown so a stale async step knows to stop
let generation = 0
const observers: IntersectionObserver[] = []

const label = computed(() => (props.alt ? `${props.alt} - ${t("viewerLabel")}` : t("viewerLabel")))
const progressPercent = computed(() => (progress.value === null ? null : Math.round(progress.value * 100)))

const MODES: { key: ViewerMode; icon: typeof Box; label: string }[] = [
  { key: "render",    icon: Box,      label: "viewerModeRender" },
  { key: "wireframe", icon: Grid3x3,  label: "viewerModeWireframe" },
  { key: "clay",      icon: Cylinder, label: "viewerModeClay" },
]

function settingsOrEmpty(): ViewerSettings {
  return props.settings ?? {}
}

async function start() {
  if (!canvas.value || phase.value === "loading" || phase.value === "ready") return
  const run = ++generation
  phase.value = "loading"
  progress.value = 0
  errorDetail.value = ""
  try {
    //null when this viewer was torn down while it waited for its turn
    const v = await inLoadTurn(async () => {
      if (run !== generation || !canvas.value) return null
      const { ModelViewer } = await import("../../three/modelViewer")
      if (run !== generation) return null
      const created = new ModelViewer({
        canvas: canvas.value,
        maxPixelRatio: touch ? TOUCH_MAX_DPR : DESKTOP_MAX_DPR,
        touch,
        reducedMotion,
        autoRotate: props.autoRotate,
        glowColor: accent.value,
      })
      viewer.value = created
      //the orbit controls just claimed every touch move on the canvas
      syncTouchAction()
      syncActive()
      await created.load(props.glbUrl, settingsOrEmpty(), (loaded, total) => {
        progress.value = total ? loaded / total : null
      }, mode.value)
      return created
    })
    if (!v || run !== generation) return
    //the starting mode is there from the first frame, never swept in
    v.setMode(mode.value, false)
    if (props.labels) v.onLabels(placeMarks)
    phase.value = "ready"
    if (onScreen.value) v.playIntro()
  } catch (err) {
    if (run !== generation) return
    console.error(`[ThreeViewer] ${props.glbUrl} could not be shown:`, err)
    errorDetail.value = err instanceof Error ? err.message : String(err)
    teardown(false)
    phase.value = "error"
  }
}

//loseContext only on unmount: the canvas stays and a retry, a new model or a
//restored context creates the next renderer on the same context
function teardown(loseContext: boolean) {
  generation++
  viewer.value?.dispose(loseContext)
  viewer.value = null
}

function retry() {
  teardown(false)
  phase.value = "idle"
  void start()
}

function syncActive() {
  viewer.value?.setActive(visible.value && !pageHidden.value)
}

function onContextLost(e: Event) {
  //without preventDefault the browser never gives the context back
  e.preventDefault()
  console.error(`[ThreeViewer] WebGL context lost for ${props.glbUrl}`)
  teardown(false)
  phase.value = "lost"
}

function onContextRestored() {
  phase.value = "idle"
  void start()
}

function onVisibilityChange() {
  pageHidden.value = document.hidden
}

//WHEEL INTENT - a wheel that passes over the viewer while scrolling the page
//keeps scrolling it. The wheel zooms once the pointer rested on the viewer
//without a wheel or a page scroll, or after a press on it. Fullscreen has no
//page to scroll: the wheel zooms at once.
let hovering = false
let zoomArmed = false
let armTimer: ReturnType<typeof setTimeout> | undefined
let eagerTimer: ReturnType<typeof setTimeout> | undefined

function rearm() {
  zoomArmed = false
  clearTimeout(armTimer)
  if (hovering) armTimer = setTimeout(() => { zoomArmed = true }, ZOOM_ARM_MS)
}

function onPointerEnter(e: PointerEvent) {
  if (e.pointerType !== "mouse") return
  hovering = true
  rearm()
}

function onPointerLeave() {
  hovering = false
  rearm()
}

function onPress() {
  clearTimeout(armTimer)
  zoomArmed = true
}

function onPageScroll() {
  if (hovering) rearm()
}

//capture phase: a wheel the viewer must not take never reaches the controls
function onWheel(e: WheelEvent) {
  if (zoomArmed || isFullscreen.value) return
  e.stopPropagation()
  //a trackpad keeps sending wheels after the page reached its end: still the same scroll
  rearm()
}

//TOUCH - a finger that moves up or down scrolls the page, as the wheel does;
//sideways it turns the model, two fingers zoom. Fullscreen takes every move.
function syncTouchAction() {
  if (canvas.value) canvas.value.style.touchAction = isFullscreen.value ? "none" : "pan-y"
}

function saveData(): boolean {
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === root.value
  syncTouchAction()
}

async function toggleFullscreen() {
  try {
    if (isFullscreen.value) await document.exitFullscreen()
    else await root.value?.requestFullscreen()
  } catch (err) {
    console.error("[ThreeViewer] fullscreen refused:", err)
  }
}

onMounted(() => {
  reducedMotion  = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  touch = window.matchMedia("(pointer: coarse)").matches
  canFullscreen.value = document.fullscreenEnabled
  pageHidden.value = document.hidden
  const el = root.value!
  const nearObserver = new IntersectionObserver(([entry]) => { near.value = entry!.isIntersecting }, { rootMargin: PRELOAD_MARGIN })
  const seenObserver = new IntersectionObserver(([entry]) => { visible.value = entry!.isIntersecting })
  const introObserver = new IntersectionObserver(([entry]) => { onScreen.value = entry!.isIntersecting }, { threshold: INTRO_THRESHOLD })
  nearObserver.observe(el)
  seenObserver.observe(el)
  introObserver.observe(el)
  observers.push(nearObserver, seenObserver, introObserver)
  canvas.value!.addEventListener("webglcontextlost", onContextLost)
  canvas.value!.addEventListener("webglcontextrestored", onContextRestored)
  document.addEventListener("visibilitychange", onVisibilityChange)
  document.addEventListener("fullscreenchange", onFullscreenChange)
  el.addEventListener("wheel", onWheel, { capture: true, passive: true })
  el.addEventListener("pointerenter", onPointerEnter)
  el.addEventListener("pointerleave", onPointerLeave)
  el.addEventListener("pointerdown", onPress)
  window.addEventListener("scroll", onPageScroll, { passive: true })
  if (!saveData()) eagerTimer = setTimeout(() => { if (phase.value === "idle") void start() }, EAGER_START_MS)
})

//KEPT ALIVE - the home page stays behind an open project. A loaded model stays
//with it, so coming back shows it at once. A load still running gives its turn
//to the page on screen, and a phone frees every model: its memory is short.
let aside = false
onDeactivated(() => {
  aside = true
  clearTimeout(eagerTimer)
  if (phase.value !== "loading" && !(touch && phase.value === "ready")) return
  teardown(false)
  phase.value = "idle"
})
onActivated(() => {
  //the first activation is the mount itself
  if (!aside) return
  aside = false
  if (phase.value === "idle" && !saveData()) void start()
})

onBeforeUnmount(() => {
  for (const o of observers) o.disconnect()
  canvas.value?.removeEventListener("webglcontextlost", onContextLost)
  canvas.value?.removeEventListener("webglcontextrestored", onContextRestored)
  document.removeEventListener("visibilitychange", onVisibilityChange)
  document.removeEventListener("fullscreenchange", onFullscreenChange)
  window.removeEventListener("scroll", onPageScroll)
  clearTimeout(armTimer)
  clearTimeout(eagerTimer)
  teardown(true)
})

watch(near, (isNear) => {
  if (isNear && phase.value === "idle") void start()
})
watch([visible, pageHidden], syncActive)
watch(onScreen, (seen) => {
  if (seen && phase.value === "ready") viewer.value?.playIntro()
})
watch(() => props.wireframe, (on) => {
  if (on) mode.value = "wireframe"
  else if (mode.value === "wireframe") mode.value = "render"
})
watch(mode, (m) => {
  viewer.value?.setMode(m)
  emit("update:wireframe", m === "wireframe")
  emit("update:plain", m !== "render")
})
watch(() => props.settings, (s) => {
  if (phase.value === "ready" && s) viewer.value?.applySettings(s)
}, { deep: true })
watch(accent, (color) => viewer.value?.setGlowColor(color))
watch(() => props.glbUrl, () => {
  teardown(false)
  phase.value = "idle"
  if (near.value) void start()
})
</script>

<template>
  <div
    ref="root"
    class="three-viewer"
    :class="{ 'three-viewer--fullscreen': isFullscreen }"
    role="region"
    :aria-label="label"
    :aria-busy="phase === 'loading'"
  >
    <canvas ref="canvas" class="three-viewer__canvas" :class="{ 'three-viewer__canvas--ready': phase === 'ready' }" />

    <svg v-if="labels && phase === 'ready'" ref="marksEl" class="three-viewer__labels" aria-hidden="true">
      <g v-for="i in labelCount" :key="i">
        <line class="three-viewer__leader" />
        <circle class="three-viewer__anchor" r="2" />
        <foreignObject class="three-viewer__mark-box">
          <span class="three-viewer__label">{{ String(i).padStart(2, "0") }}</span>
        </foreignObject>
      </g>
    </svg>

    <SiteImage
      v-if="poster && (phase === 'error' || phase === 'lost')"
      :src="poster"
      :sizes="posterSizes"
      class="three-viewer__poster"
    />

    <div
      v-if="phase === 'loading'"
      class="three-viewer__progress"
      role="progressbar"
      :aria-label="t('viewerLoading')"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progressPercent ?? undefined"
    >
      <div
        class="three-viewer__progress-fill"
        :class="{ 'three-viewer__progress-fill--unknown': progressPercent === null }"
        :style="progressPercent === null ? undefined : { width: `${progressPercent}%` }"
      />
    </div>

    <div v-if="phase === 'error' || phase === 'lost'" class="three-viewer__message" role="alert">
      <TriangleAlert class="three-viewer__icon" aria-hidden="true" />
      <p class="three-viewer__message-title">{{ phase === "lost" ? t("viewerContextLost") : t("viewerError") }}</p>
      <p v-if="phase === 'error'" class="three-viewer__message-detail">{{ errorDetail }}</p>
      <button v-if="phase === 'error'" type="button" class="three-viewer__button three-viewer__button--text" @click="retry">
        {{ t("viewerRetry") }}
      </button>
    </div>

    <div
      v-if="phase === 'ready' && toolbar"
      class="three-viewer__toolbar"
      :class="`three-viewer__toolbar--${toolbarSide}`"
      role="toolbar"
      :aria-label="t('viewerToolbar')"
    >
      <div class="three-viewer__modes" role="group" :aria-label="t('viewerModes')">
        <button
          v-for="m in MODES"
          :key="m.key"
          type="button"
          class="three-viewer__button"
          :class="{ 'three-viewer__button--active': mode === m.key }"
          :aria-pressed="mode === m.key"
          :aria-label="t(m.label)"
          :title="t(m.label)"
          @click="mode = m.key"
        >
          <component :is="m.icon" class="three-viewer__icon" aria-hidden="true" />
          <span class="three-viewer__button-label">{{ t(m.label) }}</span>
        </button>
      </div>
      <button
        v-if="canFullscreen"
        type="button"
        class="three-viewer__button"
        :aria-label="isFullscreen ? t('viewerExitFullscreen') : t('viewerFullscreen')"
        :title="isFullscreen ? t('viewerExitFullscreen') : t('viewerFullscreen')"
        @click="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" class="three-viewer__icon" aria-hidden="true" />
        <Maximize v-else class="three-viewer__icon" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.three-viewer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.three-viewer--fullscreen {
  background-color: var(--bg-main);
}

.three-viewer__canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity var(--vsui-transition-slow) ease;
}

.three-viewer__canvas--ready {
  opacity: 1;
}

/*the fallback when the model cannot be shown, under the message*/
.three-viewer__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

/*the global media rule lifts every canvas and img to z-index 2 over the grain;
the controls sit above them*/
.three-viewer__progress,
.three-viewer__message,
.three-viewer__toolbar {
  z-index: var(--vsui-z-dropdown);
}

.three-viewer__icon {
  width: var(--vsui-space-lg);
  height: var(--vsui-space-lg);
  flex-shrink: 0;
}

.three-viewer__progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--vsui-progress-thin);
  background-color: var(--color-background-gray-150);
  pointer-events: none;
}

.three-viewer__progress-fill {
  height: 100%;
  background-color: var(--color-accent);
  transition: width var(--vsui-transition-fast) linear;
}

/*no Content-Length: a dimmed full bar says "loading" without a percentage*/
.three-viewer__progress-fill--unknown {
  width: 100%;
  opacity: var(--vsui-disabled-opacity);
}

.three-viewer__message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xl);
  background-color: var(--color-background-tertiary);
  color: var(--color-text-secondary);
  text-align: center;
}

.three-viewer__message-title {
  color: var(--color-text-hover);
  font-size: var(--vsui-text-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
}

.three-viewer__message-detail {
  max-width: var(--vsui-panel-xl);
  font-size: var(--vsui-text-xs);
  color: var(--color-text-tertiary);
  overflow-wrap: anywhere;
}

.three-viewer__toolbar {
  position: absolute;
  left: var(--vsui-space-md);
  bottom: var(--vsui-space-md);
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
}

.three-viewer__modes {
  display: flex;
  border: var(--border-width) solid var(--color-gray-medium);
}

/*a column of icons, centred on the right edge; the names stay in aria-label and title*/
/*NUMBERED MARKS - a dot on the part, a hairline out, the legend's box at its end*/
.three-viewer__labels {
  position: absolute;
  inset: 0;
  z-index: var(--vsui-z-dropdown);
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.three-viewer__leader { stroke: var(--site-line-strong); stroke-width: var(--border-width-sm); }
.three-viewer__anchor { fill: var(--site-text-heading); }
.three-viewer__mark-box {
  width: 1px;
  height: 1px;
  overflow: visible;
}
.three-viewer__label {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-grid;
  place-content: center;
  min-width: var(--site-mark);
  height: var(--site-mark);
  margin: calc(var(--site-mark) / -2) 0 0 calc(var(--site-mark) / -2);
  border: var(--border-width-sm) solid var(--site-line-strong);
  background-color: var(--site-backdrop);
  font-size: var(--site-fs-label);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-heading);
}

.three-viewer__toolbar--right {
  left: auto;
  right: var(--vsui-space-md);
  bottom: auto;
  top: 50%;
  flex-direction: column;
  transform: translateY(-50%);
}
.three-viewer__toolbar--right .three-viewer__modes { flex-direction: column; }
.three-viewer__toolbar--right .three-viewer__button-label { display: none; }
/*a phone: the column would cover the model, the toolbar goes back under it*/
@media (max-width: 640px) {
  .three-viewer__toolbar--right {
    left: var(--vsui-space-md);
    right: auto;
    top: auto;
    bottom: var(--vsui-space-md);
    flex-direction: row;
    transform: none;
  }
  .three-viewer__toolbar--right .three-viewer__modes { flex-direction: row; }
}

.three-viewer__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-xs);
  min-width: var(--vsui-control-sm);
  height: var(--vsui-control-sm);
  padding: 0 var(--vsui-space-sm);
  border: var(--border-width) solid transparent;
  background-color: var(--semi-transparent-dark);
  color: var(--color-text-secondary);
  font-size: var(--vsui-text-2xs);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--vsui-transition-fast), background-color var(--vsui-transition-fast);
}

.three-viewer__toolbar > .three-viewer__button {
  border-color: var(--color-gray-medium);
}

.three-viewer__button:hover {
  color: var(--color-text-hover);
}

.three-viewer__button--active {
  color: var(--color-accent);
  background-color: var(--color-background-gray-100);
}

.three-viewer__button--text {
  height: auto;
  min-height: var(--vsui-control-sm);
  border-color: var(--color-border-muted);
}

.three-viewer__button:focus-visible {
  outline: var(--border-width-md) solid var(--color-accent);
  outline-offset: var(--vsui-space-2xs);
}

/*phones: icons only, the names stay in aria-label and title*/
@media (max-width: 640px) {
  .three-viewer__button-label {
    display: none;
  }
}

/*finger-sized targets*/
@media (pointer: coarse) {
  .three-viewer__button {
    min-width: var(--vsui-space-3xl);
    height: var(--vsui-space-3xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .three-viewer__canvas,
  .three-viewer__progress-fill,
  .three-viewer__button {
    transition: none;
  }
}
</style>

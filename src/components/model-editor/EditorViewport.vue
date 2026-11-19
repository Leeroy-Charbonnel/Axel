<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { RotateCcw, TriangleAlert } from "lucide-vue-next"
import { useToast } from "../../composables/useToast"
import { useTranslations } from "../../composables/useTranslations"
import { useTheme } from "../../composables/useTheme"
import type { ModelViewer } from "../../three/modelViewer"
import type { Vec3 } from "../../three/types"
import type { LightGizmo, LightPick } from "./lightGizmo"
import { useModelEditor } from "./useModelEditor"

//THE EDITOR VIEWPORT - the public ModelViewer on the model being edited, fed
//the document as it changes. A new file means a new viewer: the old one and
//everything it loaded are disposed first. In a desktop or phone frame the
//canvas takes that frame's shape, so what shows here is what visitors get.
//While the Lights panel is open the lights are drawn as handles: a click
//picks one, its arrows move it.

const emit = defineEmits<{ ready: [viewer: ModelViewer, firstLoad: boolean] }>()

const ed = useModelEditor()
const toast = useToast()
const { t } = useTranslations()
const { accent } = useTheme()

const MAX_PIXEL_RATIO = 2
//a pointer that moved less than this between down and up is a click, not an orbit
const CLICK_SLOP_PX = 4

type Phase = "loading" | "ready" | "error"

const canvas = ref<HTMLCanvasElement | null>(null)
const phase = ref<Phase>("loading")
const progress = ref<number | null>(0)
const errorDetail = ref("")

let current: ModelViewer | null = null
let generation = 0
let loadedOnce = false
let gizmo: LightGizmo | null = null
//one undo step per drag
let dragCount = 0
let down: { x: number; y: number } | null = null

async function start(url: string | null | undefined) {
  const run = ++generation
  teardown(false)
  if (!url) {
    phase.value = "error"
    errorDetail.value = t("modelEditorNoGlb")
    return
  }
  phase.value = "loading"
  progress.value = 0
  errorDetail.value = ""
  try {
    const [{ ModelViewer }, { LightGizmo }] = await Promise.all([import("../../three/modelViewer"), import("./lightGizmo")])
    if (run !== generation || !canvas.value) return
    const v = new ModelViewer({
      canvas: canvas.value,
      maxPixelRatio: MAX_PIXEL_RATIO,
      touch: window.matchMedia("(pointer: coarse)").matches,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      autoRotate: false,
      glowColor: accent.value,
    })
    current = v
    await v.load(url, ed.effective.value, (loaded, total) => {
      progress.value = total ? loaded / total : null
    })
    if (run !== generation) return
    ed.viewer.value = v
    ed.setup.value = v.autoSetup
    ed.slots.value = v.materialSlots
    ed.meshNames.value = v.meshNames
    v.setMode(ed.preview.value)
    gizmo = new LightGizmo(v.core, v.autoSetup!.bounds.radius, { onMove: moveLight, onDragging: startDrag })
    syncGizmo()
    phase.value = "ready"
    emit("ready", v, !loadedOnce)
    loadedOnce = true
  } catch (err) {
    if (run !== generation) return
    console.error(`[model-editor] ${url} could not be shown:`, err)
    errorDetail.value = err instanceof Error ? err.message : String(err)
    teardown(false)
    phase.value = "error"
  }
}

//loseContext only on unmount: the next viewer reuses the canvas and its context
function teardown(loseContext: boolean) {
  gizmo?.dispose()
  gizmo = null
  current?.dispose(loseContext)
  current = null
  ed.viewer.value = null
  ed.setup.value = null
}

function retry() {
  void start(ed.model.value?.glbUrl)
}

//LIGHT HANDLES - drawn while the Lights panel is open. Clay shows the auto
//rig, not these lights, so it shows no handle.
const lightsShown = computed(() => ed.panel.value === "lights" && ed.preview.value !== "clay")

function syncGizmo() {
  if (!gizmo) return
  gizmo.setVisible(lightsShown.value)
  gizmo.sync({
    lights:   ed.doc.value.settings.lights ?? [],
    selected: ed.selectedLight.value,
    look:     ed.preview.value === "wireframe" ? "wireframe" : "normal",
    accent:   accent.value,
  })
}

//the lights stand far from the model: opening the panel, or a new light,
//backs the camera away until they all show
function frameLights(now: [boolean, number], before: [boolean, number]) {
  const lights = ed.doc.value.settings.lights ?? []
  //the panel closed: back to the view visitors start on
  if (before[0] && !now[0]) ed.viewer.value?.resetView()
  if (!lightsShown.value || !lights.length) return
  ed.viewer.value?.frameWith(lights.flatMap((l): Vec3[] => (l.type === "directional" ? [[l.x, l.y, l.z], [l.tx ?? 0, l.ty ?? 0, l.tz ?? 0]] : [[l.x, l.y, l.z]])))
}

//One undo step per drag. A camera still flying stops where it is: the flight
//would hand the orbit back in the middle of the drag.
function startDrag(dragging: boolean) {
  if (!dragging) return
  dragCount++
  if (current) current.setCameraView(current.cameraView())
}

function moveLight(pick: LightPick, [x, y, z]: Vec3) {
  ed.change(`light-drag-${dragCount}`, (d) => {
    const light = d.settings.lights?.find((l) => l.id === pick.id)
    if (!light) return
    if (pick.part === "position") Object.assign(light, { x, y, z })
    else Object.assign(light, { tx: x, ty: y, tz: z })
  }, true)
}

//CLICKS (not orbits) - on a light handle: select it. While picking: toggle
//the mesh as an emissive part.
function onPointerDown(e: PointerEvent) {
  down = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  const start = down
  down = null
  const v = ed.viewer.value
  if (!start || !v) return
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return
  if (gizmo && lightsShown.value && !gizmo.overArrows) {
    const pick = gizmo.pick(e.clientX, e.clientY)
    if (pick) ed.selectedLight.value = pick
    return
  }
  if (!ed.picking.value) return
  const mesh = v.meshAt(e.clientX, e.clientY)
  if (!mesh) return
  if (!mesh.name) {
    toast.show({ type: "warning", message: t("modelEditorPickUnnamed") })
    return
  }
  const name = mesh.name
  ed.change("emissive-pick", (d) => {
    const wf = (d.settings.wireframeMode ??= {})
    const list = wf.emissiveMeshes ?? []
    wf.emissiveMeshes = list.some((p) => p.name === name)
      ? list.filter((p) => p.name !== name)
      : [...list, { name, intensity: 2 }]
  })
}

watch(() => ed.model.value?.glbUrl, (url) => void start(url))
watch(ed.effective, (s) => ed.viewer.value?.applySettings(s))
watch(ed.preview, (m) => ed.viewer.value?.setMode(m))
watch([lightsShown, ed.selectedLight, ed.preview, () => ed.doc.value.settings.lights, accent], syncGizmo)
watch([lightsShown, () => (ed.doc.value.settings.lights ?? []).length], frameLights)
watch(accent, (color) => current?.setGlowColor(color))

onMounted(() => void start(ed.model.value?.glbUrl))
onBeforeUnmount(() => {
  generation++
  teardown(true)
})
</script>

<template>
  <div class="vp" :class="`vp--${ed.frame.value}`">
    <div class="vp__frame" :class="{ 'vp__frame--picking': ed.picking.value }">
      <canvas
        ref="canvas"
        class="vp__canvas"
        :aria-label="t('modelEditorViewport')"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
      ></canvas>

      <div v-if="phase === 'loading'" class="vp__state" role="status">
        <span class="vp__progress" aria-hidden="true">
          <span class="vp__progress-bar" :class="{ 'vp__progress-bar--unknown': progress === null }" :style="progress !== null ? { transform: `scaleX(${progress})` } : undefined"></span>
        </span>
        <span class="ed-hint">{{ progress === null ? t('modelEditorLoading') : `${t('modelEditorLoading')} ${Math.round(progress * 100)} %` }}</span>
      </div>

      <div v-else-if="phase === 'error'" class="vp__state vp__state--error" role="alert">
        <TriangleAlert :size="16" aria-hidden="true" />
        <p class="vp__error-title">{{ t('modelEditorLoadFailed') }}</p>
        <p class="ed-hint vp__error-detail">{{ errorDetail }}</p>
        <button v-if="ed.model.value?.glbUrl" type="button" class="ed-btn" @click="retry">
          <RotateCcw :size="16" aria-hidden="true" />
          <span>{{ t('modelEditorRetry') }}</span>
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>

<style scoped>
/*around a device frame: the editor's ground. Inside the frame: the site's
own background, so the preview is what visitors get*/
.vp {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  container-type: size;
  background-color: var(--editor-surface);
}

.vp__frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--me-stage-bg);
}

/*a device frame: the largest box of that shape that fits*/
.vp--desktop .vp__frame {
  width: min(100cqw, 100cqh * var(--me-aspect-desktop));
  height: auto;
  aspect-ratio: var(--me-aspect-desktop);
  outline: var(--border-width) solid var(--editor-accent-line);
}

.vp--phone .vp__frame {
  width: min(100cqw, 100cqh * var(--me-aspect-phone));
  height: auto;
  aspect-ratio: var(--me-aspect-phone);
  outline: var(--border-width) solid var(--editor-accent-line);
}

.vp__frame--picking .vp__canvas { cursor: crosshair; }

.vp__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.vp__state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-lg);
  text-align: center;
  color: var(--editor-text-muted);
}

.vp__state--error { color: var(--editor-danger); }

.vp__error-title {
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text);
}

.vp__error-detail {
  max-width: var(--vsui-panel-xl);
  overflow-wrap: anywhere;
}

.vp__progress {
  display: block;
  width: var(--vsui-panel-sm);
  height: var(--vsui-progress-thin);
  overflow: hidden;
  background-color: var(--editor-line);
  border-radius: var(--border-radius-full);
}

.vp__progress-bar {
  display: block;
  width: 100%;
  height: 100%;
  background-color: var(--editor-accent);
  transform-origin: left;
  transition: transform var(--transition-fast) linear;
}

.vp__progress-bar--unknown { animation: vp-indeterminate var(--me-indeterminate-duration) ease-in-out infinite; }

@keyframes vp-indeterminate {
  from { transform: translateX(-100%) scaleX(0.4); }
  to   { transform: translateX(100%) scaleX(0.4); }
}

@media (prefers-reduced-motion: reduce) {
  .vp__progress-bar--unknown { animation: none; }
}
</style>

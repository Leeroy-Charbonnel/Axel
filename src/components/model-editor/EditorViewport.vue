<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Color, Group, Mesh, MeshBasicMaterial, OctahedronGeometry } from "three"
import { RotateCcw, TriangleAlert } from "lucide-vue-next"
import { useToast } from "../../composables/useToast"
import { useTranslations } from "../../composables/useTranslations"
import { useTheme } from "../../composables/useTheme"
import { disposeObject } from "../../three/dispose"
import type { ModelViewer } from "../../three/modelViewer"
import { useModelEditor } from "./useModelEditor"

//THE EDITOR VIEWPORT - the public ModelViewer on the model being edited, fed
//the document as it changes. A new file means a new viewer: the old one and
//everything it loaded are disposed first. In a desktop or phone frame the
//canvas takes that frame's shape, so what shows here is what visitors get.

const emit = defineEmits<{ ready: [viewer: ModelViewer, firstLoad: boolean] }>()

const ed = useModelEditor()
const toast = useToast()
const { t } = useTranslations()
const { accent } = useTheme()

const MAX_PIXEL_RATIO = 2
//a pointer that moved less than this between down and up is a click, not an orbit
const CLICK_SLOP_PX = 4
//light markers, in model radii
const MARKER_SIZE = 0.05
const MARKER_COLOR = 0xffffff

type Phase = "loading" | "ready" | "error"

const canvas = ref<HTMLCanvasElement | null>(null)
const phase = ref<Phase>("loading")
const progress = ref<number | null>(0)
const errorDetail = ref("")

let current: ModelViewer | null = null
let generation = 0
let loadedOnce = false
let markers: Group | null = null
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
    const { ModelViewer } = await import("../../three/modelViewer")
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
    phase.value = "ready"
    emit("ready", v, !loadedOnce)
    loadedOnce = true
    syncMarkers()
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
  markers = null
  current?.dispose(loseContext)
  current = null
  ed.viewer.value = null
  ed.setup.value = null
}

function retry() {
  void start(ed.model.value?.glbUrl)
}

//LIGHT MARKERS - shown while the lights drawer is open, sized to the model
function syncMarkers() {
  const v = ed.viewer.value
  const setup = ed.setup.value
  if (!v || !setup) return
  if (markers) {
    v.core.scene.remove(markers)
    disposeObject(markers)
    markers = null
  }
  if (ed.showLights.value) {
    markers = new Group()
    const geometry = new OctahedronGeometry(setup.bounds.radius * MARKER_SIZE)
    //The selected marker takes the site accent
    const selectedColor = new Color(accent.value)
    for (const light of ed.doc.value.settings.lights ?? []) {
      if (light.enabled === false) continue
      const selected = light.id === ed.selectedLight.value
      const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: selected ? selectedColor : MARKER_COLOR, wireframe: !selected }))
      mesh.position.set(light.x, light.y, light.z)
      markers.add(mesh)
    }
    v.core.scene.add(markers)
  }
  v.core.requestRender()
}

//EMISSIVE PICKING - a click (not an orbit) on a mesh toggles it
function onPointerDown(e: PointerEvent) {
  down = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  const start = down
  down = null
  const v = ed.viewer.value
  if (!start || !v || !ed.picking.value) return
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return
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
watch([ed.showLights, ed.selectedLight, () => ed.doc.value.settings.lights, accent], syncMarkers)
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

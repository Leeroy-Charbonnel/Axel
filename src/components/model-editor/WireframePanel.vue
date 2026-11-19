<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from "vue"
import { MousePointerClick, Trash2 } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import { useTranslations } from "../../composables/useTranslations"
import { VIEWER_DEFAULTS } from "../../lib/viewer-defaults"
import type { Vec3, WireColor, WireframeMaterialParams } from "../../three/types"
import ColorField from "./ColorField.vue"
import SegmentedControl from "./SegmentedControl.vue"
import SliderField from "./SliderField.vue"
import WireColorField from "./WireColorField.vue"
import { sweepExtent } from "./autoSettings"
import { type GlobalPrefs, useModelEditor } from "./useModelEditor"

//WIREFRAME - this model's colours (surfaces, lines), the line and surface
//settings shared by every model, the sweep that reveals the wireframe (this
//model), and the parts that glow instead.
//Opening this panel shows the wireframe; clicks in the viewport pick parts.

const ed = useModelEditor()
const { t } = useTranslations()

const wf = computed(() => ed.doc.value.settings.wireframeMode ?? {})
const prefs = computed(() => ed.doc.value.prefs)
const setup = computed(() => ed.setup.value)

function setPref<K extends keyof GlobalPrefs>(key: K, value: GlobalPrefs[K]) {
  ed.change(`pref-${key}`, (d) => { d.prefs[key] = value })
}
function setMaterial<K extends keyof WireframeMaterialParams>(key: K, value: WireframeMaterialParams[K]) {
  ed.change(`pref-material-${key}`, (d) => { d.prefs.material[key] = value })
}
function setWf(key: string, mutate: (w: NonNullable<typeof wf.value>) => void) {
  ed.change(`wf-${key}`, (d) => { mutate((d.settings.wireframeMode ??= {})) })
}

//an unset colour is the default one
function setColor(key: "surfaceColor" | "lineColor", value: WireColor | undefined) {
  setWf(key, (w) => {
    if (value === undefined) delete w[key]
    else w[key] = value
  })
}

//SWEEP - axis as a choice, positions as a share of the model's extent on it
type AxisKey = "x" | "y" | "z"
const AXES: Record<AxisKey, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const axis = computed<Vec3>(() => wf.value.sweepAxis ?? setup.value?.sweep.axis ?? AXES.x)
const axisKey = computed<AxisKey | null>(() => {
  const [x, y, z] = axis.value.map(Math.abs) as Vec3
  if (y === 0 && z === 0) return "x"
  if (x === 0 && z === 0) return "y"
  if (x === 0 && y === 0) return "z"
  return null
})
const reversed = computed(() => axis.value.reduce((a, b) => a + b, 0) < 0)
const axisOptions = computed(() => (["x", "y", "z"] as const).map((k) => ({ value: k, label: t(`modelEditorAxis_${k}`) })))
const autoAxisKey = computed<AxisKey | undefined>(() => {
  const a = setup.value?.sweep.axis
  return a ? (["x", "y", "z"] as const)[a.findIndex((v) => v !== 0)] : undefined
})

const extent = computed(() => (setup.value ? sweepExtent(axis.value, setup.value) : { min: 0, max: 1 }))
const span = computed(() => Math.max(1e-6, extent.value.max - extent.value.min))
const toPercent = (v: number) => ((v - extent.value.min) / span.value) * 100
const fromPercent = (p: number) => extent.value.min + (p / 100) * span.value
const startPercent = computed(() => toPercent(wf.value.sweepStart ?? setup.value?.sweep.start ?? extent.value.min))
const endPercent   = computed(() => toPercent(wf.value.sweepEnd ?? setup.value?.sweep.end ?? extent.value.max))
//the auto sweep covers the model, from 0 to 100 % of its own axis
const autoStart = computed(() => (setup.value && axisKey.value === autoAxisKey.value && !reversed.value ? 0 : undefined))
const autoEnd   = computed(() => (autoStart.value === 0 ? 100 : undefined))

//a new axis restarts the sweep over the whole model
function setAxis(key: AxisKey, reverse: boolean) {
  const dir = AXES[key].map((v) => (reverse ? -v : v)) as Vec3
  const s = setup.value
  setWf("axis", (w) => {
    w.sweepAxis = dir
    if (s) {
      const e = sweepExtent(dir, s)
      w.sweepStart = e.min
      w.sweepEnd = e.max
    }
  })
}

//leaving through clay drops the sweep at once, so it runs again from the start
async function replaySweep() {
  ed.preview.value = "clay"
  await nextTick()
  ed.preview.value = "wireframe"
}

//PICKS
const picks = computed(() => wf.value.emissiveMeshes ?? [])

function setPickIntensity(name: string | undefined, v: number) {
  setWf(`pick-${name}`, (w) => {
    const p = w.emissiveMeshes?.find((e) => e.name === name)
    if (p) p.intensity = v
  })
}
function removePick(name: string | undefined) {
  setWf("pick-remove", (w) => {
    w.emissiveMeshes = (w.emissiveMeshes ?? []).filter((e) => e.name !== name)
  })
}

onMounted(() => {
  ed.preview.value = "wireframe"
  ed.picking.value = true
})
onBeforeUnmount(() => { ed.picking.value = false })
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorWireStyle') }}</h3>
      <WireColorField :label="t('modelEditorWireSurface')" :model-value="wf.surfaceColor" :auto="VIEWER_DEFAULTS.wireframeSurfaceColor" @update:model-value="(v) => setColor('surfaceColor', v)" />
      <WireColorField :label="t('modelEditorWireLineColor')" :model-value="wf.lineColor" :auto="VIEWER_DEFAULTS.wireframeLineColor" @update:model-value="(v) => setColor('lineColor', v)" />
      <ToggleField :label="t('modelEditorWireLines')" :model-value="wf.overlayOn ?? VIEWER_DEFAULTS.wireframeOverlayOn" @update:model-value="(v) => setWf('overlayOn', (w) => (w.overlayOn = v))" />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorWireSharedTitle') }}</h3>
      <p class="ed-hint">{{ t('modelEditorWireShared') }}</p>
      <SliderField :label="t('modelEditorWireLineWidth')" :model-value="prefs.lineWidth" :min="0.5" :max="5" :step="0.1" unit="px" :auto="VIEWER_DEFAULTS.wireframeLineWidth" @update:model-value="(v) => setPref('lineWidth', v)" />
      <ColorField :label="t('modelEditorWireGlowColor')" :model-value="prefs.modeColor" :auto="VIEWER_DEFAULTS.wireframeModeColor" @update:model-value="(v) => setPref('modeColor', v)" />
      <SliderField :label="t('modelEditorMetalness')" :model-value="prefs.material.metalness" :min="0" :max="1" :step="0.01" :auto="VIEWER_DEFAULTS.wireframeMaterial.metalness" @update:model-value="(v) => setMaterial('metalness', v)" />
      <SliderField :label="t('modelEditorRoughness')" :model-value="prefs.material.roughness" :min="0" :max="1" :step="0.01" :auto="VIEWER_DEFAULTS.wireframeMaterial.roughness" @update:model-value="(v) => setMaterial('roughness', v)" />
      <SliderField :label="t('modelEditorEnvReflection')" :model-value="prefs.material.envMapIntensity" :min="0" :max="3" :step="0.05" :auto="VIEWER_DEFAULTS.wireframeMaterial.envMapIntensity" @update:model-value="(v) => setMaterial('envMapIntensity', v)" />
      <SliderField :label="t('modelEditorSpecular')" :model-value="prefs.material.specularIntensity" :min="0" :max="1" :step="0.01" :auto="VIEWER_DEFAULTS.wireframeMaterial.specularIntensity" @update:model-value="(v) => setMaterial('specularIntensity', v)" />
    </section>

    <section v-if="setup" class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorSweep') }}</h3>
      <SegmentedControl :label="t('modelEditorSweepAxis')" :model-value="axisKey" :options="axisOptions" :auto="autoAxisKey" @update:model-value="(k) => setAxis(k, false)" />
      <ToggleField :label="t('modelEditorSweepReverse')" :model-value="reversed" @update:model-value="(v) => setAxis(axisKey ?? 'x', v)" />
      <SliderField :label="t('modelEditorSweepStart')" :model-value="startPercent" :min="-20" :max="120" :step="1" unit="%" :auto="autoStart" @update:model-value="(p) => setWf('start', (w) => (w.sweepStart = fromPercent(p)))" />
      <SliderField :label="t('modelEditorSweepEnd')" :model-value="endPercent" :min="-20" :max="120" :step="1" unit="%" :auto="autoEnd" @update:model-value="(p) => setWf('end', (w) => (w.sweepEnd = fromPercent(p)))" />
      <SliderField
        :label="t('modelEditorSweepDuration')"
        :model-value="(wf.sweepDurationMs ?? setup.sweep.durationMs) / 1000"
        :min="0.3"
        :max="5"
        :step="0.1"
        unit="s"
        :auto="setup.sweep.durationMs / 1000"
        @update:model-value="(s) => setWf('duration', (w) => (w.sweepDurationMs = Math.round(s * 1000)))"
      />
      <button type="button" class="ed-btn wp__replay" @click="replaySweep">{{ t('modelEditorSweepReplay') }}</button>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorGlow') }}</h3>
      <p class="wp__pick ed-hint">
        <MousePointerClick :size="14" aria-hidden="true" />
        <span>{{ t('modelEditorGlowHint') }}</span>
      </p>
      <p v-if="!picks.length" class="ed-hint">{{ t('modelEditorGlowEmpty') }}</p>
      <ul v-else class="wp__picks">
        <li v-for="p in picks" :key="p.name" class="wp__pick-item">
          <SliderField class="wp__pick-slider" :label="p.name ?? ''" :model-value="p.intensity" :min="0" :max="10" :step="0.1" @update:model-value="(v) => setPickIntensity(p.name, v)" />
          <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost ed-btn--danger" :aria-label="`${t('modelEditorGlowRemove')} ${p.name}`" @click="removePick(p.name)">
            <Trash2 :size="16" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.wp__replay { align-self: flex-start; }

.wp__pick {
  display: flex;
  align-items: flex-start;
  gap: var(--vsui-space-xs);
}

.wp__pick svg { flex-shrink: 0; }

.wp__picks {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  list-style: none;
}

.wp__pick-item {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
}

.wp__pick-slider { flex: 1; }
</style>

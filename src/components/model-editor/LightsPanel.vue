<script setup lang="ts">
import { computed } from "vue"
import { Eye, EyeOff, Lightbulb, Move3d, Plus, Sun, Trash2 } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import { useTranslations } from "../../composables/useTranslations"
import type { SharedLight } from "../../three/types"
import ColorField from "./ColorField.vue"
import LookSwitch from "./LookSwitch.vue"
import SegmentedControl from "./SegmentedControl.vue"
import SliderField from "./SliderField.vue"
import {
  autoValues, LIGHT_PRESETS, type LightOrbit, lightOrbit, type LightPreset, lightRole, matchPreset, newLight, placeLight,
  presetLights, withLightType,
} from "./autoSettings"
import type { LightPart } from "./lightGizmo"
import { useModelEditor } from "./useModelEditor"

//LIGHTS - the list, then the light picked in it or in the viewport. A light is
//moved with the arrows on it in the viewport; the sliders place it around the
//model for a precise angle. Position, type and shadow are shared by both
//looks, intensity and colour belong to the look being edited.

const ed = useModelEditor()
const { t } = useTranslations()

const mode = computed(() => (ed.preview.value === "wireframe" ? "wireframe" : "normal"))
const lights = computed(() => ed.doc.value.settings.lights ?? [])
const setup = computed(() => ed.setup.value)
const autoById = computed(() => new Map((setup.value ? autoValues(setup.value).lights : []).map((l) => [l.id, l])))
const current = computed(() => lights.value.find((l) => l.id === ed.selectedLight.value?.id) ?? null)
const currentIndex = computed(() => lights.value.findIndex((l) => l.id === ed.selectedLight.value?.id))

//PRESETS
const preset = computed(() => (setup.value ? matchPreset(lights.value, setup.value) : null))
const presetOptions = computed(() => LIGHT_PRESETS.map((p) => ({ value: p, label: t(`modelEditorPreset_${p}`) })))

function applyPreset(p: LightPreset) {
  const s = setup.value
  if (!s) return
  ed.change("light-preset", (d) => {
    d.settings.lights = presetLights(s, p)
  })
  ed.selectedLight.value = null
}

const ROLE_KEYS = { key: "modelEditorLightKey", fill: "modelEditorLightFill", rim: "modelEditorLightRim" } as const

function label(light: SharedLight, i: number): string {
  const role = lightRole(light)
  if (role) return t(ROLE_KEYS[role])
  return `${t(light.type === "point" ? "modelEditorLightPoint" : "modelEditorLightDirectional")} ${i + 1}`
}

function patch(id: string, key: string, mutate: (l: SharedLight) => void) {
  ed.change(`light-${id}-${key}`, (d) => {
    const light = d.settings.lights?.find((l) => l.id === id)
    if (light) mutate(light)
  })
}

function replace(id: string, key: string, next: (l: SharedLight) => SharedLight) {
  ed.change(`light-${id}-${key}`, (d) => {
    d.settings.lights = (d.settings.lights ?? []).map((l) => (l.id === id ? next(l) : l))
  })
}

function select(id: string) {
  ed.selectedLight.value = { id, part: "position" }
}

function add(type: SharedLight["type"]) {
  const s = setup.value
  if (!s) return
  const id = `light-${Date.now().toString(36)}`
  ed.change("light-add", (d) => {
    d.settings.lights = [...(d.settings.lights ?? []), newLight(type, s, id)]
  })
  select(id)
}

function remove(id: string) {
  ed.change("light-remove", (d) => {
    d.settings.lights = (d.settings.lights ?? []).filter((l) => l.id !== id)
  })
  if (ed.selectedLight.value?.id === id) ed.selectedLight.value = null
}

//TYPE
const typeOptions = computed<{ value: SharedLight["type"]; label: string }[]>(() => [
  { value: "directional", label: t("modelEditorLightDirectional") },
  { value: "point",       label: t("modelEditorLightPoint") },
])

function setType(light: SharedLight, type: SharedLight["type"]) {
  const s = setup.value
  if (!s || light.type === type) return
  replace(light.id, "type", (l) => withLightType(l, type, s))
  select(light.id)
}

//WHAT THE ARROWS MOVE - the light, or the point a directional light aims at
const partOptions = computed<{ value: LightPart; label: string }[]>(() => [
  { value: "position", label: t("modelEditorLightMoveLight") },
  { value: "target",   label: t("modelEditorLightMoveTarget") },
])

function setPart(id: string, part: LightPart) {
  ed.selectedLight.value = { id, part }
}

//INTENSITY AND COLOUR of the look being edited
function intensityOf(l: SharedLight): number {
  return mode.value === "normal" ? l.normalIntensity : l.wfIntensity
}
function colorOf(l: SharedLight): string {
  return mode.value === "normal" ? l.normalColor : l.wfColor
}
function setIntensity(l: SharedLight, v: number) {
  const m = mode.value
  patch(l.id, `intensity-${m}`, (x) => {
    if (m === "normal") x.normalIntensity = v
    else x.wfIntensity = v
  })
}
function setColor(l: SharedLight, v: string) {
  const m = mode.value
  patch(l.id, `color-${m}`, (x) => {
    if (m === "normal") x.normalColor = v
    else x.wfColor = v
  })
}

function autoIntensity(l: SharedLight): number | undefined {
  const a = autoById.value.get(l.id)
  return a ? (mode.value === "normal" ? a.normalIntensity : a.wfIntensity) : undefined
}
function autoColor(l: SharedLight): string | undefined {
  const a = autoById.value.get(l.id)
  return a ? (mode.value === "normal" ? a.normalColor : a.wfColor) : undefined
}

//PLACE AROUND THE MODEL
const orbit = computed(() => (current.value && setup.value ? lightOrbit(current.value, setup.value) : null))
const autoOrbit = computed(() => {
  const a = current.value ? autoById.value.get(current.value.id) : undefined
  return a && setup.value ? lightOrbit(a, setup.value) : undefined
})

function setOrbit(light: SharedLight, part: keyof LightOrbit, value: number) {
  const s = setup.value
  if (!s) return
  const next = { ...lightOrbit(light, s), [part]: value }
  replace(light.id, `orbit-${part}`, (l) => placeLight(l, next, s))
}
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorLighting') }}</h3>
      <SegmentedControl :label="t('modelEditorLightPreset')" :model-value="preset" :options="presetOptions" @update:model-value="applyPreset" />
      <p v-if="!lights.length" class="ed-hint">{{ t('modelEditorLightsEmpty') }}</p>
      <ul v-else class="lp__list">
        <li v-for="(light, i) in lights" :key="light.id" class="lp__item" :class="{ 'lp__item--on': current?.id === light.id }">
          <button type="button" class="lp__pick" :aria-pressed="current?.id === light.id" @click="select(light.id)">
            <component :is="light.type === 'point' ? Lightbulb : Sun" :size="16" aria-hidden="true" />
            <span class="lp__name" :class="{ 'lp__name--off': light.enabled === false }">{{ label(light, i) }}</span>
            <span class="lp__swatch" :style="{ backgroundColor: colorOf(light) }" aria-hidden="true"></span>
            <span class="lp__value">{{ intensityOf(light).toFixed(2) }}</span>
          </button>
          <button
            type="button"
            class="ed-btn ed-btn--icon ed-btn--ghost"
            :aria-pressed="light.enabled !== false"
            :aria-label="`${t('modelEditorLightOn')} ${label(light, i)}`"
            :title="t('modelEditorLightOn')"
            @click="patch(light.id, 'enabled', (l) => (l.enabled = l.enabled === false))"
          >
            <component :is="light.enabled === false ? EyeOff : Eye" :size="16" />
          </button>
          <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost ed-btn--danger" :aria-label="`${t('modelEditorLightRemove')} ${label(light, i)}`" :title="t('modelEditorLightRemove')" @click="remove(light.id)">
            <Trash2 :size="16" />
          </button>
        </li>
      </ul>
      <div class="lp__add">
        <button type="button" class="ed-btn" :disabled="!setup" @click="add('directional')">
          <Plus :size="16" aria-hidden="true" />
          <span>{{ t('modelEditorLightAddDirectional') }}</span>
        </button>
        <button type="button" class="ed-btn" :disabled="!setup" @click="add('point')">
          <Plus :size="16" aria-hidden="true" />
          <span>{{ t('modelEditorLightAddPoint') }}</span>
        </button>
      </div>
    </section>

    <section v-if="current && setup && orbit" class="ed-form__section">
      <h3 class="ed-form__title">{{ label(current, currentIndex) }}</h3>
      <p class="lp__move ed-hint">
        <Move3d :size="14" aria-hidden="true" />
        <span>{{ t('modelEditorLightMoveHint') }}</span>
      </p>
      <SegmentedControl
        v-if="current.type === 'directional'"
        :label="t('modelEditorLightMove')"
        :model-value="ed.selectedLight.value?.part ?? 'position'"
        :options="partOptions"
        @update:model-value="(p) => setPart(current!.id, p)"
      />
      <SegmentedControl :label="t('modelEditorLightType')" :model-value="current.type" :options="typeOptions" @update:model-value="(v) => setType(current!, v)" />
      <LookSwitch />
      <ToggleField
        v-if="mode === 'wireframe'"
        :label="t('modelEditorLightOnWireframe')"
        :model-value="current.wfEnabled !== false"
        @update:model-value="(v) => patch(current!.id, 'wfEnabled', (l) => (l.wfEnabled = v))"
      />
      <SliderField :label="t('modelEditorIntensity')" :model-value="intensityOf(current)" :min="0" :max="5" :step="0.05" :auto="autoIntensity(current)" @update:model-value="(v) => setIntensity(current!, v)" />
      <ColorField :label="t('modelEditorColor')" :model-value="colorOf(current)" :auto="autoColor(current)" @update:model-value="(v) => setColor(current!, v)" />
      <SliderField :label="t('modelEditorLightAzimuth')" :model-value="orbit.azimuth" :min="-180" :max="180" :step="1" unit="°" :auto="autoOrbit?.azimuth" @update:model-value="(v) => setOrbit(current!, 'azimuth', v)" />
      <SliderField :label="t('modelEditorLightElevation')" :model-value="orbit.elevation" :min="-30" :max="90" :step="1" unit="°" :auto="autoOrbit?.elevation" @update:model-value="(v) => setOrbit(current!, 'elevation', v)" />
      <SliderField :label="t('modelEditorLightDistance')" :model-value="orbit.distance" :min="0.5" :max="10" :step="0.05" unit="×R" :auto="autoOrbit?.distance" @update:model-value="(v) => setOrbit(current!, 'distance', v)" />
      <SliderField
        v-if="current.type === 'point'"
        :label="t('modelEditorLightRange')"
        :hint="t('modelEditorLightRangeHint')"
        :model-value="(current.range ?? 0) / setup.bounds.radius"
        :min="0"
        :max="20"
        :step="0.1"
        unit="×R"
        @update:model-value="(v) => patch(current!.id, 'range', (l) => (l.range = v * setup!.bounds.radius))"
      />
      <ToggleField
        :label="t('modelEditorLightShadow')"
        :model-value="current.castShadow ?? current.type === 'directional'"
        @update:model-value="(v) => patch(current!.id, 'castShadow', (l) => (l.castShadow = v))"
      />
    </section>
    <p v-else-if="lights.length" class="ed-hint">{{ t('modelEditorLightPickHint') }}</p>
  </div>
</template>

<style scoped>
.lp__list {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.lp__item {
  display: flex;
  align-items: center;
  border-top: var(--border-width) solid var(--editor-line-soft);
}
.lp__item:last-child { border-bottom: var(--border-width) solid var(--editor-line-soft); }

.lp__pick {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--vsui-space-sm);
  min-width: 0;
  min-height: var(--editor-control);
  padding: 0 var(--vsui-space-xs);
  text-align: left;
  color: var(--editor-text);
  border-radius: var(--editor-radius);
  cursor: pointer;
}

.lp__pick:hover { background-color: var(--editor-surface-raised); }
.lp__pick:focus-visible { outline: none; box-shadow: inset var(--editor-focus); }
.lp__item--on .lp__pick {
  color: var(--editor-accent);
  background-color: var(--editor-surface-raised);
}

.lp__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp__name--off {
  color: var(--editor-text-muted);
  text-decoration: line-through;
}

.lp__swatch {
  flex-shrink: 0;
  width: var(--me-swatch-sm);
  height: var(--me-swatch-sm);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
}

.lp__value {
  font-size: var(--editor-fs-sm);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text-muted);
}

.lp__add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--vsui-space-xs);
}

.lp__move {
  display: flex;
  align-items: flex-start;
  gap: var(--vsui-space-xs);
}

.lp__move svg { flex-shrink: 0; }
</style>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronDown, Lightbulb, Plus, Sun, Trash2 } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import { useTranslations } from "../../composables/useTranslations"
import type { SharedLight } from "../../three/types"
import ColorField from "./ColorField.vue"
import SliderField from "./SliderField.vue"
import { autoValues, type LightOrbit, lightOrbit, lightRole, newLight, placeLight } from "./autoSettings"
import { useModelEditor } from "./useModelEditor"

//THE LIGHTS, one list for both looks: position, range and shadows are shared,
//intensity and colour belong to the look being edited. Positions orbit the
//model centre and distances are in model radii, so a light means the same on
//a ring and on a building.

const props = defineProps<{ mode: "normal" | "wireframe" }>()

const ed = useModelEditor()
const { t } = useTranslations()

const lights = computed(() => ed.doc.value.settings.lights ?? [])
const setup = computed(() => ed.setup.value)
const autoById = computed(() => new Map((setup.value ? autoValues(setup.value).lights : []).map((l) => [l.id, l])))

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

function setOrbit(light: SharedLight, part: keyof LightOrbit, value: number) {
  const s = setup.value
  if (!s) return
  const orbit = { ...lightOrbit(light, s), [part]: value }
  patch(light.id, `orbit-${part}`, (l) => Object.assign(l, placeLight(l, orbit, s)))
}

function intensityOf(l: SharedLight): number {
  return props.mode === "normal" ? l.normalIntensity : l.wfIntensity
}
function colorOf(l: SharedLight): string {
  return props.mode === "normal" ? l.normalColor : l.wfColor
}
function setIntensity(l: SharedLight, v: number) {
  patch(l.id, `intensity-${props.mode}`, (x) => {
    if (props.mode === "normal") x.normalIntensity = v
    else x.wfIntensity = v
  })
}
function setColor(l: SharedLight, v: string) {
  patch(l.id, `color-${props.mode}`, (x) => {
    if (props.mode === "normal") x.normalColor = v
    else x.wfColor = v
  })
}

function autoIntensity(l: SharedLight): number | undefined {
  const a = autoById.value.get(l.id)
  return a ? (props.mode === "normal" ? a.normalIntensity : a.wfIntensity) : undefined
}
function autoColor(l: SharedLight): string | undefined {
  const a = autoById.value.get(l.id)
  return a ? (props.mode === "normal" ? a.normalColor : a.wfColor) : undefined
}
function autoOrbit(l: SharedLight): LightOrbit | undefined {
  const a = autoById.value.get(l.id)
  return a && setup.value ? lightOrbit(a, setup.value) : undefined
}

function toggle(id: string) {
  ed.selectedLight.value = ed.selectedLight.value === id ? null : id
}

function add(type: SharedLight["type"]) {
  const s = setup.value
  if (!s) return
  const id = `light-${Date.now().toString(36)}`
  ed.change("light-add", (d) => {
    d.settings.lights = [...(d.settings.lights ?? []), newLight(type, s, id)]
  })
  ed.selectedLight.value = id
}

function remove(id: string) {
  ed.change("light-remove", (d) => {
    d.settings.lights = (d.settings.lights ?? []).filter((l) => l.id !== id)
  })
  if (ed.selectedLight.value === id) ed.selectedLight.value = null
}
</script>

<template>
  <div class="ll">
    <p v-if="!lights.length" class="ed-hint">{{ t('modelEditorLightsEmpty') }}</p>
    <ul class="ll__list">
      <li v-for="(light, i) in lights" :key="light.id" class="ll__item" :class="{ 'll__item--on': ed.selectedLight.value === light.id }">
        <div class="ll__head">
          <button type="button" class="ll__toggle" :aria-expanded="ed.selectedLight.value === light.id" @click="toggle(light.id)">
            <component :is="light.type === 'point' ? Lightbulb : Sun" :size="16" aria-hidden="true" />
            <span class="ll__name" :class="{ 'll__name--off': light.enabled === false }">{{ label(light, i) }}</span>
            <span class="ll__swatch" :style="{ backgroundColor: colorOf(light) }" aria-hidden="true"></span>
            <span class="ll__value">{{ intensityOf(light).toFixed(2) }}</span>
            <ChevronDown :size="16" class="ll__chevron" aria-hidden="true" />
          </button>
          <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost ed-btn--danger" :aria-label="`${t('modelEditorLightRemove')} ${label(light, i)}`" @click="remove(light.id)">
            <Trash2 :size="16" />
          </button>
        </div>

        <div v-if="ed.selectedLight.value === light.id && setup" class="ll__body">
          <ToggleField :label="t('modelEditorLightOn')" :model-value="light.enabled !== false" @update:model-value="(v) => patch(light.id, 'enabled', (l) => (l.enabled = v))" />
          <ToggleField
            v-if="mode === 'wireframe'"
            :label="t('modelEditorLightOnWireframe')"
            :model-value="light.wfEnabled !== false"
            @update:model-value="(v) => patch(light.id, 'wfEnabled', (l) => (l.wfEnabled = v))"
          />
          <SliderField :label="t('modelEditorIntensity')" :model-value="intensityOf(light)" :min="0" :max="5" :step="0.05" :auto="autoIntensity(light)" @update:model-value="(v) => setIntensity(light, v)" />
          <ColorField :label="t('modelEditorColor')" :model-value="colorOf(light)" :auto="autoColor(light)" @update:model-value="(v) => setColor(light, v)" />
          <SliderField :label="t('modelEditorLightAzimuth')" :model-value="lightOrbit(light, setup).azimuth" :min="-180" :max="180" :step="1" unit="°" :auto="autoOrbit(light)?.azimuth" @update:model-value="(v) => setOrbit(light, 'azimuth', v)" />
          <SliderField :label="t('modelEditorLightElevation')" :model-value="lightOrbit(light, setup).elevation" :min="-30" :max="90" :step="1" unit="°" :auto="autoOrbit(light)?.elevation" @update:model-value="(v) => setOrbit(light, 'elevation', v)" />
          <SliderField :label="t('modelEditorLightDistance')" :model-value="lightOrbit(light, setup).distance" :min="0.5" :max="10" :step="0.05" unit="×R" :auto="autoOrbit(light)?.distance" @update:model-value="(v) => setOrbit(light, 'distance', v)" />
          <SliderField
            v-if="light.type === 'point'"
            :label="t('modelEditorLightRange')"
            :hint="t('modelEditorLightRangeHint')"
            :model-value="(light.range ?? 0) / setup.bounds.radius"
            :min="0"
            :max="20"
            :step="0.1"
            unit="×R"
            @update:model-value="(v) => patch(light.id, 'range', (l) => (l.range = v * setup!.bounds.radius))"
          />
          <ToggleField
            :label="t('modelEditorLightShadow')"
            :model-value="light.castShadow ?? light.type === 'directional'"
            @update:model-value="(v) => patch(light.id, 'castShadow', (l) => (l.castShadow = v))"
          />
        </div>
      </li>
    </ul>
    <div class="ll__add">
      <button type="button" class="ed-btn" :disabled="!setup" @click="add('directional')">
        <Plus :size="16" aria-hidden="true" />
        <span>{{ t('modelEditorLightAddDirectional') }}</span>
      </button>
      <button type="button" class="ed-btn" :disabled="!setup" @click="add('point')">
        <Plus :size="16" aria-hidden="true" />
        <span>{{ t('modelEditorLightAddPoint') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ll {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ll__list {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.ll__item { border-top: var(--border-width) solid var(--editor-line); }
.ll__item:last-child { border-bottom: var(--border-width) solid var(--editor-line); }

.ll__head {
  display: flex;
  align-items: center;
}

.ll__toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: var(--editor-target);
  padding: 0 var(--spacing-xxs);
  font-size: var(--font-size-sm);
  text-align: left;
  color: var(--editor-text);
  cursor: pointer;
}

.ll__toggle:focus-visible { outline: none; box-shadow: inset var(--editor-focus); }
.ll__item--on .ll__toggle { color: var(--editor-accent); }

.ll__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ll__name--off {
  color: var(--editor-text-muted);
  text-decoration: line-through;
}

.ll__swatch {
  width: var(--me-dot-size);
  height: var(--me-dot-size);
  border: var(--border-width) solid var(--editor-line);
}

.ll__value {
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text-muted);
}

.ll__chevron { transition: transform var(--transition-fast) ease; }
.ll__item--on .ll__chevron { transform: rotate(180deg); }

.ll__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-xxs) var(--spacing-md);
}

.ll__add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
</style>

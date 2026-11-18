<script setup lang="ts">
import { computed, ref } from "vue"
import { ChevronDown, RotateCcw } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import { useTranslations } from "../../composables/useTranslations"
import type { MaterialSlot } from "../../three/modelViewer"
import type { MaterialState } from "../../three/types"
import ColorField from "./ColorField.vue"
import SliderField from "./SliderField.vue"
import { useModelEditor } from "./useModelEditor"

//MATERIALS - every material of the file, as it was exported. Only the ones
//changed here are saved, matched by name (by index when the file gives none).
//The auto value of each control is the exported one.

const ed = useModelEditor()
const { t } = useTranslations()

const open = ref<string | null>(null)

const keyOf = (s: { name?: string; index?: number }) => (s.name ? `n:${s.name}` : `i:${s.index}`)
const labelOf = (s: MaterialSlot) => s.name || t("modelEditorMaterialUnnamed").replace("{n}", String(s.index))

const overrides = computed(() => new Map((ed.doc.value.settings.materials ?? []).map((m) => [keyOf(m), m])))
const overriddenCount = computed(() => ed.slots.value.filter((s) => overrides.value.has(keyOf(s))).length)

function stateOf(slot: MaterialSlot): MaterialState {
  return overrides.value.get(keyOf(slot)) ?? slot.defaults
}

//the first change creates the override from the exported values
function set<K extends keyof MaterialState>(slot: MaterialSlot, key: K, value: MaterialState[K]) {
  const id = keyOf(slot)
  ed.change(`material-${id}-${key}`, (d) => {
    const list = d.settings.materials ?? []
    let spec = list.find((m) => keyOf(m) === id)
    if (!spec) {
      spec = { ...slot.defaults, ...(slot.name ? { name: slot.name } : { index: slot.index }) }
      list.push(spec)
    }
    spec[key] = value
    //every value back on the export: nothing left to save
    const asExported = (Object.keys(slot.defaults) as (keyof MaterialState)[]).every((k) => spec[k] === slot.defaults[k])
    d.settings.materials = asExported ? list.filter((m) => m !== spec) : list
    if (d.settings.materials.length === 0) delete d.settings.materials
  })
}

function reset(slot: MaterialSlot) {
  const id = keyOf(slot)
  ed.change(`material-${id}-reset`, (d) => {
    d.settings.materials = (d.settings.materials ?? []).filter((m) => keyOf(m) !== id)
    if (d.settings.materials.length === 0) delete d.settings.materials
  })
}
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <p class="ed-hint">{{ t('modelEditorMaterialsIntro') }}</p>
      <p v-if="!ed.slots.value.length" class="ed-hint">{{ ed.viewer.value ? t('modelEditorMaterialsEmpty') : t('modelEditorLoading') }}</p>
      <p v-else class="ed-label">{{ t('modelEditorMaterialsCount').replace('{n}', String(ed.slots.value.length)).replace('{m}', String(overriddenCount)) }}</p>

      <ul class="mp__list">
        <li v-for="slot in ed.slots.value" :key="keyOf(slot)" class="mp__item" :class="{ 'mp__item--on': open === keyOf(slot) }">
          <button type="button" class="mp__head" :aria-expanded="open === keyOf(slot)" @click="open = open === keyOf(slot) ? null : keyOf(slot)">
            <span class="mp__swatch" :style="{ backgroundColor: stateOf(slot).color }" aria-hidden="true"></span>
            <span class="mp__name">{{ labelOf(slot) }}</span>
            <span v-if="overrides.has(keyOf(slot))" class="mp__changed">{{ t('modelEditorMaterialChanged') }}</span>
            <ChevronDown :size="16" class="mp__chevron" aria-hidden="true" />
          </button>
          <div v-if="open === keyOf(slot)" class="mp__body">
            <ColorField :label="t('modelEditorColor')" :model-value="stateOf(slot).color" :auto="slot.defaults.color" @update:model-value="(v) => set(slot, 'color', v)" />
            <SliderField :label="t('modelEditorMetalness')" :model-value="stateOf(slot).metalness" :min="0" :max="1" :step="0.01" :auto="slot.defaults.metalness" @update:model-value="(v) => set(slot, 'metalness', v)" />
            <SliderField :label="t('modelEditorRoughness')" :model-value="stateOf(slot).roughness" :min="0" :max="1" :step="0.01" :auto="slot.defaults.roughness" @update:model-value="(v) => set(slot, 'roughness', v)" />
            <SliderField :label="t('modelEditorEnvReflection')" :model-value="stateOf(slot).envMapIntensity" :min="0" :max="3" :step="0.05" :auto="slot.defaults.envMapIntensity" @update:model-value="(v) => set(slot, 'envMapIntensity', v)" />
            <SliderField :label="t('modelEditorSpecular')" :model-value="stateOf(slot).specularIntensity" :min="0" :max="1" :step="0.01" :auto="slot.defaults.specularIntensity" @update:model-value="(v) => set(slot, 'specularIntensity', v)" />
            <ToggleField :label="t('modelEditorEmission')" :model-value="stateOf(slot).emissiveEnabled" @update:model-value="(v) => set(slot, 'emissiveEnabled', v)" />
            <template v-if="stateOf(slot).emissiveEnabled">
              <ColorField :label="t('modelEditorEmissionColor')" :model-value="stateOf(slot).emissive" :auto="slot.defaults.emissive" @update:model-value="(v) => set(slot, 'emissive', v)" />
              <SliderField :label="t('modelEditorIntensity')" :model-value="stateOf(slot).emissiveIntensity" :min="0" :max="10" :step="0.05" :auto="slot.defaults.emissiveIntensity" @update:model-value="(v) => set(slot, 'emissiveIntensity', v)" />
            </template>
            <button v-if="overrides.has(keyOf(slot))" type="button" class="ed-btn mp__reset" @click="reset(slot)">
              <RotateCcw :size="16" aria-hidden="true" />
              <span>{{ t('modelEditorMaterialReset') }}</span>
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.mp__list {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.mp__item { border-top: var(--border-width) solid var(--editor-line-soft); }
.mp__item:last-child { border-bottom: var(--border-width) solid var(--editor-line-soft); }

.mp__head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  width: 100%;
  min-height: var(--editor-control);
  padding: 0 var(--vsui-space-xs);
  text-align: left;
  color: var(--editor-text);
  border-radius: var(--editor-radius);
  cursor: pointer;
}

.mp__head:hover { background-color: var(--editor-surface-raised); }
.mp__head:focus-visible { outline: none; box-shadow: inset var(--editor-focus); }
.mp__item--on .mp__head { color: var(--editor-accent); }

.mp__swatch {
  flex-shrink: 0;
  width: var(--me-swatch-sm);
  height: var(--me-swatch-sm);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
}

.mp__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mp__changed {
  font-size: var(--editor-fs-xs);
  color: var(--editor-accent);
}

.mp__chevron {
  flex-shrink: 0;
  color: var(--editor-text-muted);
  transition: transform var(--transition-fast) ease;
}
.mp__item--on .mp__chevron { transform: rotate(180deg); }

.mp__body {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs) 0 var(--vsui-space-md);
}

.mp__reset { align-self: flex-start; }
</style>

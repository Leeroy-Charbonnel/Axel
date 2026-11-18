<script setup lang="ts">
import { computed, ref } from "vue"
import { RotateCcw } from "lucide-vue-next"
import ColorField from "../../model-editor/ColorField.vue"
import SliderField from "../../model-editor/SliderField.vue"
import { useEditor } from "../../../composables/useEditor"
import { stylesheetVars, useTheme } from "../../../composables/useTheme"
import { useToast } from "../../../composables/useToast"
import { useTranslations } from "../../../composables/useTranslations"
import { THEME_VARS, hexToHsl, hslToHex, isRegistered } from "../../../lib/theme-vars"

//One row per theme token, then a reset of every row; edits show on the whole site at once

const { overridden, value, defaultValue } = useTheme()
const { setThemeVar, resetTheme } = useEditor()
const { t } = useTranslations()
const toast = useToast()

//Every other variable of the site, filtered by name
const query = ref("")
const names = computed(() => Object.keys(stylesheetVars()).filter((n) => !isRegistered(n)).sort())
const shown = computed(() => names.value.filter((n) => n.includes(query.value.trim().toLowerCase())))

function apply(name: string, e: Event) {
  const input = e.target as HTMLInputElement
  try {
    setThemeVar(name, input.value)
  } catch (err) {
    toast.error(t("themeVarInvalid").replace("{name}", name))
    input.value = value(name)
    console.error(err)
  }
}
</script>

<template>
  <div class="theme ed-ui">
    <template v-for="def in THEME_VARS" :key="def.name">
      <ColorField
        v-if="def.type === 'color'"
        :label="t(def.labelKey)"
        :model-value="hslToHex(value(def.name))"
        :auto="hslToHex(defaultValue(def.name))"
        @update:model-value="setThemeVar(def.name, hexToHsl($event))"
      />
      <SliderField
        v-else
        :label="t(def.labelKey)"
        :model-value="Number(value(def.name))"
        :auto="Number(defaultValue(def.name))"
        :min="def.min"
        :max="def.max"
        :step="def.step"
        strict
        @update:model-value="setThemeVar(def.name, String($event))"
      />
    </template>
    <input v-model="query" class="ed-input" type="search" :placeholder="t('themeVarSearch')" :aria-label="t('themeVarSearch')" />
    <div class="theme__vars">
      <label v-for="name in shown" :key="name" class="theme__var" :class="{ 'theme__var--set': value(name) !== defaultValue(name) }">
        <span class="theme__name" :title="name">{{ name }}</span>
        <input class="ed-input theme__value" :value="value(name)" spellcheck="false" @change="apply(name, $event)" @keydown.enter="apply(name, $event)" />
      </label>
    </div>
    <button type="button" class="ed-btn ed-btn--ghost theme__reset" :disabled="!overridden" @click="resetTheme()">
      <RotateCcw class="theme__icon" aria-hidden="true" />
      {{ t("themeResetAll") }}
    </button>
  </div>
</template>

<style scoped>
.theme {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
}

.theme__reset { align-self: flex-start; }

.theme__vars {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-2xs);
}

.theme__var {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--vsui-space-xs);
}

.theme__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, monospace;
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
}

.theme__var--set .theme__name { color: var(--editor-accent); }

.theme__value { font-size: var(--editor-fs-xs); }

.theme__icon {
  width: var(--editor-icon);
  height: var(--editor-icon);
}
</style>

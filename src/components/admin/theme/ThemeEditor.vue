<script setup lang="ts">
import { RotateCcw } from "lucide-vue-next"
import ColorField from "../../model-editor/ColorField.vue"
import SliderField from "../../model-editor/SliderField.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTheme } from "../../../composables/useTheme"
import { useTranslations } from "../../../composables/useTranslations"
import { THEME_VARS, hexToHsl, hslToHex } from "../../../lib/theme-vars"

//One row per theme token, then a reset of every row; edits show on the whole site at once

const { overridden, value, defaultValue } = useTheme()
const { setThemeVar, resetTheme } = useEditor()
const { t } = useTranslations()
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

.theme__icon {
  width: var(--editor-icon);
  height: var(--editor-icon);
}
</style>

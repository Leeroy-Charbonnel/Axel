<script setup lang="ts">
import { computed } from "vue"
import { RotateCcw } from "lucide-vue-next"
import ColorField from "../../model-editor/ColorField.vue"
import SliderField from "../../model-editor/SliderField.vue"
import ThemeTextField from "./ThemeTextField.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTheme } from "../../../composables/useTheme"
import { useTranslations } from "../../../composables/useTranslations"
import { THEME_GROUPS, THEME_VARS, hexToHsl, hslToHex, lengthNumber, type LengthVarDef } from "../../../lib/theme-vars"

//THE CSS TAB - the main tokens of the site by group, each with the control of
//its type: a colour picker, a slider for a number or a length, a text box for
//the rest. Edits show on the whole site at once and wait for Save.

const { overridden, value, defaultValue } = useTheme()
const { setThemeVar, resetTheme } = useEditor()
const { t } = useTranslations()

const groups = computed(() => THEME_GROUPS.map((group) => ({
  ...group,
  vars: THEME_VARS.filter((def) => def.group === group.key),
})))

function lengthOf(def: LengthVarDef, text: string): number {
  const n = lengthNumber(def, text)
  if (n === null) throw new Error(`[theme] "${text}" is not a length in ${def.unit} for ${def.name}`)
  return n
}
</script>

<template>
  <div class="theme ed-ui ed-form">
    <section v-for="group in groups" :key="group.key" class="ed-form__section">
      <h3 class="ed-form__title">{{ t(group.labelKey) }}</h3>
      <template v-for="def in group.vars" :key="def.name">
        <ColorField
          v-if="def.type === 'color'"
          :label="t(def.labelKey)"
          :model-value="hslToHex(value(def.name))"
          :auto="hslToHex(defaultValue(def.name))"
          @update:model-value="setThemeVar(def.name, hexToHsl($event))"
        />
        <SliderField
          v-else-if="def.type === 'length'"
          :label="t(def.labelKey)"
          :model-value="lengthOf(def, value(def.name))"
          :auto="lengthOf(def, defaultValue(def.name))"
          :min="def.min"
          :max="def.max"
          :step="def.step"
          :unit="def.unit"
          strict
          @update:model-value="setThemeVar(def.name, `${$event}${def.unit}`)"
        />
        <SliderField
          v-else-if="def.type === 'number'"
          :label="t(def.labelKey)"
          :model-value="Number(value(def.name))"
          :auto="Number(defaultValue(def.name))"
          :min="def.min"
          :max="def.max"
          :step="def.step"
          strict
          @update:model-value="setThemeVar(def.name, String($event))"
        />
        <ThemeTextField
          v-else
          :label="t(def.labelKey)"
          :name="def.name"
          :model-value="value(def.name)"
          :auto="defaultValue(def.name)"
          @update:model-value="setThemeVar(def.name, $event)"
        />
      </template>
    </section>
    <button type="button" class="ed-btn ed-btn--ghost theme__reset" :disabled="!overridden" @click="resetTheme()">
      <RotateCcw class="theme__icon" aria-hidden="true" />
      {{ t("themeResetAll") }}
    </button>
  </div>
</template>

<style scoped>
.theme { padding: var(--vsui-space-sm); }

.theme__reset { align-self: flex-start; }

.theme__icon {
  width: var(--editor-icon);
  height: var(--editor-icon);
}
</style>

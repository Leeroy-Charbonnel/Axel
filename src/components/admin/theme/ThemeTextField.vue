<script setup lang="ts">
import { ref, useId, watch } from "vue"
import AutoDot from "../../model-editor/AutoDot.vue"
import { useTranslations } from "../../../composables/useTranslations"
import { isThemeValue, themeVar } from "../../../lib/theme-vars"

//A theme token typed as plain CSS, on one property row with the auto mark.
//The value is sent on Enter or when the box is left; a refused value stays in
//the box with its error.

const props = defineProps<{
  label:      string
  name:       string
  modelValue: string
  auto:       string
}>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const { t } = useTranslations()
const id = useId()
const text = ref(props.modelValue)
const invalid = ref(false)

//An undo, a reset or a discard replaces the typed text
watch(() => props.modelValue, (value) => {
  text.value = value
  invalid.value = false
})

function apply() {
  const next = text.value.trim()
  invalid.value = !isThemeValue(themeVar(props.name), next)
  if (!invalid.value && next !== props.modelValue) emit("update:modelValue", next)
}
</script>

<template>
  <div class="theme-text">
    <div class="theme-text__head">
      <label :for="id" class="ed-label theme-text__label">{{ label }}</label>
      <AutoDot :differs="modelValue !== auto" @reset="emit('update:modelValue', auto)" />
    </div>
    <input
      :id="id"
      v-model="text"
      class="ed-input theme-text__input"
      spellcheck="false"
      autocomplete="off"
      :aria-invalid="invalid"
      :aria-describedby="invalid ? `${id}-error` : undefined"
      @change="apply"
      @keydown.enter="apply"
    />
    <p v-if="invalid" :id="`${id}-error`" class="ed-error theme-text__error" role="alert">{{ t("themeVarInvalid").replace("{name}", label) }}</p>
  </div>
</template>

<style scoped>
/*label | value, on the columns of the sliders and the colours*/
.theme-text {
  display: grid;
  grid-template-columns: var(--editor-label-col) minmax(0, 1fr);
  align-items: center;
  column-gap: var(--vsui-space-sm);
  row-gap: var(--vsui-space-2xs);
  min-width: 0;
}

.theme-text__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-icon);
  align-items: center;
  gap: var(--vsui-space-2xs);
  min-width: 0;
}

.theme-text__label { overflow-wrap: break-word; hyphens: auto; }

.theme-text__input { font-size: var(--editor-fs-sm); }

.theme-text__error { grid-column: 1 / -1; }
</style>

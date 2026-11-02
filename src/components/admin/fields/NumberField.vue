<script setup lang="ts">
import Field from "./Field.vue"
import { useValidatedInput, type Parsed } from "./useValidatedInput"
import { useTranslations } from "../../../composables/useTranslations"

//whole, non-negative numbers; spaces used as thousands separators are accepted
const props = defineProps<{
  label:      string
  modelValue: number
  hint?:      string
}>()

const emit = defineEmits<{ "update:modelValue": [value: number] }>()
const { t } = useTranslations()

function parse(text: string): Parsed<number> {
  const compact = text.replace(/\s/g, "")
  if (!/^\d+$/.test(compact)) return { ok: false, error: t("fieldErrorInteger") }
  return { ok: true, value: Number(compact) }
}

const { text, error, onInput } = useValidatedInput(
  () => props.modelValue,
  (value) => String(value),
  parse,
  (value) => emit("update:modelValue", value),
)
</script>

<template>
  <Field :label="label" :hint="hint" :error="error" v-slot="{ id, describedBy, invalid }">
    <input
      :id="id"
      class="ed-input"
      type="text"
      inputmode="numeric"
      :value="text"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
  </Field>
</template>

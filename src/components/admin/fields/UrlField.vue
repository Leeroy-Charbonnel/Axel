<script setup lang="ts">
import Field from "./Field.vue"
import { useValidatedInput, type Parsed } from "./useValidatedInput"
import { useTranslations } from "../../../composables/useTranslations"

//an empty value is allowed (the link is hidden); anything else must be an http(s) address
const props = defineProps<{
  label:        string
  modelValue:   string
  placeholder?: string
  hint?:        string
}>()

const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const { t } = useTranslations()

function parse(text: string): Parsed<string> {
  const value = text.trim()
  if (!value) return { ok: true, value: "" }
  try {
    const url = new URL(value)
    if (url.protocol === "http:" || url.protocol === "https:") return { ok: true, value }
  } catch {
    //not a URL at all: same answer as a wrong protocol
  }
  return { ok: false, error: t("fieldErrorUrl") }
}

const { text, error, onInput } = useValidatedInput(
  () => props.modelValue,
  (value) => value,
  parse,
  (value) => emit("update:modelValue", value),
)
</script>

<template>
  <Field :label="label" :hint="hint" :error="error" v-slot="{ id, describedBy, invalid }">
    <input
      :id="id"
      class="ed-input"
      type="url"
      inputmode="url"
      autocomplete="url"
      :value="text"
      :placeholder="placeholder ?? 'https://'"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
  </Field>
</template>

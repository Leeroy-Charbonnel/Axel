<script setup lang="ts">
import Field from "./Field.vue"

const TEXTAREA_ROWS = 4

withDefaults(defineProps<{
  label:        string
  modelValue:   string
  rows?:        number
  placeholder?: string
  hint?:        string
}>(), { rows: TEXTAREA_ROWS })

defineEmits<{ "update:modelValue": [value: string] }>()
</script>

<template>
  <Field :label="label" :hint="hint" v-slot="{ id, describedBy }">
    <textarea
      :id="id"
      class="ed-input"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-describedby="describedBy"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </Field>
</template>

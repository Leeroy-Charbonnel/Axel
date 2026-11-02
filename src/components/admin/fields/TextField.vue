<script setup lang="ts">
import Field from "./Field.vue"

withDefaults(defineProps<{
  label:         string
  modelValue:    string
  type?:         "text" | "email" | "tel"
  placeholder?:  string
  hint?:         string
  autocomplete?: string
}>(), { type: "text" })

defineEmits<{ "update:modelValue": [value: string] }>()
</script>

<template>
  <Field :label="label" :hint="hint" v-slot="{ id, describedBy }">
    <input
      :id="id"
      class="ed-input"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-describedby="describedBy"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </Field>
</template>

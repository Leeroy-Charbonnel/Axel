<script setup lang="ts" generic="V extends string">
import Field from "./Field.vue"

defineProps<{
  label:      string
  modelValue: V
  options:    { value: V; label: string }[]
  hint?:      string
}>()

defineEmits<{ "update:modelValue": [value: V] }>()
</script>

<template>
  <Field :label="label" :hint="hint" v-slot="{ id, describedBy }">
    <select
      :id="id"
      class="ed-input"
      :value="modelValue"
      :aria-describedby="describedBy"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as V)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </Field>
</template>

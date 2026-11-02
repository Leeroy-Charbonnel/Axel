<script setup lang="ts">
import { computed, useId } from "vue"
import AutoDot from "./AutoDot.vue"

//A colour swatch and its hex code, with the auto mark.

const props = withDefaults(defineProps<{
  label:      string
  modelValue: string
  auto?:      string
}>(), { auto: undefined })

const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const id = useId()
const differs = computed(() => props.auto !== undefined && props.auto.toLowerCase() !== props.modelValue.toLowerCase())
</script>

<template>
  <div class="color">
    <label :for="id" class="ed-label color__label">{{ label }}</label>
    <AutoDot :differs="differs" @reset="auto !== undefined && emit('update:modelValue', auto)" />
    <span class="color__code">{{ modelValue.toUpperCase() }}</span>
    <input
      :id="id"
      class="color__swatch"
      type="color"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.color {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: var(--editor-target);
}

.color__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color__code {
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text-muted);
}

.color__swatch {
  width: var(--me-swatch);
  height: var(--me-swatch);
  padding: 0;
  background: none;
  border: var(--border-width) solid var(--editor-line);
  cursor: pointer;
}

.color__swatch::-webkit-color-swatch-wrapper { padding: 0; }
.color__swatch::-webkit-color-swatch { border: none; }
.color__swatch:focus-visible { outline: none; box-shadow: var(--editor-focus); }
</style>

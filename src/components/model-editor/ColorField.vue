<script setup lang="ts">
import { computed, useId } from "vue"
import AutoDot from "./AutoDot.vue"

//A colour swatch and its hex code, with the auto mark, on one property row.

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
    <div class="color__head">
      <label :for="id" class="ed-label color__label">{{ label }}</label>
      <AutoDot :differs="differs" @reset="auto !== undefined && emit('update:modelValue', auto)" />
    </div>
    <div class="color__value">
      <input
        :id="id"
        class="color__swatch"
        type="color"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <span class="color__code">{{ modelValue.toUpperCase() }}</span>
    </div>
  </div>
</template>

<style scoped>
.color {
  display: grid;
  grid-template-columns: var(--editor-label-col) minmax(0, 1fr);
  align-items: center;
  column-gap: var(--vsui-space-sm);
  min-width: 0;
}

/*the auto mark keeps its slot, so a label never rewraps when it shows*/
.color__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-icon);
  align-items: center;
  gap: var(--vsui-space-2xs);
  min-width: 0;
}

.color__label { overflow-wrap: break-word; hyphens: auto; }

.color__value {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  min-width: 0;
}

.color__swatch {
  flex-shrink: 0;
  width: var(--editor-control);
  height: var(--editor-control);
  padding: var(--vsui-space-2xs);
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line-soft);
  border-radius: var(--editor-radius);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease;
}

.color__swatch:hover { border-color: var(--editor-line); }
.color__swatch:focus-visible { outline: none; border-color: var(--editor-accent); }
.color__swatch::-webkit-color-swatch-wrapper { padding: 0; }
.color__swatch::-webkit-color-swatch {
  border: none;
  border-radius: calc(var(--editor-radius) - var(--vsui-space-2xs));
}
.color__swatch::-moz-color-swatch {
  border: none;
  border-radius: calc(var(--editor-radius) - var(--vsui-space-2xs));
}

.color__code {
  font-size: var(--editor-fs-sm);
  font-variant-numeric: tabular-nums;
  color: var(--editor-text);
}
</style>

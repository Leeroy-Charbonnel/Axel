<script setup lang="ts">
import { computed, useId } from "vue"
import AutoDot from "./AutoDot.vue"

//A number on a slider, with its value typed in beside it and the auto mark.
//The slider bounds are a comfortable range, not a limit: a typed value may
//leave them.

const props = withDefaults(defineProps<{
  label:      string
  modelValue: number
  min:        number
  max:        number
  step?:      number
  //shown after the value: "×R", "%", "°"...
  unit?:      string
  //the automatic value; the mark shows while the value differs from it
  auto?:      number
  hint?:      string
}>(), { step: 0.01, unit: "", auto: undefined, hint: undefined })

const emit = defineEmits<{ "update:modelValue": [value: number] }>()

const id = useId()
const decimals = computed(() => {
  const s = String(props.step)
  return s.includes(".") ? s.length - s.indexOf(".") - 1 : 0
})
const shown = computed(() => Number(props.modelValue.toFixed(decimals.value)))
const differs = computed(() => props.auto !== undefined && Math.abs(props.modelValue - props.auto) > props.step / 2)

function onInput(raw: string) {
  const v = Number(raw)
  if (raw.trim() !== "" && Number.isFinite(v)) emit("update:modelValue", v)
}
</script>

<template>
  <div class="slider">
    <div class="slider__head">
      <label :for="id" class="ed-label slider__label">{{ label }}</label>
      <AutoDot :differs="differs" @reset="auto !== undefined && emit('update:modelValue', auto)" />
      <span class="slider__value">
        <input
          class="slider__number"
          type="number"
          :step="step"
          :value="shown"
          :aria-label="label"
          @change="onInput(($event.target as HTMLInputElement).value)"
        />
        <span v-if="unit" class="slider__unit">{{ unit }}</span>
      </span>
    </div>
    <input
      :id="id"
      class="slider__range"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
    <p v-if="hint" class="ed-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.slider {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.slider__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: var(--me-dot-target);
}

.slider__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slider__value {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-xxs);
}

.slider__number {
  width: var(--me-number-width);
  padding: 0 var(--spacing-xxs);
  font: inherit;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--editor-text);
  background-color: transparent;
  border: var(--border-width) solid transparent;
  appearance: textfield;
}

.slider__number::-webkit-inner-spin-button,
.slider__number::-webkit-outer-spin-button { appearance: none; margin: 0; }
.slider__number:hover { border-color: var(--editor-line); }
.slider__number:focus-visible {
  outline: none;
  border-color: var(--editor-accent);
  background-color: var(--editor-input-bg);
}

.slider__unit {
  font-size: var(--font-size-xs);
  color: var(--editor-text-muted);
}

.slider__range {
  width: 100%;
  height: var(--me-range-target);
  margin: 0;
  background: transparent;
  cursor: pointer;
  accent-color: var(--editor-accent);
}

.slider__range:focus-visible { outline: none; box-shadow: var(--editor-focus); }
</style>

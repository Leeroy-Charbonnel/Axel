<script setup lang="ts">
import { computed, ref, useId } from "vue"
import AutoDot from "./AutoDot.vue"

//A number on a slider, with its value typed in beside it and the auto mark,
//on one property row. The slider bounds are a comfortable range, not a limit:
//a typed value may leave them, unless the field is strict.

const props = withDefaults(defineProps<{
  label:      string
  modelValue: number
  min:        number
  max:        number
  step?:      number
  //Shown after the value: "×R", "%", "°"...
  unit?:      string
  //The automatic value; the mark shows while the value differs from it
  auto?:      number
  hint?:      string
  //The value is sent when the slider is released; the number follows the drag
  lazy?:      boolean
  //The bounds and the step are limits: a typed value is brought onto them
  strict?:    boolean
}>(), { step: 0.01, unit: "", auto: undefined, hint: undefined, lazy: false, strict: false })

const emit = defineEmits<{ "update:modelValue": [value: number] }>()

const id = useId()
//The slider value during a lazy drag
const dragged = ref<number | null>(null)
const decimals = computed(() => {
  const s = String(props.step)
  return s.includes(".") ? s.length - s.indexOf(".") - 1 : 0
})
const round = (v: number) => Number(v.toFixed(decimals.value))
const shown = computed(() => round(dragged.value ?? props.modelValue))
const differs = computed(() => props.auto !== undefined && Math.abs(props.modelValue - props.auto) > props.step / 2)

function parse(raw: string): number | null {
  const v = Number(raw)
  if (raw.trim() === "" || !Number.isFinite(v)) return null
  if (!props.strict) return v
  const snapped = props.min + Math.round((v - props.min) / props.step) * props.step
  return round(Math.min(props.max, Math.max(props.min, snapped)))
}

function onSlide(raw: string) {
  const v = parse(raw)
  if (v === null) return
  if (props.lazy) dragged.value = v
  else emit("update:modelValue", v)
}

function onRelease(raw: string) {
  dragged.value = null
  const v = parse(raw)
  if (props.lazy && v !== null) emit("update:modelValue", v)
}

//A typed value out of the limits shows where it landed
function onType(e: Event) {
  const input = e.target as HTMLInputElement
  const v = parse(input.value)
  if (v === null) return
  input.value = String(v)
  emit("update:modelValue", v)
}
</script>

<template>
  <div class="slider">
    <div class="slider__head">
      <label :for="id" class="ed-label slider__label">{{ label }}</label>
      <AutoDot :differs="differs" @reset="auto !== undefined && emit('update:modelValue', auto)" />
    </div>
    <input
      :id="id"
      class="slider__range"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="dragged ?? modelValue"
      @input="onSlide(($event.target as HTMLInputElement).value)"
      @change="onRelease(($event.target as HTMLInputElement).value)"
    />
    <span class="slider__value">
      <input
        class="ed-input slider__number"
        type="number"
        :step="step"
        :value="shown"
        :aria-label="label"
        @change="onType"
      />
      <span v-if="unit" class="slider__unit">{{ unit }}</span>
    </span>
    <p v-if="hint" class="ed-hint slider__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
/*label | slider | value: the value column has one width, so every slider of
a panel starts and ends on the same lines*/
.slider {
  display: grid;
  grid-template-columns: var(--editor-label-col) minmax(0, 1fr) var(--me-number-width);
  align-items: center;
  column-gap: var(--vsui-space-sm);
  row-gap: var(--vsui-space-2xs);
  min-width: 0;
}

/*the auto mark keeps its slot, so a label never rewraps when it shows*/
.slider__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-icon);
  align-items: center;
  gap: var(--vsui-space-2xs);
  min-width: 0;
}

.slider__label { overflow-wrap: break-word; hyphens: auto; }

.slider__range {
  width: 100%;
  min-width: 0;
  height: var(--editor-control);
  margin: 0;
  background: transparent;
  border-radius: var(--editor-radius);
  cursor: pointer;
  accent-color: var(--editor-accent);
}

.slider__range:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.slider__value {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-2xs);
  min-width: 0;
}

.slider__number {
  flex: 1;
  min-width: 0;
  padding: 0 var(--vsui-space-xs);
  font-size: var(--editor-fs-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
  appearance: textfield;
}

.slider__number::-webkit-inner-spin-button,
.slider__number::-webkit-outer-spin-button { appearance: none; margin: 0; }

.slider__unit {
  flex-shrink: 0;
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
}

.slider__hint { grid-column: 1 / -1; }
</style>

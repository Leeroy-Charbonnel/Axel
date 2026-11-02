<script setup lang="ts" generic="V extends string">
import AutoDot from "./AutoDot.vue"

//One choice among a few, all visible: a radio group drawn as joined buttons.

const props = withDefaults(defineProps<{
  label:      string
  modelValue: V | null
  options:    { value: V; label: string }[]
  //hides the label, which stays for screen readers
  bare?:      boolean
  auto?:      V
}>(), { bare: false, auto: undefined })

const emit = defineEmits<{ "update:modelValue": [value: V] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
  e.preventDefault()
  const i = props.options.findIndex((o) => o.value === props.modelValue)
  const step = e.key === "ArrowRight" ? 1 : -1
  const next = props.options[(i + step + props.options.length) % props.options.length]!
  emit("update:modelValue", next.value)
}
</script>

<template>
  <div class="seg">
    <div v-if="!bare" class="seg__head">
      <span class="ed-label">{{ label }}</span>
      <AutoDot :differs="auto !== undefined && modelValue !== auto" @reset="auto !== undefined && emit('update:modelValue', auto)" />
    </div>
    <div class="seg__group" role="radiogroup" :aria-label="label" @keydown="onKeydown">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="radio"
        class="seg__option"
        :class="{ 'seg__option--on': o.value === modelValue }"
        :aria-checked="o.value === modelValue"
        :tabindex="o.value === modelValue || (modelValue === null && o === options[0]) ? 0 : -1"
        @click="emit('update:modelValue', o.value)"
      >
        {{ o.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.seg {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.seg__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: var(--me-dot-target);
}

.seg__group {
  display: flex;
  border: var(--border-width) solid var(--editor-line);
}

.seg__option {
  flex: 1;
  min-width: 0;
  min-height: var(--me-seg-height);
  padding: 0 var(--spacing-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--editor-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast) ease, background-color var(--transition-fast) ease;
}

.seg__option + .seg__option { border-left: var(--border-width) solid var(--editor-line); }
.seg__option:hover { color: var(--editor-text); }
.seg__option--on {
  color: var(--editor-on-accent);
  background-color: var(--editor-accent);
}
.seg__option--on:hover { color: var(--editor-on-accent); }
.seg__option:focus-visible { outline: none; box-shadow: inset var(--editor-focus); }
</style>

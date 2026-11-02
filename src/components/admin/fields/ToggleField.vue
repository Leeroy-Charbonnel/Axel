<script setup lang="ts">
defineProps<{
  label:      string
  modelValue: boolean
  hint?:      string
}>()

defineEmits<{ "update:modelValue": [value: boolean] }>()
</script>

<template>
  <label class="ed-toggle">
    <input
      class="ed-toggle__input"
      type="checkbox"
      role="switch"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ed-toggle__track" aria-hidden="true"><span class="ed-toggle__thumb"></span></span>
    <span class="ed-toggle__text">
      <span class="ed-toggle__label">{{ label }}</span>
      <span v-if="hint" class="ed-hint">{{ hint }}</span>
    </span>
  </label>
</template>

<style scoped>
.ed-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--editor-target);
  cursor: pointer;
}

.ed-toggle__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.ed-toggle__track {
  position: relative;
  flex-shrink: 0;
  width: var(--vsui-toggle-w);
  height: var(--vsui-toggle-h);
  background-color: var(--editor-surface-raised);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--border-radius-full);
  transition: background-color var(--transition-fast) ease, border-color var(--transition-fast) ease;
}

.ed-toggle__thumb {
  position: absolute;
  top: 50%;
  left: var(--vsui-space-2xs);
  width: calc(var(--vsui-toggle-h) - 3 * var(--vsui-space-2xs));
  height: calc(var(--vsui-toggle-h) - 3 * var(--vsui-space-2xs));
  background-color: var(--editor-text);
  border-radius: var(--border-radius-full);
  transform: translateY(-50%);
  transition: left var(--transition-fast) ease;
}

.ed-toggle__input:checked + .ed-toggle__track {
  background-color: var(--editor-accent);
  border-color: var(--editor-accent);
}

.ed-toggle__input:checked + .ed-toggle__track .ed-toggle__thumb {
  left: calc(100% - var(--vsui-toggle-h) + var(--vsui-space-2xs));
  background-color: var(--editor-on-accent);
}

.ed-toggle__input:focus-visible + .ed-toggle__track { box-shadow: var(--editor-focus); }

.ed-toggle__text {
  display: flex;
  flex-direction: column;
}

.ed-toggle__label {
  font-size: var(--font-size-sm);
  color: var(--editor-text);
}
</style>

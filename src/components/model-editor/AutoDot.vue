<script setup lang="ts">
import { useTranslations } from "../../composables/useTranslations"

//The mark of a control that no longer holds its automatic value. Clicking it
//puts the automatic value back. Nothing renders while the value is automatic.

defineProps<{ differs: boolean }>()
defineEmits<{ reset: [] }>()

const { t } = useTranslations()
</script>

<template>
  <button
    v-if="differs"
    type="button"
    class="auto-dot"
    :title="t('modelEditorAutoReset')"
    :aria-label="t('modelEditorAutoReset')"
    @click="$emit('reset')"
  >
    <span class="auto-dot__mark" aria-hidden="true"></span>
  </button>
</template>

<style scoped>
.auto-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--me-dot-target);
  height: var(--me-dot-target);
  flex-shrink: 0;
  cursor: pointer;
}

.auto-dot__mark {
  width: var(--me-dot-size);
  height: var(--me-dot-size);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-accent);
  box-shadow: 0 0 0 var(--me-dot-ring) var(--editor-accent-soft);
  transition: transform var(--transition-fast) ease;
}

.auto-dot:hover .auto-dot__mark { transform: scale(var(--me-dot-hover-scale)); }
.auto-dot:focus-visible { outline: none; box-shadow: var(--editor-focus); }
</style>

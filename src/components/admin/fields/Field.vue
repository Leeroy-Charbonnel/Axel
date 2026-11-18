<script setup lang="ts">
import { computed, useId } from "vue"

//THE FIELD SHELL - label, control, then the error or the hint. A single
//control gets a <label for>; a group (list, media) gets a labelled
//region instead.

const props = defineProps<{
  label:  string
  hint?:  string
  error?: string | null
  group?: boolean
}>()

const id         = useId()
const labelId    = `${id}-label`
const messageId  = `${id}-message`
const describedBy = computed(() => (props.error || props.hint) ? messageId : undefined)
</script>

<template>
  <div class="ed-field">
    <div class="ed-field__head">
      <span v-if="group" :id="labelId" class="ed-label">{{ label }}</span>
      <label v-else :for="id" class="ed-label">{{ label }}</label>
      <slot name="aside" />
    </div>
    <slot :id="id" :labelId="labelId" :describedBy="describedBy" :invalid="Boolean(error)" />
    <p v-if="error" :id="messageId" class="ed-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="messageId" class="ed-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.ed-field {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  min-width: 0;
}

.ed-field__head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
}
</style>

<script setup lang="ts" generic="V extends string">
import AutoDot from "./AutoDot.vue"

//One choice among a few, all visible: a radio group drawn as joined buttons.
//A property row (label left, choices right) unless bare.

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
  <div class="seg" :class="{ 'seg--row': !bare }">
    <div v-if="!bare" class="seg__head">
      <span class="ed-label seg__label">{{ label }}</span>
      <AutoDot :differs="auto !== undefined && modelValue !== auto" @reset="auto !== undefined && emit('update:modelValue', auto)" />
    </div>
    <div class="seg__group" role="radiogroup" :aria-label="label" @keydown="onKeydown">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="radio"
        class="ed-btn ed-btn--ghost seg__option"
        :class="{ 'ed-btn--active': o.value === modelValue }"
        :aria-checked="o.value === modelValue"
        :tabindex="o.value === modelValue || (modelValue === null && o === options[0]) ? 0 : -1"
        @click="emit('update:modelValue', o.value)"
      >
        <span class="seg__text">{{ o.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.seg {
  display: flex;
  min-width: 0;
}

.seg--row {
  display: grid;
  grid-template-columns: var(--editor-label-col) minmax(0, 1fr);
  align-items: center;
  column-gap: var(--vsui-space-sm);
}

/*the auto mark keeps its slot, so a label never rewraps when it shows*/
.seg__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-icon);
  align-items: center;
  gap: var(--vsui-space-2xs);
  min-width: 0;
}

.seg__label { overflow-wrap: break-word; hyphens: auto; }

/*the group is one control tall: the options sit inside its padding*/
.seg__group {
  display: flex;
  flex: 1;
  gap: var(--vsui-space-2xs);
  min-width: 0;
  padding: var(--vsui-space-2xs);
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}

.seg__option {
  flex: 1 1 auto;
  min-width: 0;
  min-height: calc(var(--editor-control) - 2 * var(--vsui-space-2xs));
  padding: 0 var(--vsui-space-xs);
  font-size: var(--editor-fs-sm);
}

.seg__option:not(.ed-btn--active) { color: var(--editor-text-muted); }
.seg__option:not(.ed-btn--active):hover { color: var(--editor-text); }

.seg__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

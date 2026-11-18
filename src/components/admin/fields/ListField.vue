<script setup lang="ts" generic="T">
import { computed, ref } from "vue"
import { GripVertical, Plus, Trash2 } from "lucide-vue-next"
import Field from "./Field.vue"
import { moveItem, useSortable } from "../useSortable"
import { useTranslations } from "../../../composables/useTranslations"

//AN ORDERED LIST OF ITEMS - add at the end, remove, drag (or arrow keys on the
//handle) to reorder. The item editor is the caller's slot.

const props = defineProps<{
  label:      string
  modelValue: T[]
  create:     () => T
  addLabel:   string
  hint?:      string
}>()

const emit = defineEmits<{ "update:modelValue": [value: T[]] }>()
defineSlots<{ item(props: { item: T; index: number; update: (value: T) => void }): unknown }>()

const { t } = useTranslations()
const listEl = ref<HTMLElement | null>(null)
const sortable = useSortable(listEl, (from, to) => emit("update:modelValue", moveItem(props.modelValue, from, to)))
const shown = computed(() => sortable.preview(props.modelValue))

function update(index: number, value: T) {
  const next = [...props.modelValue]
  next[index] = value
  emit("update:modelValue", next)
}

function remove(index: number) {
  emit("update:modelValue", props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <Field :label="label" :hint="hint" group v-slot="{ labelId }">
    <ol v-if="shown.length" ref="listEl" class="ed-list" :aria-labelledby="labelId">
      <li
        v-for="(item, index) in shown"
        :key="index"
        class="ed-list__item"
        :class="{ 'ed-list__item--dragging': sortable.draggingIndex.value === index }"
      >
        <button
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--icon"
          :aria-label="t('fieldReorder')"
          v-bind="sortable.handleProps(index)"
        >
          <GripVertical :size="16" />
        </button>
        <div class="ed-list__body">
          <slot name="item" :item="item" :index="index" :update="(value: T) => update(index, value)" />
        </div>
        <button
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--icon ed-btn--danger"
          :aria-label="t('fieldRemoveItem')"
          @click="remove(index)"
        >
          <Trash2 :size="16" />
        </button>
      </li>
    </ol>
    <button type="button" class="ed-btn ed-list__add" @click="emit('update:modelValue', [...modelValue, create()])">
      <Plus :size="16" />
      <span>{{ addLabel }}</span>
    </button>
  </Field>
</template>

<style scoped>
.ed-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
}

.ed-list__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--vsui-space-xs);
  padding: var(--vsui-space-xs);
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line-soft);
  border-radius: var(--editor-radius);
  transition: border-color var(--transition-fast) ease;
}

.ed-list__item--dragging { border-color: var(--editor-accent); }

.ed-list__body {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  min-width: 0;
}

.ed-list__add { align-self: flex-start; }
</style>

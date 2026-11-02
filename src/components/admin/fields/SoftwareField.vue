<script setup lang="ts">
import { computed } from "vue"
import Field from "./Field.vue"
import { usePortfolio } from "../../../composables/usePortfolio"
import { useTranslations } from "../../../composables/useTranslations"
import type { SoftwareDto } from "../../../types/portfolio"

//THE SOFTWARE OF A PROJECT - every catalogue entry as a toggle; the order of
//the project is the order in which they were switched on.

const props = defineProps<{
  label:      string
  modelValue: SoftwareDto[]
  hint?:      string
}>()

const emit = defineEmits<{ "update:modelValue": [value: SoftwareDto[]] }>()
const { t } = useTranslations()
const { data } = usePortfolio()

const catalog = computed(() => data.value?.software ?? [])
const chosen  = computed(() => new Set(props.modelValue.map((s) => s.id)))

function toggle(sw: SoftwareDto) {
  emit("update:modelValue", chosen.value.has(sw.id)
    ? props.modelValue.filter((s) => s.id !== sw.id)
    : [...props.modelValue, sw])
}
</script>

<template>
  <Field :label="label" :hint="hint" group v-slot="{ labelId }">
    <p v-if="!catalog.length" class="ed-hint">{{ t('fieldSoftwareNoneYet') }}</p>
    <div v-else class="ed-chips" role="group" :aria-labelledby="labelId">
      <button
        v-for="sw in catalog"
        :key="sw.id"
        type="button"
        class="ed-chips__chip"
        :aria-pressed="chosen.has(sw.id)"
        @click="toggle(sw)"
      >
        <img v-if="sw.logoUrl" :src="sw.logoUrl" alt="" />
        <span>{{ sw.key }}</span>
      </button>
    </div>
  </Field>
</template>

<style scoped>
.ed-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs);
}

.ed-chips__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: var(--editor-target);
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--editor-text-muted);
  border: var(--border-width) solid var(--editor-line);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease, color var(--transition-fast) ease;
}

.ed-chips__chip img {
  width: var(--spacing-md);
  height: var(--spacing-md);
  object-fit: contain;
}

.ed-chips__chip:hover { border-color: var(--editor-text-muted); }
.ed-chips__chip:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.ed-chips__chip[aria-pressed="true"] {
  color: var(--editor-text);
  border-color: var(--editor-accent);
  background-color: var(--editor-accent-soft);
}
</style>

<script setup lang="ts">
import { computed } from "vue"
import { Box } from "lucide-vue-next"
import Field from "./Field.vue"
import SelectField from "./SelectField.vue"
import { usePortfolio } from "../../../composables/usePortfolio"
import { useTranslations } from "../../../composables/useTranslations"

//A 3D MODEL AND ITS VIEWS - pick one model_3d from the catalogue, then the
//named view shown on desktop and on mobile. Picking a model starts both views
//on its first one so the choice is never broken.

export interface ModelChoice {
  model3dId:   string | null
  desktopView: string
  mobileView:  string
}

const props = defineProps<{
  label:      string
  modelValue: ModelChoice
  hint?:      string
}>()

const emit = defineEmits<{ "update:modelValue": [value: ModelChoice] }>()
const { t } = useTranslations()
const { data } = usePortfolio()

const models   = computed(() => data.value?.models ?? [])
const selected = computed(() => models.value.find((m) => m.id === props.modelValue.model3dId) ?? null)
const views    = computed(() => (selected.value?.views ?? []).map((v) => ({ value: v.name, label: v.name })))

function pick(id: string | null) {
  const first = models.value.find((m) => m.id === id)?.views[0]?.name ?? ""
  emit("update:modelValue", { model3dId: id, desktopView: first, mobileView: first })
}
</script>

<template>
  <Field :label="label" :hint="hint" group v-slot="{ labelId }">
    <p v-if="!models.length" class="ed-hint">{{ t('fieldModelNoneYet') }}</p>
    <div v-else class="ed-models" role="radiogroup" :aria-labelledby="labelId">
      <button
        type="button"
        role="radio"
        class="ed-models__tile"
        :aria-checked="modelValue.model3dId === null"
        @click="pick(null)"
      >
        <span class="ed-models__thumb"><Box :size="20" aria-hidden="true" /></span>
        <span class="ed-models__name">{{ t('fieldModelNone') }}</span>
      </button>
      <button
        v-for="m in models"
        :key="m.id"
        type="button"
        role="radio"
        class="ed-models__tile"
        :aria-checked="m.id === modelValue.model3dId"
        @click="pick(m.id)"
      >
        <span class="ed-models__thumb">
          <img v-if="m.thumbnailUrl" :src="m.thumbnailUrl" alt="" loading="lazy" />
          <Box v-else :size="20" aria-hidden="true" />
        </span>
        <span class="ed-models__name">{{ m.name }}</span>
      </button>
    </div>
    <div v-if="selected" class="ed-form__grid">
      <SelectField
        :label="t('fieldModelDesktopView')"
        :model-value="modelValue.desktopView"
        :options="views"
        @update:model-value="(v) => emit('update:modelValue', { ...modelValue, desktopView: v })"
      />
      <SelectField
        :label="t('fieldModelMobileView')"
        :model-value="modelValue.mobileView"
        :options="views"
        @update:model-value="(v) => emit('update:modelValue', { ...modelValue, mobileView: v })"
      />
    </div>
  </Field>
</template>

<style scoped>
.ed-models {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--editor-media-preview), 1fr));
  gap: var(--spacing-xs);
}

.ed-models__tile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  text-align: left;
  color: var(--editor-text);
  border: var(--border-width) solid var(--editor-line);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease;
}

.ed-models__tile:hover { border-color: var(--editor-text-muted); }
.ed-models__tile:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.ed-models__tile[aria-checked="true"] { border-color: var(--editor-accent); }

.ed-models__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
}

.ed-models__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ed-models__name {
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

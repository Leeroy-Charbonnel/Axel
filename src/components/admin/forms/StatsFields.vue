<script setup lang="ts">
import NumberField from "../fields/NumberField.vue"
import { useTranslations } from "../../../composables/useTranslations"
import type { ProjectStats } from "../../../types/portfolio"

//THE POLYCOUNT of a project or a gallery item, shared by both forms
const STATS: { key: keyof ProjectStats; labelKey: string }[] = [
  { key: "vertices",  labelKey: "projectsStatVertices" },
  { key: "edges",     labelKey: "projectsStatEdges" },
  { key: "faces",     labelKey: "projectsStatFaces" },
  { key: "triangles", labelKey: "projectsStatTriangles" },
]

const props = defineProps<{ modelValue: ProjectStats }>()
const emit = defineEmits<{ "update:modelValue": [value: ProjectStats] }>()
const { t } = useTranslations()
</script>

<template>
  <div class="ed-form__grid">
    <NumberField
      v-for="s in STATS"
      :key="s.key"
      :label="t(s.labelKey)"
      :model-value="modelValue[s.key] ?? 0"
      @update:model-value="(v) => emit('update:modelValue', { ...props.modelValue, [s.key]: v })"
    />
  </div>
</template>

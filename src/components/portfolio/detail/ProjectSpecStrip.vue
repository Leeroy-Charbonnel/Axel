<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import type { Lang } from "../../../lib/lang"
import type { ProjectStats } from "../../../types/portfolio"

//THE SPEC STRIP - the mesh counts with their full names, in the reader's
//number format; a count of zero or one never entered is left out.

const props = defineProps<{ stats: ProjectStats; lang: Lang }>()
const { t } = useTranslations()

const FIELDS = [
  { key: "vertices",  label: "projectsStatVertices" },
  { key: "edges",     label: "projectsStatEdges" },
  { key: "faces",     label: "projectsStatFaces" },
  { key: "triangles", label: "projectsStatTriangles" },
] as const

const shown = computed(() => {
  const format = new Intl.NumberFormat(props.lang)
  return FIELDS
    .filter((f) => (props.stats[f.key] ?? 0) > 0)
    .map((f) => ({ key: f.key, label: t(f.label), value: format.format(props.stats[f.key]!) }))
})
</script>

<template>
  <dl v-if="shown.length" class="spec-strip">
    <div v-for="s in shown" :key="s.key" class="spec-strip__item">
      <dt class="spec-strip__label">{{ s.label }}</dt>
      <dd class="spec-strip__value">{{ s.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.spec-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--detail-spec-min), 1fr));
  margin: 0;
  border-top: var(--border-width) solid hsl(var(--border-color));
  border-bottom: var(--border-width) solid hsl(var(--border-color));
}
.spec-strip__item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) 0;
}
.spec-strip__item + .spec-strip__item {
  padding-left: var(--spacing-md);
  border-left: var(--border-width) solid hsl(var(--border-color));
}
.spec-strip__label {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--color-text-tertiary);
}
.spec-strip__value {
  margin: 0;
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-hover);
}
</style>

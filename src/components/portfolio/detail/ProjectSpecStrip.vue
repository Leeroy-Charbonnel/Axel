<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import { statRows } from "../../../lib/portfolio-utils"
import type { Lang } from "../../../lib/lang"
import type { ProjectStats } from "../../../types/portfolio"

//THE SPEC STRIP - full labels over the counts (statRows leaves out a count
//of zero). Each cell's 1px ring fills the 1px gap with its neighbour's, so
//the hairlines stay single and a short last row leaves no filled hole.
const props = defineProps<{ stats: ProjectStats; lang: Lang }>()
const { t } = useTranslations()

const rows = computed(() => statRows(props.stats, props.lang, t))
</script>

<template>
  <dl v-if="rows.length" class="spec-strip" :aria-label="t('projectSpecs')">
    <div v-for="s in rows" :key="s.key" class="spec-strip__item">
      <dt class="spec-strip__label">{{ s.label }}</dt>
      <dd class="spec-strip__value">{{ s.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.spec-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--site-spec-min)), 1fr));
  gap: var(--border-width-sm);
  margin: var(--border-width-sm);
}
.spec-strip__item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-sm) var(--spacing-md);
  box-shadow: 0 0 0 var(--border-width-sm) var(--site-line);
}
.spec-strip__label {
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
}
.spec-strip__value {
  margin: 0;
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-heading);
}
</style>

<script setup lang="ts">
import { useTranslations } from "../../../composables/useTranslations"
import type { Lang } from "../../../lib/lang"
import BlockEmpty from "./BlockEmpty.vue"
import BlockText from "./BlockText.vue"
import type { SpecsBlockContent } from "../../../types/portfolio"

//SPEC SHEET - label / value rows separated by hairlines
defineProps<{ content: SpecsBlockContent; lang: Lang }>()
const { t } = useTranslations()
</script>

<template>
  <dl v-if="content.rows.length" class="bspecs" :lang="lang">
    <div v-for="(row, i) in content.rows" :key="i" class="bspecs__row">
      <BlockText tag="dt" class="bspecs__label" :value="row.label" :label="t('blockFieldLabel')" @write="(v) => (row.label = v)" />
      <BlockText tag="dd" class="bspecs__value" :value="row.value" :label="t('blockFieldValue')" @write="(v) => (row.value = v)" />
    </div>
  </dl>
  <BlockEmpty v-else type="specs" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.bspecs {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  overflow-y: auto;
}
.bspecs__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-xxs) var(--spacing-md);
  padding: var(--spacing-sm) 0;
  border-bottom: var(--border-width) solid var(--site-line);
}
.bspecs__row:last-child { border-bottom: none; }
.bspecs__label {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.bspecs__value {
  margin: 0;
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-medium);
  color: var(--site-text-heading);
  text-align: right;
  overflow-wrap: anywhere;
}
</style>

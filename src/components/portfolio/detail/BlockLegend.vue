<script setup lang="ts">
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import BlockEmpty from "./BlockEmpty.vue"
import type { LegendBlockContent } from "../../../types/portfolio"

//LEGEND - the marks drawn on a plan, each in its box, then the part it names
const props = defineProps<{ content: LegendBlockContent; lang: Lang }>()
const { t } = useTranslations()

const LETTER_A = 65
function mark(i: number): string {
  return props.content.marker === "letter" ? String.fromCharCode(LETTER_A + i) : String(i + 1).padStart(2, "0")
}
</script>

<template>
  <ol v-if="content.items.length" class="blegend" :lang="lang">
    <li v-for="(item, i) in content.items" :key="i" class="blegend__item">
      <span class="blegend__mark" aria-hidden="true">{{ mark(i) }}</span>
      <span class="blegend__label">{{ pickBilingual(item, lang) }}</span>
    </li>
  </ol>
  <BlockEmpty v-else type="legend" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.blegend {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  margin: 0;
  padding: var(--spacing-sm) 0;
  list-style: none;
}
.blegend__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.blegend__mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: var(--site-mark);
  height: var(--site-mark);
  border: var(--border-width-sm) solid var(--site-line-strong);
  font-size: var(--site-fs-label);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-heading);
}
.blegend__label {
  font-size: var(--site-fs-small);
  color: var(--site-text-body);
}
</style>

<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import SiteImage from "../../SiteImage.vue"
import BlockEmpty from "./BlockEmpty.vue"
import type { SequenceBlockContent } from "../../../types/portfolio"

//SEQUENCE - images side by side, each shown whole above its caption; numbered
//steps carry 01, 02... and a dash leads from one to the next
const props = defineProps<{ content: SequenceBlockContent; lang: Lang; sizes: string }>()
const { t } = useTranslations()

const items = computed(() => props.content.items.filter((i) => i.url))
</script>

<template>
  <ol v-if="items.length" class="bseq" :class="{ 'bseq--numbered': content.numbered }" :lang="lang">
    <li v-for="(item, i) in items" :key="item.fileId" class="bseq__item">
      <SiteImage :src="item.url" :alt="pickBilingual(item.caption, lang)" :sizes="sizes" class="bseq__img" />
      <span v-if="content.numbered" class="bseq__num">{{ String(i + 1).padStart(2, "0") }}</span>
      <span class="bseq__caption">{{ pickBilingual(item.caption, lang) }}</span>
    </li>
  </ol>
  <BlockEmpty v-else type="sequence" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.bseq {
  --gap: var(--spacing-sm);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--site-seq-min), 1fr));
  gap: var(--spacing-lg) var(--gap);
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bseq__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  text-align: center;
}
/*each image at its own proportions, as wide as its column*/
.bseq__img {
  display: block;
  width: 100%;
  height: auto;
}
/*a dash between two numbered steps, level with the images' middle*/
.bseq--numbered .bseq__item + .bseq__item::before {
  content: "";
  position: absolute;
  top: 50%;
  right: calc(100% + var(--gap) / 4);
  width: calc(var(--gap) / 2);
  border-top: var(--border-width-sm) solid var(--site-line-strong);
}
.bseq__num {
  margin-top: var(--spacing-xs);
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-heading);
}
.bseq__caption {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
</style>

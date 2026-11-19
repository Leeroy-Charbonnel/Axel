<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import type { Lang } from "../../../lib/lang"
import SiteImage from "../../SiteImage.vue"
import BlockEmpty from "./BlockEmpty.vue"
import BlockText from "./BlockText.vue"
import type { MaterialsBlockContent } from "../../../types/portfolio"

//MATERIALS - a swatch per material, its name, then its parameters
const props = defineProps<{ content: MaterialsBlockContent; lang: Lang }>()
const { t } = useTranslations()

const items = computed(() => props.content.items.filter((i): i is MaterialsBlockContent["items"][number] & { url: string } => Boolean(i.url)))
//the swatch is drawn at most 5rem wide
const SWATCH_SIZES = "80px"
</script>

<template>
  <ul v-if="items.length" class="bmat" :lang="lang">
    <li v-for="item in items" :key="item.fileId" class="bmat__item">
      <SiteImage :src="item.url" alt="" :sizes="SWATCH_SIZES" class="bmat__swatch" />
      <div class="bmat__body">
        <BlockText tag="p" class="bmat__name" :value="item.name" :label="t('fieldName')" @write="(v) => (item.name = v)" />
        <dl class="bmat__rows">
          <div v-for="(row, r) in item.rows" :key="r" class="bmat__row">
            <BlockText tag="dt" :value="row.label" :label="t('blockFieldLabel')" @write="(v) => (row.label = v)" />
            <BlockText tag="dd" :value="row.value" :label="t('blockFieldValue')" @write="(v) => (row.value = v)" />
          </div>
        </dl>
      </div>
    </li>
  </ul>
  <BlockEmpty v-else type="materials" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.bmat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-md);
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bmat__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}
.bmat__swatch {
  flex: none;
  width: var(--site-swatch);
  height: var(--site-swatch);
  object-fit: contain;
}
.bmat__body { min-width: 0; }
.bmat__name {
  margin: 0 0 var(--spacing-xxs);
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-semibold);
  color: var(--site-text-heading);
}
.bmat__rows { margin: 0; }
.bmat__row {
  display: flex;
  gap: var(--spacing-xs);
  font-size: var(--site-fs-label);
  color: var(--site-text-caption);
}
.bmat__row dd {
  margin: 0;
  color: var(--site-text-body);
  font-variant-numeric: tabular-nums;
}
</style>

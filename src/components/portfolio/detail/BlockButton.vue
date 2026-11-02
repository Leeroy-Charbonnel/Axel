<script setup lang="ts">
import { computed } from "vue"
import { ArrowUpRight } from "lucide-vue-next"
import { pickBilingual } from "../../../lib/markdown"
import { safeUrl } from "../../../lib/safe-url"
import type { Lang } from "../../../lib/lang"
import type { ButtonBlockContent } from "../../../types/portfolio"

//BUTTON - one call to action. A missing or refused URL draws the button
//without a link (safeUrl logs why) instead of a link to nowhere.
const props = defineProps<{ content: ButtonBlockContent; lang: Lang }>()

const href  = computed(() => safeUrl(props.content.url))
const label = computed(() => pickBilingual(props.content.label, props.lang))
</script>

<template>
  <div class="bbutton">
    <a
      v-if="href"
      class="site-button site-button--primary"
      :href="href"
      :target="content.newTab ? '_blank' : undefined"
      :rel="content.newTab ? 'noopener noreferrer' : undefined"
    >
      <span>{{ label }}</span>
      <ArrowUpRight aria-hidden="true" />
    </a>
    <span v-else class="site-button bbutton__off" aria-disabled="true">{{ label }}</span>
  </div>
</template>

<style scoped>
.bbutton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
}
.bbutton__off {
  color: var(--site-text-caption);
  cursor: default;
}
</style>

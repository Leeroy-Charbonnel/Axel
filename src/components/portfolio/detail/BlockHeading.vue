<script setup lang="ts">
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import type { HeadingBlockContent } from "../../../types/portfolio"

//SECTION HEADING - the title under a hairline, at the bottom of its block
//so it introduces the row that follows
defineProps<{ content: HeadingBlockContent; lang: Lang }>()
</script>

<template>
  <div class="bheading">
    <h2 class="bheading__text" :lang="lang">{{ pickBilingual(content.text, lang) }}</h2>
  </div>
</template>

<style scoped>
.bheading {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  padding-bottom: var(--spacing-md);
  overflow: hidden;
}
.bheading__text {
  flex: 1;
  margin: 0;
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid hsl(var(--border-color));
  font-size: var(--site-fs-h2);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--color-text-hover);
  overflow-wrap: anywhere;
}
</style>

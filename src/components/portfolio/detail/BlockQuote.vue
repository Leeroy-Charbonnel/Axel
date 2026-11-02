<script setup lang="ts">
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import type { QuoteBlockContent } from "../../../types/portfolio"

//QUOTE - large type, an accent opening mark and the author as a caption
defineProps<{ content: QuoteBlockContent; lang: Lang }>()
</script>

<template>
  <figure class="bquote" :lang="lang">
    <span class="bquote__mark" aria-hidden="true">&ldquo;</span>
    <blockquote class="bquote__text">{{ pickBilingual(content.text, lang) }}</blockquote>
    <figcaption v-if="content.author" class="bquote__author">{{ content.author }}</figcaption>
  </figure>
</template>

<style scoped>
.bquote {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  height: 100%;
  margin: 0;
  padding: var(--spacing-lg) var(--spacing-md);
  overflow: auto;
}
.bquote__mark {
  font-size: var(--site-fs-h1);
  line-height: var(--site-lh-tight);
  height: var(--spacing-lg);
  color: var(--site-accent);
}
.bquote__text {
  margin: 0;
  font-size: var(--site-fs-h3);
  line-height: var(--site-lh-body);
  font-weight: var(--font-weight-medium);
  color: var(--site-text-heading);
  overflow-wrap: anywhere;
}
.bquote__author {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
</style>

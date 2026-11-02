<script setup lang="ts">
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import type { HeadingBlockContent } from "../../../types/portfolio"

//SECTION HEADING - a plan's section title: a hairline with a cross at each
//end, then the title and its accent slash, at the bottom of the block so it
//introduces the row that follows
defineProps<{ content: HeadingBlockContent; lang: Lang }>()
</script>

<template>
  <div class="bheading">
    <h2 class="bheading__text" :lang="lang">
      {{ pickBilingual(content.text, lang) }}<span class="bheading__slash" aria-hidden="true">/</span>
    </h2>
  </div>
</template>

<style scoped>
.bheading {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  padding-bottom: var(--spacing-md);
  /*the hairline, through the middle of the crosses; inside the cell, which clips*/
  background: linear-gradient(var(--site-line), var(--site-line)) no-repeat
    0 calc(var(--site-cross) / 2) / 100% var(--border-width);
}
/*the crosses that pin the hairline at both ends*/
.bheading::before,
.bheading::after {
  content: "+";
  position: absolute;
  top: 0;
  height: var(--site-cross);
  font-size: var(--site-cross);
  line-height: var(--site-cross);
  color: var(--site-line-strong);
}
.bheading::before { left: 0; }
.bheading::after  { right: 0; }
.bheading__text {
  flex: 1;
  margin: 0;
  padding-top: var(--spacing-lg);
  font-size: var(--site-fs-h3);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--site-text-heading);
  overflow-wrap: anywhere;
}
.bheading__slash {
  margin-left: var(--spacing-sm);
  font-weight: var(--font-weight-regular);
  color: var(--site-accent);
}
</style>

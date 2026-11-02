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
      class="bbutton__link"
      :href="href"
      :target="content.newTab ? '_blank' : undefined"
      :rel="content.newTab ? 'noopener noreferrer' : undefined"
    >
      <span>{{ label }}</span>
      <ArrowUpRight :size="18" aria-hidden="true" />
    </a>
    <span v-else class="bbutton__link bbutton__link--off" aria-disabled="true">{{ label }}</span>
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
.bbutton__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-height: var(--site-touch-target);
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  text-align: center;
  color: hsl(var(--background));
  background-color: var(--color-accent);
  border: var(--border-width) solid var(--color-accent);
  transition: background-color var(--transition-fast) ease, color var(--transition-fast) ease;
}
.bbutton__link:hover { background-color: transparent; color: var(--color-accent); }
.bbutton__link:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.bbutton__link--off {
  color: var(--color-text-tertiary);
  background-color: transparent;
  border-color: hsl(var(--border-color));
}
</style>

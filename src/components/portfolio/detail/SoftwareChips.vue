<script setup lang="ts">
import { computed } from "vue"
import { safeUrl } from "../../../lib/safe-url"
import type { SoftwareDto } from "../../../types/portfolio"

//THE SOFTWARE OF A PROJECT - logo and name, linked to the official site when
//it has one
const props = defineProps<{ software: SoftwareDto[] }>()
const items = computed(() => props.software.map((sw) => ({ ...sw, href: safeUrl(sw.url) })))
</script>

<template>
  <ul v-if="software.length" class="chips">
    <li v-for="sw in items" :key="sw.id">
      <component
        :is="sw.href ? 'a' : 'span'"
        class="chips__chip"
        :href="sw.href ?? undefined"
        :target="sw.href ? '_blank' : undefined"
        :rel="sw.href ? 'noopener noreferrer' : undefined"
      >
        <img v-if="sw.logoUrl" :src="sw.logoUrl" alt="" class="chips__logo" loading="lazy" />
        <span>{{ sw.key }}</span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.chips__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: var(--site-touch-target);
  padding: 0 var(--spacing-sm);
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border: var(--border-width) solid hsl(var(--border-color));
  transition: border-color var(--transition-fast) ease, color var(--transition-fast) ease;
}
a.chips__chip:hover { color: var(--color-text-hover); border-color: var(--color-text-tertiary); }
a.chips__chip:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.chips__logo {
  width: var(--detail-chip-logo);
  height: var(--detail-chip-logo);
  object-fit: contain;
}
</style>

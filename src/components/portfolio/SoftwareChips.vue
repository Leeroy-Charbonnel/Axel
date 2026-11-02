<script setup lang="ts">
import { computed } from "vue"
import { safeUrl } from "../../lib/safe-url"
import { IMAGE_SIZES } from "../../lib/media"
import SiteImage from "../SiteImage.vue"
import type { SoftwareDto } from "../../types/portfolio"

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
        <SiteImage v-if="sw.logoUrl" :src="sw.logoUrl" :sizes="IMAGE_SIZES.icon" class="chips__logo" />
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
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  color: var(--site-text-body);
  border: var(--border-width-sm) solid var(--site-line);
  transition: border-color var(--transition-fast) ease, color var(--transition-fast) ease;
}
a.chips__chip:hover { color: var(--site-text-heading); border-color: var(--site-text-caption); }
a.chips__chip:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.chips__logo {
  width: var(--site-icon);
  height: var(--site-icon);
  object-fit: contain;
}
</style>

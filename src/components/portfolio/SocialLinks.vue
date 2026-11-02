<script setup lang="ts">
import { computed } from "vue"
import { ArrowUpRight } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { safeUrl } from "../../lib/safe-url"
import type { ProfileLinks } from "../../types/portfolio"

//THE PROFILE'S LINKS ELSEWHERE, as a row of labelled links. A link left empty
//is not drawn; one that is not a web address is refused by safeUrl.
const props = defineProps<{ links: ProfileLinks }>()

const { t } = useLanguage()

const ORDER: { key: keyof ProfileLinks; labelKey: string }[] = [
  { key: "artstation", labelKey: "fieldLinkArtstation" },
  { key: "sketchfab",  labelKey: "fieldLinkSketchfab" },
  { key: "linkedin",   labelKey: "fieldLinkLinkedin" },
  { key: "instagram",  labelKey: "fieldLinkInstagram" },
  { key: "website",    labelKey: "fieldLinkWebsite" },
]

const items = computed(() => ORDER
  .map(({ key, labelKey }) => ({ key, label: t(labelKey), href: safeUrl(props.links[key]) }))
  .filter((item): item is { key: keyof ProfileLinks; label: string; href: string } => item.href !== null))
</script>

<template>
  <ul v-if="items.length" class="social-links" :aria-label="t('contactSocials')">
    <li v-for="item in items" :key="item.key">
      <a class="social-links__link" :href="item.href" target="_blank" rel="noopener noreferrer">
        {{ item.label }}
        <ArrowUpRight class="social-links__icon" aria-hidden="true" />
      </a>
    </li>
  </ul>
</template>

<style scoped>
.social-links {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--spacing-lg);
  list-style: none;
}

.social-links__link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-body);
  transition: color var(--site-duration-fast) ease;
}

.social-links__link:hover { color: var(--site-accent); }

.social-links__icon {
  width: var(--site-icon-sm);
  height: var(--site-icon-sm);
}
</style>

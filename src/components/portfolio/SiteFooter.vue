<script setup lang="ts">
import { ArrowUp } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { scrollToSection } from "../../composables/useSectionNav"
import SocialLinks from "./SocialLinks.vue"
import type { ProfileDto } from "../../types/portfolio"

defineProps<{ profile: ProfileDto }>()

const { t } = useLanguage()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="site-container footer__inner">
      <p class="footer__name">{{ profile.name }} <span class="footer__year">&copy; {{ year }}</span></p>
      <SocialLinks :links="profile.links" />
      <a href="#home" class="footer__top" @click.prevent="scrollToSection('home')">
        {{ t("footerBackToTop") }}
        <ArrowUp aria-hidden="true" />
      </a>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  border-top: var(--border-width-sm) solid var(--site-line);
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm) var(--spacing-xl);
  padding-block: var(--spacing-lg);
}

.footer__name {
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.footer__year {
  font-weight: var(--font-weight-regular);
  color: var(--site-text-caption);
}

.footer__top {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-body);
  transition: color var(--site-duration-fast) ease;
}

.footer__top:hover { color: var(--site-accent); }

.footer__top svg {
  width: var(--site-icon-sm);
  height: var(--site-icon-sm);
}
</style>

<script setup lang="ts">
import { computed } from "vue"
import { ArrowUp } from "lucide-vue-next"
import { useEditor } from "../../composables/useEditor"
import { useLanguage } from "../../composables/useLanguage"
import { usePortfolio } from "../../composables/usePortfolio"
import { KINDS } from "../admin/entities"
import SocialLinks from "./SocialLinks.vue"

//THE FOOT OF EVERY PAGE WITH THE SITE CHROME (App.vue draws it), with the
//profile as the page shows it, unsaved draft included
const { t } = useLanguage()
const { data } = usePortfolio()
const editor = useEditor()
const profile = computed(() => data.value && editor.display("profile", KINDS.profile.list(data.value)[0]!))
const year = new Date().getFullYear()

function toTop() {
  window.scrollTo({ top: 0 })
}
</script>

<template>
  <footer v-if="profile" class="footer">
    <div class="site-container footer__inner">
      <p class="footer__name">{{ profile.name }} <span class="footer__year">&copy; {{ year }}</span></p>
      <SocialLinks :links="profile.links" />
      <button type="button" class="footer__top" @click="toTop">
        {{ t("footerBackToTop") }}
        <ArrowUp aria-hidden="true" />
      </button>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  margin-top: auto;
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
  padding: 0;
  transition: color var(--site-duration-fast) ease;
}

.footer__top:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }

.footer__top:hover { color: var(--site-accent); }

.footer__top svg {
  width: var(--site-icon-sm);
  height: var(--site-icon-sm);
}
</style>

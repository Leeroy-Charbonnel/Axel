<script setup lang="ts">
import { computed, watchEffect } from "vue"
import { ArrowLeft } from "lucide-vue-next"
import { useLanguage } from "../composables/useLanguage"
import { usePortfolio } from "../composables/usePortfolio"
import { IMAGE_SIZES } from "../lib/media"
import { pickBilingual } from "../lib/markdown"
import SiteImage from "../components/SiteImage.vue"
import SectionHeader from "../components/portfolio/SectionHeader.vue"

//NOT FOUND - an unknown address, or a project that does not exist or is not
//published: what happened, the way home, and the published projects
const { lang, t } = useLanguage()
const { data } = usePortfolio()

const projects = computed(() => (data.value?.mainProjects ?? []).filter((p) => p.published))

watchEffect(() => {
  document.title = `${t("notFoundTitle")} | ${t("siteTitle")}`
})
</script>

<template>
  <div class="missing">
    <section class="site-container site-section missing__head" aria-labelledby="missing-title">
      <p class="site-eyebrow">404</p>
      <h1 id="missing-title" class="missing__title">{{ t("notFoundTitle") }}</h1>
      <p class="missing__text">{{ t("notFoundText") }}</p>
      <RouterLink to="/" class="site-button site-button--primary missing__home">
        <ArrowLeft aria-hidden="true" />
        {{ t("notFoundHome") }}
      </RouterLink>
    </section>

    <section v-if="projects.length" class="site-container site-section" aria-labelledby="missing-projects">
      <SectionHeader id="missing-projects" :title="t('notFoundProjects')" />
      <ul class="missing__grid">
        <li v-for="p in projects" :key="p.id">
          <RouterLink :to="`/project/${p.id}`" class="missing__card">
            <span class="missing__media">
              <SiteImage v-if="p.mainImageUrl" :src="p.mainImageUrl" :sizes="IMAGE_SIZES.gallery" />
            </span>
            <span class="missing__card-text">
              <span v-if="p.year" class="site-eyebrow">{{ p.year }}</span>
              <span class="missing__card-title">{{ pickBilingual(p.title, lang) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.missing__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.missing__title {
  font-size: var(--site-fs-h1);
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--site-tracking-heading);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.missing__text {
  max-width: var(--site-text-width);
  color: var(--site-text-body);
}

.missing__home { margin-top: var(--spacing-xs); }

.missing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--site-gallery-min)), 1fr));
  gap: var(--site-col-gap);
  list-style: none;
}

.missing__card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: var(--border-width-sm) solid var(--site-line);
  transition: border-color var(--site-duration-fast) ease;
}

.missing__card:hover { border-color: var(--site-line-strong); }
.missing__card:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }

.missing__media {
  display: block;
  aspect-ratio: var(--site-gallery-aspect);
  overflow: hidden;
  background-color: var(--site-surface);
}

.missing__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.missing__card-text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border-top: var(--border-width-sm) solid var(--site-line);
}

.missing__card-title {
  font-size: var(--site-fs-body);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  color: var(--site-text-heading);
}
</style>

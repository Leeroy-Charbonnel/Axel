<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import { useRoute } from "vue-router"
import { useEditor } from "../composables/useEditor"
import { useLanguage } from "../composables/useLanguage"
import { usePortfolio } from "../composables/usePortfolio"
import { scrollToSection } from "../composables/useSectionNav"
import { KINDS } from "../components/admin/entities"
import Home           from "../components/portfolio/Home.vue"
import MainProjects   from "../components/portfolio/MainProjects.vue"
import ProjectGallery from "../components/portfolio/ProjectGallery.vue"
import Experience     from "../components/portfolio/Experience.vue"
import PortfolioSkeleton from "../components/portfolio/PortfolioSkeleton.vue"

const { data, loading, error, reload } = usePortfolio()
const editor = useEditor()
const { t } = useLanguage()
const route = useRoute()

//every item as the page should draw it: with its unsaved draft, and without the
//unpublished ones unless the admin is editing
function visible<T extends { published: boolean }>(items: T[], show: (item: T) => T): T[] {
  return items.map(show).filter((item) => editor.editMode.value || item.published)
}

const profile      = computed(() => data.value && editor.display("profile", KINDS.profile.list(data.value)[0]!))
const mainProjects = computed(() => (data.value ? visible(data.value.mainProjects, (p) => editor.display("mainProject", p)) : []))
const gallery      = computed(() => (data.value ? visible(data.value.galleryProjects, (g) => editor.display("galleryItem", g)) : []))
const experiences  = computed(() => (data.value ? visible(data.value.experiences, (e) => editor.display("experience", e)) : []))

//arriving from another page with #section: scroll once the sections exist
watch(data, async (loaded) => {
  if (!loaded || !route.hash) return
  await nextTick()
  scrollToSection(route.hash.slice(1))
}, { immediate: true })
</script>

<template>
  <div class="portfolio">
    <template v-if="data && profile">
      <Home :profile="profile" />
      <MainProjects :projects="mainProjects" />
      <ProjectGallery :projects="gallery" />
      <Experience :experiences="experiences" :profile="profile" />
    </template>

    <div v-else-if="error" class="site-container portfolio__error" role="alert">
      <p>{{ t("homeLoadError").replace("{reason}", error) }}</p>
      <button type="button" class="site-button" @click="reload">{{ t("homeRetry") }}</button>
    </div>

    <PortfolioSkeleton v-else-if="loading" />
  </div>
</template>

<style scoped>
.portfolio {
  position: relative;
}

.portfolio__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding-block: var(--site-section-gap);
  color: hsl(var(--destructive));
}
</style>

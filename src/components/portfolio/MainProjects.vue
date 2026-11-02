<script setup lang="ts">
import { useLanguage } from "../../composables/useLanguage"
import AnimatedReveal from "./AnimatedReveal.vue"
import MainProject from "./MainProject.vue"
import SectionHeader from "./SectionHeader.vue"
import SectionAddButton from "../admin/SectionAddButton.vue"
import type { MainProjectDto } from "../../types/portfolio"

defineProps<{ projects: MainProjectDto[] }>()

const { t } = useLanguage()
</script>

<template>
  <section id="projects" class="projects site-section" aria-labelledby="projects-title">
    <div class="site-container">
      <SectionHeader id="projects-title" :title="t('projectsTitle')" />

      <div class="projects__list">
        <AnimatedReveal v-for="project in projects" :key="project.id">
          <MainProject :project="project" />
        </AnimatedReveal>
        <SectionAddButton kind="mainProject" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.projects__list {
  display: flex;
  flex-direction: column;
  gap: var(--site-case-gap);
}
</style>

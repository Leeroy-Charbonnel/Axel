<script setup lang="ts">
import AnimatedReveal from "./AnimatedReveal.vue"
import MainProject from "./MainProject.vue"
import SectionHeader from "./SectionHeader.vue"
import SectionAddButton from "../admin/SectionAddButton.vue"
import type { MainProjectDto } from "../../types/portfolio"

defineProps<{ projects: MainProjectDto[] }>()
</script>

<template>
  <section id="projects" tabindex="-1" class="projects site-section" aria-labelledby="projects-title">
    <div class="site-container">
      <SectionHeader id="projects-title" label-key="projectsTitle" />

      <div class="projects__list">
        <AnimatedReveal v-for="(project, i) in projects" :key="project.id">
          <MainProject :project="project" :number="i + 1" :flipped="i % 2 === 1" />
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

/*a hairline between two projects*/
.projects__list > * + * {
  padding-top: var(--site-case-gap);
  border-top: var(--border-width-sm) solid var(--site-line);
}
</style>

<script setup lang="ts">
import { useLanguage } from "../../composables/useLanguage"
import AnimatedReveal from "./AnimatedReveal.vue"
import ExperienceItem from "./ExperienceItem.vue"
import SectionHeader from "./SectionHeader.vue"
import SectionAddButton from "../admin/SectionAddButton.vue"
import type { ExperienceDto } from "../../types/portfolio"

defineProps<{ experiences: ExperienceDto[] }>()

const { t } = useLanguage()
</script>

<template>
  <section id="experience" class="site-section" aria-labelledby="experience-title">
    <div class="site-container">
      <SectionHeader id="experience-title" :title="t('experienceTitle')" />

      <ol class="timeline">
        <AnimatedReveal v-for="exp in experiences" :key="exp.id" tag="li">
          <ExperienceItem :experience="exp" />
        </AnimatedReveal>
      </ol>

      <SectionAddButton kind="experience" class="timeline__add" />
    </div>
  </section>
</template>

<style scoped>
.timeline {
  list-style: none;
  border-bottom: var(--border-width-sm) solid var(--site-line);
}

.timeline__add { margin-top: var(--site-col-gap); }
</style>

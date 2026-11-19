<script setup lang="ts">
import AnimatedReveal from "./AnimatedReveal.vue"
import ExperienceItem from "./ExperienceItem.vue"
import About from "./About.vue"
import SectionAddButton from "../admin/SectionAddButton.vue"
import InlineLabel from "../admin/InlineLabel.vue"
import type { ExperienceDto, ProfileDto } from "../../types/portfolio"

//THE TIMELINE under a centered, underlined title, then the about card, on a
//darkening background
defineProps<{ experiences: ExperienceDto[]; profile: ProfileDto }>()
</script>

<template>
  <section id="experience" tabindex="-1" class="experience site-section" aria-labelledby="experience-title">
    <div class="site-container">
      <InlineLabel id="experience-title" name="experienceTitle" tag="h2" class="experience__title" />

      <ol class="experience__timeline">
        <AnimatedReveal v-for="(exp, i) in experiences" :key="exp.id" tag="li" :delay="i * 0.2">
          <ExperienceItem :experience="exp" />
        </AnimatedReveal>
      </ol>

      <SectionAddButton kind="experience" class="experience__add" />

      <About :profile="profile" />
    </div>
  </section>
</template>

<style scoped>
.experience {
  background-image: linear-gradient(to bottom, var(--color-background), var(--color-background-secondary));
}

.experience__title {
  position: relative;
  width: fit-content;
  margin: 0 auto var(--spacing-3xl);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  text-align: center;
  color: var(--site-text-heading);
}

/*the short rule under the title*/
.experience__title::after {
  content: "";
  position: absolute;
  bottom: calc(-1 * var(--spacing-xs));
  left: 25%;
  width: 50%;
  height: var(--border-width-sm);
  background-color: var(--site-text-body);
}

.experience__timeline {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  list-style: none;
}

.experience__add { margin-top: var(--site-col-gap); }

@media (max-width: 768px) {
  .experience__title {
    margin-bottom: var(--spacing-xl);
    font-size: var(--font-size-lg);
  }
}
</style>

<script setup lang="ts">
import { computed } from "vue"
import { useLanguage } from "../../composables/useLanguage"
import EditableRegion from "../admin/EditableRegion.vue"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import type { ExperienceDto } from "../../types/portfolio"

//ONE ROW OF THE TIMELINE: the period on the left, the role and what it was on
//the right; the period moves above the role on a phone.
const props = defineProps<{ experience: ExperienceDto }>()

const { t, lang } = useLanguage()

//"06.2023-ACT." reads as a range: the hyphen becomes a spaced en dash
const period  = computed(() => props.experience.period[lang.value].split("-").map((s) => s.trim()).filter(Boolean).join(" – "))
const where   = computed(() => [props.experience.company, props.experience.location].filter(Boolean).join(", "))
const bullets = computed(() => props.experience.description[lang.value].filter((b) => b.trim() !== ""))
</script>

<template>
  <EditableRegion kind="experience" :id="experience.id" :label="t('editorKindExperience')">
    <article class="job" :class="{ 'site-unpublished': !experience.published }">
      <UnpublishedBadge :published="experience.published" />
      <p class="job__period">{{ period }}</p>
      <div class="job__body">
        <h3 class="job__title">{{ experience.title[lang] }}</h3>
        <p v-if="where" class="job__where">{{ where }}</p>
        <p v-if="experience.summary[lang]" class="job__summary">{{ experience.summary[lang] }}</p>
        <ul v-if="bullets.length" class="job__bullets">
          <li v-for="(bullet, i) in bullets" :key="i">{{ bullet }}</li>
        </ul>
      </div>
    </article>
  </EditableRegion>
</template>

<style scoped>
.job {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 9fr);
  gap: var(--site-col-gap);
  padding-block: var(--spacing-xl);
  border-top: var(--border-width-sm) solid var(--site-line);
}

.job__period {
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-caption);
}

.job__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: var(--site-text-width);
}

.job__title {
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-bold);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.job__where {
  font-size: var(--site-fs-small);
  color: var(--site-text-body);
}

.job__summary {
  white-space: pre-line;
  color: var(--site-text-body);
}

.job__bullets {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  list-style: none;
  color: var(--site-text-body);
}

.job__bullets li {
  position: relative;
  padding-left: var(--spacing-lg);
}

.job__bullets li::before {
  content: "";
  position: absolute;
  top: calc(var(--site-lh-body) * 0.5em);
  left: 0;
  width: var(--spacing-sm);
  height: var(--border-width-sm);
  background-color: var(--site-accent);
}

@media (max-width: 640px) {
  .job {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-xs);
  }
}
</style>

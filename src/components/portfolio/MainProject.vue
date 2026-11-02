<script setup lang="ts">
import { toRef } from "vue"
import { ArrowRight } from "lucide-vue-next"
import { useProjectCard } from "../../composables/useProjectCard"
import EditableRegion from "../admin/EditableRegion.vue"
import ProjectMedia from "./ProjectMedia.vue"
import ProjectSpecStrip from "./ProjectSpecStrip.vue"
import SoftwareChips from "./SoftwareChips.vue"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import type { MainProjectDto } from "../../types/portfolio"

//CASE-STUDY CARD - the model first (ProjectMedia), then what a recruiter
//scans: its number in outline, year, role, title, the spec strip, the
//software, and the project page.
//Cards alternate sides down the list so the section does not read as one
//repeated block: a flipped card puts its facts on the left, the model and its
//thumbnail column on the right.
const props = defineProps<{ project: MainProjectDto; number: number; flipped: boolean }>()

const { lang, t, title, role, description } = useProjectCard(toRef(props, "project"))

const titleId = `project-${props.project.id}-title`
</script>

<template>
  <EditableRegion kind="mainProject" :id="project.id" :label="t('editorKindMainProject')">
    <article class="case" :class="{ 'case--flipped': flipped, 'site-unpublished': !project.published }" :aria-labelledby="titleId">
      <UnpublishedBadge :published="project.published" />

      <ProjectMedia :project="project" :thumbs-side="flipped ? 'right' : 'left'" class="case__media" />

      <div class="case__info">
        <header class="case__head">
          <span class="case__number" aria-hidden="true">{{ String(number).padStart(2, "0") }}</span>
          <p v-if="project.year || role" class="site-eyebrow case__meta">
            <span v-if="project.year" class="case__year">{{ project.year }}</span>
            <span v-if="project.year && role" aria-hidden="true">/</span>
            <span v-if="role">{{ role }}</span>
          </p>
          <h3 :id="titleId" class="case__title">{{ title }}</h3>
        </header>

        <div class="case__body">
          <p v-if="description" class="case__description">{{ description }}</p>

          <ProjectSpecStrip :stats="project.stats" :lang="lang" inline class="case__specs" />

          <SoftwareChips :software="project.software" :aria-label="t('projectSoftware')" />

          <RouterLink :to="`/project/${project.id}`" class="site-button site-button--primary case__cta">
            {{ t("projectViewPage") }}
            <ArrowRight aria-hidden="true" />
          </RouterLink>
        </div>
      </div>
    </article>
  </EditableRegion>
</template>

<style scoped>
/*desktop: the model on 8 columns, the facts on 4 and centred against it, so
each card reads as a pair rather than a block; stacked below 1025px*/
.case {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
  align-items: center;
  gap: var(--site-col-gap);
}

.case__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.case__head {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.case__number {
  font-size: var(--site-number-size);
  font-weight: var(--font-weight-black);
  line-height: 1;
  letter-spacing: var(--site-tracking-display);
  color: transparent;
  -webkit-text-stroke: var(--border-width-md) var(--site-line-strong);
  font-variant-numeric: tabular-nums;
}

.case__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.case__year { font-variant-numeric: tabular-nums; }

.case__title {
  font-size: var(--site-fs-h2);
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--site-tracking-display);
  text-transform: uppercase;
  color: var(--site-text-heading);
  overflow-wrap: anywhere;
}

.case__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.case__description {
  max-width: var(--site-text-width);
  white-space: pre-line;
  color: var(--site-text-body);
}

/*full width in a column that aligns its items to the start*/
.case__specs { align-self: stretch; }

/*flipped: the facts in the first column, the model in the second*/
.case--flipped { grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); }
.case--flipped .case__media { order: 1; }

@media (max-width: 1024px) {
  .case,
  .case--flipped { grid-template-columns: minmax(0, 1fr); }
  .case--flipped .case__media { order: 0; }
}

@media (max-width: 640px) {
  .case__cta { width: 100%; }
}
</style>

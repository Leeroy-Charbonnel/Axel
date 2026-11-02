<script setup lang="ts">
import { ref, toRef } from "vue"
import { ArrowRight, Box, Image as ImageIcon, Layers } from "lucide-vue-next"
import { useProjectCard } from "../../composables/useProjectCard"
import { IMAGE_SIZES } from "../../lib/media"
import EditableRegion from "../admin/EditableRegion.vue"
import SiteImage from "../SiteImage.vue"
import ThreeViewer from "./ThreeViewer.vue"
import ProjectSpecStrip from "./ProjectSpecStrip.vue"
import SoftwareChips from "./SoftwareChips.vue"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import type { MainProjectDto } from "../../types/portfolio"

//CASE-STUDY CARD - the still first, in its viewfinder frame, then what a
//recruiter scans: year, role, title, the spec strip, the software, and the two
//ways in (the project page, or the model itself in 3D, mounted only on request).
const props = defineProps<{ project: MainProjectDto }>()

const {
  lang, t, title, role, description, viewerSettings, glbUrl,
  showWireframe, hasWireframe, stillUrl, openStill, openThumbnail,
} = useProjectCard(toRef(props, "project"))

const viewerOpen = ref(false)
const titleId = `project-${props.project.id}-title`
</script>

<template>
  <EditableRegion kind="mainProject" :id="project.id" :label="t('editorKindMainProject')">
    <article class="case" :class="{ 'site-unpublished': !project.published }" :aria-labelledby="titleId">
      <UnpublishedBadge :published="project.published" />

      <div class="case__media">
        <div class="case__stage site-frame">
          <ThreeViewer
            v-if="viewerOpen && glbUrl"
            :glb-url="glbUrl"
            :settings="viewerSettings"
            :poster="project.mainImageUrl"
            :poster-sizes="IMAGE_SIZES.still"
            :alt="title"
            requested
            class="case__viewer"
          />
          <button
            v-else-if="stillUrl"
            type="button"
            class="case__still"
            :class="{ 'case__still--wireframe': showWireframe }"
            :aria-label="`${t('projectOpenImage')} : ${title}`"
            @click="openStill"
          >
            <SiteImage
              v-if="project.mainImageUrl"
              :src="project.mainImageUrl"
              :sizes="IMAGE_SIZES.still"
              class="case__image"
            />
            <SiteImage
              v-if="project.mainWireframeUrl"
              :src="project.mainWireframeUrl"
              :sizes="IMAGE_SIZES.still"
              class="case__image case__image--wireframe"
            />
          </button>
          <p v-else class="case__empty">{{ t("projectNoImage") }}</p>
        </div>

        <div class="case__bar">
          <ul v-if="project.thumbnails.some((thumb) => thumb.url)" class="case__thumbs" :aria-label="t('projectThumbs')">
            <template v-for="(thumb, i) in project.thumbnails" :key="i">
              <li v-if="thumb.url">
                <button
                  type="button"
                  class="case__thumb"
                  :aria-label="`${t('projectOpenImage')} : ${thumb.description[lang] || title}`"
                  @click="openThumbnail(thumb)"
                >
                  <SiteImage :src="thumb.url" :sizes="IMAGE_SIZES.thumb" />
                </button>
              </li>
            </template>
          </ul>

          <div class="case__actions">
            <button
              v-if="hasWireframe && !viewerOpen"
              type="button"
              class="site-button"
              :aria-pressed="showWireframe"
              @click="showWireframe = !showWireframe"
            >
              <Layers aria-hidden="true" />
              {{ t("projectWireframe") }}
            </button>
            <button v-if="glbUrl" type="button" class="site-button" @click="viewerOpen = !viewerOpen">
              <template v-if="viewerOpen">
                <ImageIcon aria-hidden="true" />
                {{ t("projectBackToImage") }}
              </template>
              <template v-else>
                <Box aria-hidden="true" />
                {{ t("projectView3d") }}
              </template>
            </button>
          </div>
        </div>
      </div>

      <div class="case__info">
        <header class="case__head">
          <p v-if="project.year || role" class="site-eyebrow case__meta">
            <span v-if="project.year" class="case__year">{{ project.year }}</span>
            <span v-if="project.year && role" aria-hidden="true">/</span>
            <span v-if="role">{{ role }}</span>
          </p>
          <h3 :id="titleId" class="case__title">{{ title }}</h3>
        </header>

        <div class="case__body">
          <p v-if="description" class="case__description">{{ description }}</p>

          <ProjectSpecStrip :stats="project.stats" :lang="lang" class="case__specs" />

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
/*desktop: the still on 8 columns, the facts on 4; stacked below 1025px*/
.case {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
  align-items: start;
  gap: var(--site-col-gap);
}

.case__media {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.case__stage {
  aspect-ratio: var(--site-still-aspect);
  background-color: var(--site-surface);
}

.case__viewer,
.case__still {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.case__still {
  display: block;
  padding: 0;
  cursor: zoom-in;
}

.case__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.case__image--wireframe {
  opacity: 0;
  transition: opacity var(--transition-slow) ease;
}

.case__still--wireframe .case__image--wireframe { opacity: 1; }

@media (hover: hover) {
  .case__still:hover .case__image--wireframe { opacity: 1; }
}

.case__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.case__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.case__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  list-style: none;
}

.case__thumb {
  display: block;
  width: var(--site-thumb);
  height: var(--site-thumb);
  padding: 0;
  border: var(--border-width-sm) solid var(--site-line);
  background-color: var(--site-surface);
  cursor: zoom-in;
  transition: border-color var(--site-duration-fast) ease;
}

.case__thumb:hover { border-color: var(--site-text-heading); }

.case__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.case__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-left: auto;
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

@media (max-width: 1024px) {
  .case { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .case__actions { margin-left: 0; width: 100%; }
  .case__actions .site-button { flex: 1 1 auto; }

  .case__cta { width: 100%; }
}
</style>

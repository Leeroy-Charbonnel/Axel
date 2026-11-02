<script setup lang="ts">
import { ref, toRef } from "vue"
import { Box, Image as ImageIcon, Layers } from "lucide-vue-next"
import { useProjectCard } from "../../composables/useProjectCard"
import { IMAGE_SIZES } from "../../lib/media"
import SiteImage from "../SiteImage.vue"
import ThreeViewer from "./ThreeViewer.vue"
import type { MainProjectDto } from "../../types/portfolio"

//A PROJECT'S MEDIA: the 3D model first when the project has one, the render in
//its viewfinder frame otherwise or on request (the wireframe on hover or on
//request), and the thumbnails opening the lightbox. The home card and the page
//of a project without blocks show the same.
const props = defineProps<{ project: MainProjectDto }>()

const {
  lang, t, title, viewerSettings, glbUrl,
  showWireframe, hasWireframe, stillUrl, openStill, openThumbnail,
} = useProjectCard(toRef(props, "project"))

const viewerOpen = ref(true)
</script>

<template>
  <div class="media">
    <div class="media__stage site-frame">
      <ThreeViewer
        v-if="viewerOpen && glbUrl"
        :glb-url="glbUrl"
        :settings="viewerSettings"
        :poster="project.mainImageUrl"
        :poster-sizes="IMAGE_SIZES.still"
        :alt="title"
        class="media__viewer"
      />
      <button
        v-else-if="stillUrl"
        type="button"
        class="media__still"
        :class="{ 'media__still--wireframe': showWireframe }"
        :aria-label="`${t('projectOpenImage')} : ${title}`"
        @click="openStill"
      >
        <SiteImage
          v-if="project.mainImageUrl"
          :src="project.mainImageUrl"
          :sizes="IMAGE_SIZES.still"
          class="media__image"
        />
        <SiteImage
          v-if="project.mainWireframeUrl"
          :src="project.mainWireframeUrl"
          :sizes="IMAGE_SIZES.still"
          class="media__image media__image--wireframe"
        />
      </button>
      <p v-else class="media__empty">{{ t("projectNoImage") }}</p>
    </div>

    <div class="media__bar">
      <ul v-if="project.thumbnails.some((thumb) => thumb.url)" class="media__thumbs" :aria-label="t('projectThumbs')">
        <template v-for="(thumb, i) in project.thumbnails" :key="i">
          <li v-if="thumb.url">
            <button
              type="button"
              class="media__thumb"
              :aria-label="`${t('projectOpenImage')} : ${thumb.description[lang] || title}`"
              @click="openThumbnail(thumb)"
            >
              <SiteImage :src="thumb.url" :sizes="IMAGE_SIZES.thumb" />
            </button>
          </li>
        </template>
      </ul>

      <div class="media__actions">
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
</template>

<style scoped>
.media {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.media__stage {
  aspect-ratio: var(--site-still-aspect);
  background-color: var(--site-surface);
}

.media__viewer,
.media__still {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.media__still {
  display: block;
  padding: 0;
  cursor: zoom-in;
}

.media__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.media__image--wireframe {
  opacity: 0;
  transition: opacity var(--transition-slow) ease;
}

.media__still--wireframe .media__image--wireframe { opacity: 1; }

@media (hover: hover) {
  .media__still:hover .media__image--wireframe { opacity: 1; }
}

.media__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.media__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.media__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  list-style: none;
}

.media__thumb {
  display: block;
  width: var(--site-thumb);
  height: var(--site-thumb);
  padding: 0;
  border: var(--border-width-sm) solid var(--site-line);
  background-color: var(--site-surface);
  cursor: zoom-in;
  transition: border-color var(--site-duration-fast) ease;
}

.media__thumb:hover { border-color: var(--site-text-heading); }

.media__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-left: auto;
}

@media (max-width: 640px) {
  .media__actions { margin-left: 0; width: 100%; }
  .media__actions .site-button { flex: 1 1 auto; }
}
</style>

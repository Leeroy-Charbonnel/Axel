<script setup lang="ts">
import { toRef } from "vue"
import { Layers } from "lucide-vue-next"
import { useProjectCard } from "../../composables/useProjectCard"
import { IMAGE_SIZES } from "../../lib/media"
import SiteImage from "../SiteImage.vue"
import ThreeViewer from "./ThreeViewer.vue"
import type { MainProjectDto } from "../../types/portfolio"

//A PROJECT'S MEDIA: the 3D model, floating on the page with no frame, and the
//thumbnails in a column over its right edge (a row under it on a phone). The
//viewer's wireframe mode turns the thumbnails to their wireframe renders with a
//diagonal wipe. The render is only the fallback of a project without a model.
//The home card and the page of a project without blocks show the same.
//thumbs false: the parent draws the thumbnails itself; toolbar false: the
//parent carries the wireframe button, bound through v-model:wireframe
const props = withDefaults(defineProps<{
  project:     MainProjectDto
  thumbsSide?: "left" | "right"
  thumbs?:     boolean
  toolbar?:    boolean
  toolbarSide?: "bottom" | "right"
}>(), { thumbsSide: "right", thumbs: true, toolbar: true, toolbarSide: "bottom" })

const showWireframe = defineModel<boolean>("wireframe", { default: false })
//wireframe or clay: the thumbnails show their clay renders
const plain = defineModel<boolean>("plain", { default: false })

const {
  lang, t, title, viewerSettings, glbUrl,
  hasWireframe, stillUrl, openStill, openThumbnail,
} = useProjectCard(toRef(props, "project"), showWireframe, plain)
</script>

<template>
  <div class="media" :class="[`media--thumbs-${thumbsSide}`, { 'media--wireframe': plain || showWireframe, 'media--with-thumbs': thumbs }]">
    <div class="media__stage" :class="{ 'media__stage--still': !glbUrl }">
      <ThreeViewer
        v-if="glbUrl"
        v-model:wireframe="showWireframe"
        v-model:plain="plain"
        :glb-url="glbUrl"
        :settings="viewerSettings"
        :poster="project.mainImageUrl"
        :poster-sizes="IMAGE_SIZES.still"
        :alt="title"
        :toolbar="toolbar"
        :toolbar-side="toolbarSide"
        class="media__viewer"
      />
      <button
        v-else-if="stillUrl"
        type="button"
        class="media__still"
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
          class="media__image media__wire"
        />
      </button>
      <p v-else class="media__empty">{{ t("projectNoImage") }}</p>

      <ul
        v-if="thumbs && project.thumbnails.some((thumb) => thumb.url)"
        class="media__thumbs"
        :class="`media__thumbs--${thumbsSide}`"
        :aria-label="t('projectThumbs')"
      >
        <template v-for="(thumb, i) in project.thumbnails" :key="i">
          <li v-if="thumb.url" class="media__thumb-item">
            <button
              type="button"
              class="media__thumb"
              :aria-label="`${t('projectOpenImage')} : ${thumb.description[lang] || title}`"
              @click="openThumbnail(thumb)"
            >
              <SiteImage :src="thumb.url" :sizes="IMAGE_SIZES.thumb" />
              <SiteImage v-if="thumb.wireframeUrl" :src="thumb.wireframeUrl" :sizes="IMAGE_SIZES.thumb" class="media__wire" />
            </button>
          </li>
        </template>
      </ul>
    </div>

    <div v-if="toolbar && hasWireframe && !glbUrl" class="media__actions">
      <button
        type="button"
        class="site-button"
        :aria-pressed="showWireframe"
        @click="showWireframe = !showWireframe"
      >
        <Layers aria-hidden="true" />
        {{ t("projectWireframe") }}
      </button>
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
  position: relative;
  aspect-ratio: var(--site-still-aspect);
}

.media__stage--still { background-color: var(--site-surface); }

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

/*THUMBNAILS - a column over one edge of the stage, sized so that
--site-thumb-count of them fill its height*/
.media__thumbs {
  position: absolute;
  top: var(--spacing-md);
  bottom: var(--spacing-md);
  z-index: var(--vsui-z-dropdown);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--spacing-xs);
  list-style: none;
}

.media__thumbs--left  { left: var(--spacing-md); }
.media__thumbs--right { right: var(--spacing-md); }

/*the viewer's toolbar sits bottom left: with the column there, it moves right*/
.media--thumbs-left :deep(.three-viewer__toolbar) {
  left: auto;
  right: var(--spacing-md);
}

.media__thumb-item {
  height: calc((100% - (var(--site-thumb-count) - 1) * var(--spacing-xs)) / var(--site-thumb-count));
  aspect-ratio: 1;
}

.media__thumb {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  background-color: var(--site-surface-hover);
  cursor: zoom-in;
  transition: box-shadow var(--site-duration-fast) ease;
}

.media__thumb:hover { box-shadow: 0 0 0 var(--border-width-sm) var(--site-text-heading); }

.media__thumb :deep(img) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*WIREFRAME LAYER - revealed by a diagonal wipe from the top left corner*/
.media__wire {
  clip-path: polygon(0 0, 0 0, 0 0);
  transition: clip-path var(--site-wire-wipe) var(--site-ease);
}

.media--wireframe .media__wire { clip-path: polygon(0 0, 200% 0, 0 200%); }

@media (hover: hover) {
  .media__still:hover .media__wire { clip-path: polygon(0 0, 200% 0, 0 200%); }
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

.media__actions {
  display: flex;
  justify-content: flex-end;
}

/*phone: the stage is too small to carry a column, the thumbnails make a row under it*/
@media (max-width: 640px) {
  .media--with-thumbs .media__stage { margin-bottom: calc(var(--site-thumb-row) + var(--spacing-sm)); }

  .media--thumbs-left :deep(.three-viewer__toolbar) {
    right: auto;
    left: var(--spacing-md);
  }

  .media__thumbs {
    top: calc(100% + var(--spacing-sm));
    right: 0;
    bottom: auto;
    left: 0;
    flex-direction: row;
    justify-content: flex-start;
    height: var(--site-thumb-row);
  }

  .media__thumb-item { height: 100%; }

  .media__actions .site-button { flex: 1 1 auto; }
}
</style>

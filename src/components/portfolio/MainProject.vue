<script setup lang="ts">
import { computed, ref, toRef } from "vue"
import { Box, Grid3x3 } from "lucide-vue-next"
import { useProjectCard } from "../../composables/useProjectCard"
import { IMAGE_SIZES } from "../../lib/media"
import { statRows } from "../../lib/portfolio-utils"
import EditableRegion from "../admin/EditableRegion.vue"
import SiteImage from "../SiteImage.vue"
import AnimatedCounter from "./AnimatedCounter.vue"
import ProjectMedia from "./ProjectMedia.vue"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import type { MainProjectDto } from "../../types/portfolio"

//CASE-STUDY CARD - three columns: the facts (number in outline, title,
//description, the counts with their initial, the two actions), the thumbnails
//between them and the model, and the model floating on its floor. Cards alternate sides down
//the list so the section does not read as one repeated block. The wireframe
//button turns the model and the thumbnails together.
//detail: the head of the project's own page, as the plan lays it out: facts,
//model with its toolbar (which replaces the two buttons), every thumbnail on
//the right.
const props = withDefaults(defineProps<{ project: MainProjectDto; number: number; flipped?: boolean; detail?: boolean }>(), {
  flipped: false,
  detail:  false,
})

const wireframe = ref(false)
const { lang, t, title, description, openThumbnail } = useProjectCard(toRef(props, "project"), wireframe)

//S F A T: vertices, faces, edges, triangles, each with the initial of its label
const STAT_ORDER = ["vertices", "faces", "edges", "triangles"]
const stats = computed(() => statRows(props.project.stats, lang.value, t)
  .sort((a, b) => STAT_ORDER.indexOf(a.key) - STAT_ORDER.indexOf(b.key))
  .map((s) => ({ ...s, initial: s.label.charAt(0).toUpperCase() })))

//the home card keeps three, the project's page shows them all
const CARD_THUMBS = 3
const thumbs = computed(() => {
  const all = props.project.thumbnails.filter((thumb) => thumb.url)
  return props.detail ? all : all.slice(0, CARD_THUMBS)
})


//the clay versions are decoded before the first sweep, so it never plays over
//images still loading; the model and the thumbnails then turn together
const thumbsEl = ref<HTMLElement | null>(null)
async function toggleWireframe() {
  if (!wireframe.value) {
    const images = [...(thumbsEl.value?.querySelectorAll<HTMLImageElement>(".case__wire img, img.case__wire") ?? [])]
    const results = await Promise.allSettled(images.map((img) => img.decode()))
    for (const r of results) {
      if (r.status === "rejected") console.warn("[project] a wireframe thumbnail could not be decoded:", r.reason)
    }
  }
  wireframe.value = !wireframe.value
}

const titleId = `project-${props.project.id}-title`
</script>

<template>
  <EditableRegion kind="mainProject" :id="project.id" :label="t('editorKindMainProject')">
    <article
      class="case"
      :class="{ 'case--flipped': flipped, 'case--detail': detail, 'case--wireframe': wireframe, 'site-unpublished': !project.published }"
      :aria-labelledby="titleId"
    >
      <UnpublishedBadge :published="project.published" />

      <ul v-if="thumbs.length" ref="thumbsEl" class="case__thumbs" :style="{ '--n': thumbs.length }" :aria-label="t('projectThumbs')">
        <li v-for="(thumb, i) in thumbs" :key="i" :style="{ '--i': i }">
          <button
            type="button"
            class="case__thumb"
            :aria-label="`${t('projectOpenImage')} : ${thumb.description[lang] || title}`"
            @click="openThumbnail(thumb)"
          >
            <SiteImage :src="thumb.url!" :sizes="IMAGE_SIZES.thumb" />
            <SiteImage v-if="thumb.wireframeUrl" :src="thumb.wireframeUrl" :sizes="IMAGE_SIZES.thumb" loading="eager" class="case__wire" />
          </button>
        </li>
      </ul>

      <div class="case__info">
        <span class="case__number" aria-hidden="true">{{ String(number).padStart(2, "0") }}</span>
        <h1 v-if="detail" :id="titleId" class="case__title case__title--page">{{ title }}</h1>
        <h3 v-else :id="titleId" class="case__title">
          <RouterLink :to="`/project/${project.id}`">{{ title }}</RouterLink>
        </h3>
        <p v-if="description" class="case__description">{{ description }}</p>

        <dl v-if="stats.length" class="case__stats" :aria-label="t('projectSpecs')">
          <div v-for="s in stats" :key="s.key" class="case__stat">
            <span class="case__stat-initial" aria-hidden="true">{{ s.initial }}</span>
            <dt class="case__stat-label">{{ s.label }}</dt>
            <dd class="case__stat-value"><AnimatedCounter :to="s.count" :lang="lang" /></dd>
          </div>
        </dl>

        <!--the project's page has the viewer's own toolbar instead-->
        <div v-if="!detail" class="case__actions">
          <RouterLink :to="`/project/${project.id}`" class="site-button case__action case__action--accent">
            <Box aria-hidden="true" />
            {{ t("projectView3d") }}
          </RouterLink>
          <button type="button" class="site-button case__action" :aria-pressed="wireframe" @click="toggleWireframe">
            <Grid3x3 aria-hidden="true" />
            {{ t("projectWireframe") }}
          </button>
        </div>
      </div>

      <ProjectMedia
        v-model:wireframe="wireframe"
        :project="project"
        :thumbs="false"
        :toolbar="detail"
        toolbar-side="right"
        class="case__media"
      />
    </article>
  </EditableRegion>
</template>

<style scoped>
/*desktop: facts | thumbnails | model, mirrored on a flipped card; below
1025px the model, then the thumbnails in a row, then the facts*/
.case {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 4fr) var(--site-thumb-col) minmax(0, 7fr);
  grid-template-areas: "info thumbs media";
  align-items: center;
  gap: var(--site-col-gap);
}

.case--flipped {
  grid-template-columns: minmax(0, 7fr) var(--site-thumb-col) minmax(0, 4fr);
  grid-template-areas: "media thumbs info";
}

/*the project's page: facts | model | thumbnails*/
.case--detail {
  grid-template-columns: minmax(0, 4fr) minmax(0, 7fr) var(--site-thumb-col);
  grid-template-areas: "info media thumbs";
}

.case__thumbs  { grid-area: thumbs; }
.case__info    { grid-area: info; }
.case__media   { grid-area: media; }

.case__media :deep(.media__stage) { aspect-ratio: var(--site-case-aspect); }

/*THUMBNAILS - square, hairline frame, the accent on hover*/
.case__thumbs {
  display: flex;
  flex-direction: column;
  gap: var(--g);
  list-style: none;
}

.case__thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: var(--border-width-sm) solid var(--site-line-strong);
  background-color: var(--site-surface-hover);
  cursor: zoom-in;
  transition: border-color var(--site-duration-fast) ease;
}

.case__thumb:hover,
.case__thumb:focus-visible { border-color: var(--site-accent); }

.case__thumb :deep(img) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*WIREFRAME LAYER - one diagonal line sweeps the whole column: it enters the
first thumbnail at its top left corner and crosses the others in step. The
column animates one number, --wipe, from 0 to 1; each thumbnail places the
line in its own corner from its index (--i), its size (--s) and the gap (--g):
the line x + y = t, t growing over the column's width plus height.*/
@property --wipe {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

.case__thumbs {
  --s: var(--site-thumb-col);
  --g: var(--spacing-sm);
  --wipe: 0;
  transition: --wipe var(--site-wire-wipe) var(--site-ease);
}

.case--wireframe .case__thumbs { --wipe: 1; }

/*the line crosses the column's width plus its height: n thumbnails and their gaps*/
.case__wire {
  --t: calc(var(--wipe) * ((var(--n) + 1) * var(--s) + (var(--n) - 1) * var(--g)) - var(--i) * (var(--s) + var(--g)));
  clip-path: polygon(0 0, var(--t) 0, 0 var(--t));
}

/*FACTS*/
.case__info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.case__number {
  font-size: var(--site-number-size);
  font-weight: var(--font-weight-black);
  line-height: 1;
  letter-spacing: var(--site-tracking-display);
  /*the fill, painted over the inner half of the stroke, hides the lines where
  a glyph's contours cross (the 1); only the outer half shows*/
  color: hsl(var(--background));
  -webkit-text-stroke: calc(2 * var(--border-width-md)) var(--site-line-strong);
  paint-order: stroke fill;
  font-variant-numeric: tabular-nums;
}

.case__title {
  font-size: var(--site-fs-h2);
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--site-tracking-heading);
  text-transform: uppercase;
  color: var(--site-text-heading);
  overflow-wrap: anywhere;
}

.case__title--page { font-size: var(--site-fs-h1); }

.case__title a { transition: color var(--site-duration-fast) ease; }
.case__title a:hover { color: var(--site-accent); }

.case__description {
  max-width: var(--site-text-width);
  white-space: pre-line;
  color: var(--site-text-body);
}

.case__stats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/*initial, value, label: the value comes second on screen, after its label in the markup*/
.case__stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.case__stat-initial {
  display: inline-grid;
  place-content: center;
  width: var(--site-stat-badge);
  height: var(--site-stat-badge);
  background-color: var(--site-surface-hover);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-bold);
  color: var(--site-text-heading);
}

.case__stat-value {
  order: 1;
  min-width: var(--site-stat-value);
  margin: 0;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--site-text-heading);
}

.case__stat-label {
  order: 2;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.case__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.case__action--accent {
  border-color: var(--site-accent);
  color: var(--site-accent);
}

.case__action[aria-pressed="true"] {
  border-color: var(--site-accent);
  background-color: var(--site-accent);
  color: var(--site-on-accent);
}

@media (max-width: 1024px) {
  .case,
  .case--flipped,
  .case--detail {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "media" "thumbs" "info";
  }

  /*a row: the same line crosses it from left to right*/
  .case__thumbs {
    --s: calc((100vw - 2 * var(--site-gutter) - (var(--n) - 1) * var(--g)) / var(--n));
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .case__action { flex: 1 1 auto; }
}
</style>

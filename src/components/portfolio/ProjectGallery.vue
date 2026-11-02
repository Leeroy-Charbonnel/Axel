<script setup lang="ts">
import { computed } from "vue"
import { ArrowUpRight } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { useLightbox } from "../../composables/useLightbox"
import { safeUrl } from "../../lib/safe-url"
import { statRows } from "../../lib/portfolio-utils"
import { IMAGE_SIZES } from "../../lib/media"
import SiteImage from "../SiteImage.vue"
import AnimatedReveal from "./AnimatedReveal.vue"
import SectionHeader from "./SectionHeader.vue"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import EditableRegion from "../admin/EditableRegion.vue"
import SectionAddButton from "../admin/SectionAddButton.vue"
import type { GalleryProjectDto } from "../../types/portfolio"

//GALLERY - a responsive grid of renders; a tap opens the whole set in the
//lightbox, and the external link sits under the card, not over the image.
const props = defineProps<{ projects: GalleryProjectDto[] }>()

const { t, lang } = useLanguage()
const { open: openLightbox } = useLightbox()

const cards = computed(() => props.projects.map((p) => {
  const href = safeUrl(p.link)
  return {
    project: p,
    title:   p.title[lang.value],
    stats:   statRows(p.stats, lang.value, t),
    href,
    host:    href ? new URL(href).hostname.replace(/^www\./, "") : "",
  }
}))

const slides = computed(() => props.projects
  .filter((p) => p.imageUrl)
  .map((p) => ({ url: p.imageUrl as string, alt: p.title[lang.value] })))

function open(p: GalleryProjectDto) {
  openLightbox(slides.value, slides.value.findIndex((s) => s.url === p.imageUrl))
}
</script>

<template>
  <section id="gallery" class="gallery site-section" aria-labelledby="gallery-title">
    <div class="site-container">
      <SectionHeader id="gallery-title" :title="t('galleryTitle')" />

      <ul class="gallery__grid">
        <AnimatedReveal v-for="(card, i) in cards" :key="card.project.id" tag="li" :delay="(i % 3) * 0.06">
          <EditableRegion kind="galleryItem" :id="card.project.id" :label="t('editorKindGalleryItem')">
            <article class="gallery__card" :class="{ 'site-unpublished': !card.project.published }">
              <UnpublishedBadge :published="card.project.published" />
              <button
                v-if="card.project.imageUrl"
                type="button"
                class="gallery__media"
                :aria-label="`${t('projectOpenImage')} : ${card.title}`"
                @click="open(card.project)"
              >
                <SiteImage :src="card.project.imageUrl" :sizes="IMAGE_SIZES.gallery" />
              </button>
              <p v-else class="gallery__media gallery__media--empty">{{ t("projectNoImage") }}</p>

              <div class="gallery__text">
                <h3 class="gallery__title">{{ card.title }}</h3>
                <dl v-if="card.stats.length" class="gallery__stats">
                  <div v-for="stat in card.stats" :key="stat.key" class="gallery__stat">
                    <dt>{{ stat.label }}</dt>
                    <dd>{{ stat.value }}</dd>
                  </div>
                </dl>
                <a
                  v-if="card.href"
                  :href="card.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="gallery__link"
                  :aria-label="t('galleryLinkLabel').replace('{title}', card.title).replace('{host}', card.host)"
                >
                  {{ card.host }}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </article>
          </EditableRegion>
        </AnimatedReveal>
      </ul>

      <SectionAddButton kind="galleryItem" class="gallery__add" />
    </div>
  </section>
</template>

<style scoped>
.gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--site-gallery-min)), 1fr));
  gap: var(--site-col-gap);
  list-style: none;
}

.gallery__card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  border: var(--border-width-sm) solid var(--site-line);
  transition: border-color var(--site-duration-fast) ease;
}

.gallery__card:hover { border-color: var(--site-line-strong); }

.gallery__media {
  display: block;
  width: 100%;
  aspect-ratio: var(--site-gallery-aspect);
  padding: 0;
  overflow: hidden;
  background-color: var(--site-surface);
  cursor: zoom-in;
}

.gallery__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow) var(--site-ease);
}

@media (hover: hover) {
  .gallery__media:hover img { transform: scale(var(--site-hover-zoom)); }
}

.gallery__media--empty {
  display: grid;
  place-content: center;
  cursor: default;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.gallery__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: var(--border-width-sm) solid var(--site-line);
}

.gallery__title {
  font-size: var(--site-fs-body);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.gallery__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs) var(--spacing-lg);
  font-size: var(--site-fs-small);
}

.gallery__stat {
  display: flex;
  gap: var(--spacing-xs);
}

.gallery__stat dt { color: var(--site-text-caption); }

.gallery__stat dd {
  font-variant-numeric: tabular-nums;
  color: var(--site-text-body);
}

.gallery__link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--spacing-xxs);
  min-height: var(--site-touch-target);
  margin-top: auto;
  margin-bottom: calc(-1 * var(--spacing-sm));
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  color: var(--site-text-caption);
  transition: color var(--site-duration-fast) ease;
}

.gallery__link:hover { color: var(--site-accent); }

.gallery__link svg {
  width: var(--site-icon-sm);
  height: var(--site-icon-sm);
}

.gallery__add { margin-top: var(--site-col-gap); }
</style>

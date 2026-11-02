<script setup lang="ts">
import { computed } from "vue"
import { ArrowDown } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { useSectionNav } from "../../composables/useSectionNav"
import { IMAGE_SIZES } from "../../lib/media"
import EditableRegion from "../admin/EditableRegion.vue"
import SiteImage from "../SiteImage.vue"
import Availability from "./Availability.vue"
import SocialLinks from "./SocialLinks.vue"
import type { MainProjectDto, ProfileDto } from "../../types/portfolio"

//HERO - the person is the title: name, headline, availability, pitch, the two
//ways forward, the links, and the featured render in its viewfinder frame.
const props = defineProps<{ profile: ProfileDto; featured: MainProjectDto | null }>()

const { t, lang } = useLanguage()
const { go } = useSectionNav()

//the last word carries the accent, as the original title did
const nameParts = computed(() => {
  const words = props.profile.name.trim().split(/\s+/)
  return { first: words.slice(0, -1).join(" "), last: words[words.length - 1] ?? "" }
})
const headline = computed(() => props.profile.headline[lang.value])
const pitch    = computed(() => props.profile.pitch[lang.value])
</script>

<template>
  <section id="home" class="hero site-section" aria-labelledby="hero-name">
    <div class="site-container hero__grid">
      <EditableRegion kind="profile" :label="t('editorKindProfile')">
        <div class="hero__text">
        <Availability :profile="profile" class="hero__availability" />

        <h1 id="hero-name" class="hero__name">
          <span v-if="nameParts.first" class="hero__name-first">{{ nameParts.first }}</span>
          <span class="hero__name-last">{{ nameParts.last }}</span>
        </h1>

        <p v-if="headline" class="hero__headline">{{ headline }}</p>
        <p v-if="pitch" class="hero__pitch">{{ pitch }}</p>

        <div class="hero__ctas">
          <a href="#projects" class="site-button site-button--primary" @click.prevent="go('projects')">
            {{ t("heroCtaProjects") }}
            <ArrowDown aria-hidden="true" />
          </a>
          <a href="#contact" class="site-button" @click.prevent="go('contact')">{{ t("heroCtaContact") }}</a>
        </div>

        <SocialLinks :links="profile.links" />
        </div>
      </EditableRegion>

      <figure v-if="featured?.mainImageUrl" class="hero__visual">
        <div class="hero__frame site-frame">
          <SiteImage
            :src="featured.mainImageUrl"
            :alt="featured.title[lang]"
            :sizes="IMAGE_SIZES.hero"
            loading="eager"
            fetchpriority="high"
            class="hero__image"
          />
        </div>
        <figcaption class="hero__caption">
          <span class="site-eyebrow">{{ t("heroFeatured") }}</span>
          <RouterLink :to="`/project/${featured.id}`" class="hero__caption-link">{{ featured.title[lang] }}</RouterLink>
          <span v-if="featured.year" class="hero__caption-year">{{ featured.year }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  min-height: var(--site-hero-min-height);
}

.hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  align-items: center;
  gap: var(--site-col-gap);
}

.hero__text {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.hero__name {
  display: flex;
  flex-direction: column;
  /*never wider than its column: a six-letter word fits in --site-name-fit*/
  font-size: min(var(--site-fs-display), var(--site-name-fit));
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--site-tracking-display);
  text-transform: uppercase;
  color: var(--site-text-heading);
  overflow-wrap: break-word;
}

.hero__name-last { color: var(--site-accent); }

.hero__headline {
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--site-tracking-heading);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.hero__pitch {
  max-width: var(--site-text-width);
  color: var(--site-text-body);
}

.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.hero__visual {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.hero__frame {
  aspect-ratio: var(--site-still-aspect);
  background-color: var(--site-surface);
}

.hero__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero__caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--spacing-sm);
  font-size: var(--site-fs-small);
  color: var(--site-text-caption);
}

.hero__caption-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--site-touch-target);
  color: var(--site-text-body);
  text-decoration: underline;
  text-decoration-color: var(--site-line-strong);
  text-underline-offset: var(--border-width-lg);
  transition: color var(--site-duration-fast) ease;
}

.hero__caption-link:hover { color: var(--site-accent); }

.hero__caption-year { font-variant-numeric: tabular-nums; }

@media (max-width: 1024px) {
  .hero { min-height: 0; }
  .hero__grid { grid-template-columns: minmax(0, 1fr); }
}
</style>

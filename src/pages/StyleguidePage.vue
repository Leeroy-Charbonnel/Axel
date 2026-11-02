<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue"
import { useConfirm } from "../composables/useConfirm"
import { useLanguage } from "../composables/useLanguage"
import { usePortfolio } from "../composables/usePortfolio"
import { useToast, type ToastType } from "../composables/useToast"
import { useMediaLibrary, mediaTypeOf } from "../components/admin/media/useMediaLibrary"
import { pickBilingual } from "../lib/markdown"
import { SHOWCASE_PREFIX, showcaseProjects } from "../lib/showcase-content"
import { BLOCK_TYPES } from "../components/portfolio/detail/block-types"
import DetailGrid from "../components/portfolio/detail/DetailGrid.vue"
import ProjectSpecStrip from "../components/portfolio/detail/ProjectSpecStrip.vue"
import SoftwareChips from "../components/portfolio/detail/SoftwareChips.vue"
import BlockButton from "../components/portfolio/detail/BlockButton.vue"
import StyleguideFields from "../components/styleguide/StyleguideFields.vue"
import StyleguideTokens from "../components/styleguide/StyleguideTokens.vue"
import type { DetailBlock } from "../types/portfolio"

//STYLEGUIDE - every token, button, field, feedback and block of the site on
//one admin page, the blocks inside a frame the owner resizes to see them at
//phone, tablet and desktop widths.

const { lang, t } = useLanguage()
const toast = useToast()
const { confirm } = useConfirm()
const { data } = usePortfolio()
const media = useMediaLibrary()

const WIDTHS = [
  { px: 375,  label: "styleguideWidthPhone" },
  { px: 768,  label: "styleguideWidthTablet" },
  { px: 1024, label: "styleguideWidthLaptop" },
  { px: 1280, label: "styleguideWidthDesktop" },
]
const frameWidth = ref(1280)

const SECTIONS = [
  { id: "tokens",   label: "styleguideTokens" },
  { id: "buttons",  label: "styleguideButtons" },
  { id: "chips",    label: "styleguideChips" },
  { id: "fields",   label: "styleguideFields" },
  { id: "feedback", label: "styleguideFeedback" },
  { id: "blocks",   label: "styleguideBlocks" },
]

onMounted(() => { void media.load() })

//one block of each type, taken from the showcase content and laid at its
//default size; a type the files cannot illustrate shows its empty state
const samples = computed<{ type: string; label: string; blocks: DetailBlock[] }[]>(() => {
  const files = media.files.value
  //renders already on the site first, like the seed: the library also holds logos
  const site = data.value
  const shown = new Set(site ? [
    ...site.mainProjects.flatMap((p) => [p.mainImageUrl, ...p.thumbnails.map((th) => th.url)]),
    ...site.galleryProjects.map((g) => g.imageUrl),
  ] : [])
  const images = files
    .filter((f) => mediaTypeOf(f) === "image")
    .sort((a, b) => Number(shown.has(b.url)) - Number(shown.has(a.url)))
    .map((f) => ({ id: f.id, url: f.url }))
  const videos = files.filter((f) => mediaTypeOf(f) === "video").map((f) => ({ id: f.id, url: f.url }))
  const models = (data.value?.models ?? []).filter((m) => m.views.length).map((m) => ({ id: m.id, name: m.name, view: m.views[0]!.name }))
  const pool = images.length ? showcaseProjects({ images, videos, models }).flatMap((p) => p.blocks) : []
  return BLOCK_TYPES.map((def) => {
    const found = pool.find((b) => b.type === def.type)
    const block: DetailBlock = {
      id: `sample-${def.type}`, type: def.type, x: 0, y: 0, w: def.size.w, h: def.size.h,
      content: found ? found.content : def.create(),
    }
    return { type: def.type, label: t(def.labelKey), blocks: [block] }
  })
})

const showcase = computed(() => (data.value?.mainProjects ?? []).filter((p) => p.title.fr.startsWith(SHOWCASE_PREFIX)))

const TOASTS: { type: ToastType; label: string }[] = [
  { type: "success", label: "styleguideToastSuccess" },
  { type: "error",   label: "styleguideToastError" },
  { type: "info",    label: "styleguideToastInfo" },
  { type: "warning", label: "styleguideToastWarning" },
]
function showToast(type: ToastType, label: string) {
  toast.show({ type, message: t("styleguideToastMessage").replace("{type}", t(label)) })
}

const answer = ref<string | null>(null)
async function openConfirm(destructive: boolean) {
  const ok = await confirm({
    title:  t("styleguideConfirmTitle"),
    what:   t("styleguideConfirmWhat"),
    action: t("editorDeleteAction"),
    destructive,
  })
  answer.value = t(ok ? "styleguideConfirmYes" : "styleguideConfirmNo")
}

const sampleButton = reactive({ label: { fr: "Voir le projet", en: "See the project" }, url: "https://www.artstation.com/", newTab: true })
const sampleStats = { vertices: 48210, edges: 96030, faces: 0, triangles: 95640 }
</script>

<template>
  <div class="sg">
    <header class="sg__head">
      <h1 class="sg__title">{{ t('styleguideTitle') }}</h1>
      <p class="sg__intro">{{ t('styleguideIntro') }}</p>
      <nav class="sg__nav" :aria-label="t('styleguideNav')">
        <a v-for="s in SECTIONS" :key="s.id" :href="`#sg-${s.id}`" class="sg__nav-link">{{ t(s.label) }}</a>
      </nav>
      <div v-if="showcase.length" class="sg__showcase">
        <span class="sg__label">{{ t('styleguideShowcaseLinks') }}</span>
        <RouterLink v-for="p in showcase" :key="p.id" :to="`/project/${p.id}`" class="sg__nav-link">{{ pickBilingual(p.title, lang) }}</RouterLink>
      </div>
    </header>

    <section id="sg-tokens" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideTokens') }}</h2>
      <StyleguideTokens />
    </section>

    <section id="sg-buttons" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideButtons') }}</h2>
      <h3 class="sg__h3">{{ t('styleguideSiteButtons') }}</h3>
      <div class="sg__row">
        <button type="button" class="site-button site-button--primary">{{ t('styleguideBtnPrimary') }}</button>
        <button type="button" class="site-button">{{ t('styleguideBtnDefault') }}</button>
      </div>
      <div class="sg__row sg__row--site">
        <BlockButton :content="sampleButton" :lang="lang" />
        <BlockButton :content="{ ...sampleButton, url: '' }" :lang="lang" />
      </div>
      <h3 class="sg__h3">{{ t('styleguideEditorButtons') }}</h3>
      <div class="sg__row">
        <button type="button" class="ed-btn ed-btn--primary">{{ t('styleguideBtnPrimary') }}</button>
        <button type="button" class="ed-btn">{{ t('styleguideBtnDefault') }}</button>
        <button type="button" class="ed-btn ed-btn--active">{{ t('styleguideBtnActive') }}</button>
        <button type="button" class="ed-btn ed-btn--ghost">{{ t('styleguideBtnGhost') }}</button>
        <button type="button" class="ed-btn ed-btn--danger">{{ t('styleguideBtnDanger') }}</button>
        <button type="button" class="ed-btn" disabled>{{ t('styleguideBtnDisabled') }}</button>
      </div>
    </section>

    <section id="sg-chips" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideChips') }}</h2>
      <SoftwareChips :software="data?.software ?? []" />
      <ProjectSpecStrip :stats="sampleStats" :lang="lang" />
    </section>

    <section id="sg-fields" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideFields') }}</h2>
      <StyleguideFields />
    </section>

    <section id="sg-feedback" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideFeedback') }}</h2>
      <div class="sg__row">
        <button v-for="ts in TOASTS" :key="ts.type" type="button" class="ed-btn" @click="showToast(ts.type, ts.label)">{{ t(ts.label) }}</button>
      </div>
      <div class="sg__row">
        <button type="button" class="ed-btn" @click="openConfirm(false)">{{ t('styleguideConfirmOpen') }}</button>
        <button type="button" class="ed-btn ed-btn--danger" @click="openConfirm(true)">{{ t('styleguideConfirmDestructive') }}</button>
        <span v-if="answer" class="sg__answer" role="status">{{ t('styleguideConfirmAnswer').replace('{answer}', answer) }}</span>
      </div>
    </section>

    <section id="sg-blocks" class="sg__section">
      <h2 class="sg__h2">{{ t('styleguideBlocks') }}</h2>
      <p class="sg__intro">{{ t('styleguideBlocksHint') }}</p>
      <div class="sg__row" role="radiogroup" :aria-label="t('styleguideWidth')">
        <button
          v-for="w in WIDTHS"
          :key="w.px"
          type="button"
          role="radio"
          class="ed-btn"
          :class="{ 'ed-btn--active': frameWidth === w.px }"
          :aria-checked="frameWidth === w.px"
          @click="frameWidth = w.px"
        >{{ t(w.label) }} {{ w.px }}</button>
      </div>
      <p v-if="media.error.value" class="ed-error" role="alert">{{ media.error.value }}</p>
      <div class="sg__frame" :style="{ width: `${frameWidth}px` }">
        <article v-for="s in samples" :key="s.type" class="sg__block">
          <h3 class="sg__h3">{{ s.label }}</h3>
          <DetailGrid :blocks="s.blocks" :lang="lang" />
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sg {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3xl);
  width: 100%;
  max-width: calc(var(--site-max-width) + 2 * var(--site-gutter));
  margin-inline: auto;
  padding: var(--spacing-3xl) var(--site-gutter) var(--site-section-gap);
  font-family: var(--site-font);
  color: var(--site-text-body);
}
.sg__head { display: flex; flex-direction: column; gap: var(--spacing-md); }
.sg__title {
  margin: 0;
  font-size: var(--site-fs-h1);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--site-text-heading);
}
.sg__intro {
  max-width: var(--site-text-width);
  margin: 0;
  font-size: var(--site-fs-body);
  line-height: var(--site-lh-body);
}
.sg__nav,
.sg__showcase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs) var(--spacing-lg);
}
.sg__nav-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-body);
  text-decoration: underline;
  text-underline-offset: var(--spacing-xxs);
}
.sg__nav-link:hover { color: var(--site-accent); }
.sg__label {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.sg__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  scroll-margin-top: var(--spacing-xl);
}
.sg__h2 {
  margin: 0;
  padding-top: var(--spacing-md);
  font-size: var(--site-fs-h2);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--site-text-heading);
  border-top: var(--border-width) solid var(--site-line);
}
.sg__h3 {
  margin: 0;
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.sg__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
}
.sg__row--site > * { width: auto; height: auto; }
.sg__answer { font-size: var(--site-fs-small); color: var(--site-text-heading); }
.sg__frame {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  max-width: 100%;
  min-width: var(--detail-phone-width);
  padding: var(--spacing-md);
  overflow: auto;
  resize: horizontal;
  border: var(--border-width) dashed var(--site-line);
}
.sg__block { display: flex; flex-direction: column; gap: var(--spacing-sm); }
</style>

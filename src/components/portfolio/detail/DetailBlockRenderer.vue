<script setup lang="ts">
import { computed } from "vue"
import { useLightbox } from "../../../composables/useLightbox"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual, renderMd } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import Viewer3dBlock from "../Viewer3dBlock.vue"
import CompareSlider from "./CompareSlider.vue"
import BlockCarousel from "./BlockCarousel.vue"
import BlockAccordion from "./BlockAccordion.vue"
import BlockHeading from "./BlockHeading.vue"
import BlockQuote from "./BlockQuote.vue"
import BlockButton from "./BlockButton.vue"
import BlockEmbed from "./BlockEmbed.vue"
import BlockSpecs from "./BlockSpecs.vue"
import BlockCounters from "./BlockCounters.vue"
import BlockMarquee from "./BlockMarquee.vue"
import BlockEmpty from "./BlockEmpty.vue"
import type {
  AccordionBlockContent, ButtonBlockContent, CarouselBlockContent, CompareBlockContent,
  CountersBlockContent, DetailBlock, EmbedBlockContent, HeadingBlockContent, ImageBlockContent,
  MarqueeBlockContent, QuoteBlockContent, SpecsBlockContent, TextBlockContent, VideoBlockContent,
  Viewer3dBlockContent,
} from "../../../types/portfolio"

//ONE BLOCK, whatever its type, for the public grid, the editor canvas and the
//styleguide. The editor wraps it in a pointer-events:none tile, so the
//interactive blocks render there as still previews.

const props = defineProps<{
  block:   DetailBlock
  lang:    Lang
  mobile?: boolean
}>()

const { t } = useTranslations()
const lightbox = useLightbox()
const reducedMotion = useReducedMotion()

const c = computed(() => props.block.content)
const asText    = computed(() => c.value as TextBlockContent)
const asImage   = computed(() => c.value as ImageBlockContent)
const asVideo   = computed(() => c.value as VideoBlockContent)
const imageAlt  = computed(() => pickBilingual(asImage.value.alt, props.lang))
//a visitor who limits motion gets a still frame and the controls to start it
const autoplay  = computed(() => asVideo.value.autoplay && !reducedMotion.value)
const controls  = computed(() => asVideo.value.controls || (asVideo.value.autoplay && reducedMotion.value))

function enlarge() {
  if (asImage.value.url) lightbox.open([{ url: asImage.value.url, alt: imageAlt.value }])
}
</script>

<template>
  <div v-if="block.type === 'text'" class="block-text" :lang="lang" v-html="renderMd(pickBilingual(asText.text, lang))"></div>

  <BlockHeading v-else-if="block.type === 'heading'" :content="(c as HeadingBlockContent)" :lang="lang" />

  <BlockQuote v-else-if="block.type === 'quote'" :content="(c as QuoteBlockContent)" :lang="lang" />

  <template v-else-if="block.type === 'image'">
    <button
      v-if="asImage.url"
      type="button"
      class="block-media block-media--zoom"
      :aria-label="t('blockImageEnlarge')"
      @click="enlarge"
    >
      <img
        :src="asImage.url"
        :alt="imageAlt"
        loading="lazy"
        decoding="async"
        class="block-media__el"
        :style="{ objectFit: asImage.fit ?? 'cover' }"
      />
    </button>
    <BlockEmpty v-else :type="block.type" />
  </template>

  <template v-else-if="block.type === 'video'">
    <video
      v-if="asVideo.url"
      :key="`${asVideo.url}-${autoplay}`"
      :src="asVideo.url"
      class="block-media__el"
      :autoplay="autoplay"
      :loop="asVideo.loop"
      :muted="asVideo.muted || autoplay"
      :controls="controls"
      preload="metadata"
      playsinline
    ></video>
    <BlockEmpty v-else :type="block.type" />
  </template>

  <BlockCarousel v-else-if="block.type === 'carousel'" :content="(c as CarouselBlockContent)" :lang="lang" />

  <BlockMarquee v-else-if="block.type === 'marquee'" :content="(c as MarqueeBlockContent)" />

  <CompareSlider v-else-if="block.type === 'compare'" :content="(c as CompareBlockContent)" :lang="lang" />

  <BlockAccordion v-else-if="block.type === 'accordion'" :content="(c as AccordionBlockContent)" :lang="lang" />

  <BlockSpecs v-else-if="block.type === 'specs'" :content="(c as SpecsBlockContent)" :lang="lang" />

  <BlockCounters v-else-if="block.type === 'counters'" :content="(c as CountersBlockContent)" :lang="lang" />

  <BlockButton v-else-if="block.type === 'button'" :content="(c as ButtonBlockContent)" :lang="lang" />

  <BlockEmbed v-else-if="block.type === 'embed'" :content="(c as EmbedBlockContent)" />

  <div v-else-if="block.type === 'viewer3d'" class="block-viewer">
    <Viewer3dBlock :content="(c as Viewer3dBlockContent)" :mobile="mobile" />
  </div>
</template>

<style scoped>
/*TEXT - the case-study prose: near-white headings, body at 70%*/
.block-text {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: var(--spacing-lg) var(--spacing-md);
  font-size: var(--site-fs-body);
  line-height: var(--site-lh-body);
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.block-text :deep(> :first-child) { margin-top: 0; }
.block-text :deep(> :last-child)  { margin-bottom: 0; }
.block-text :deep(p),
.block-text :deep(ul),
.block-text :deep(ol) { margin: 0 0 var(--spacing-md); }
.block-text :deep(ul),
.block-text :deep(ol) { padding-left: var(--spacing-lg); }
.block-text :deep(ul) { list-style: square; }
.block-text :deep(ol) { list-style: decimal; }
.block-text :deep(li + li) { margin-top: var(--spacing-xxs); }
.block-text :deep(h1),
.block-text :deep(h2),
.block-text :deep(h3) {
  margin: var(--spacing-lg) 0 var(--spacing-sm);
  font-size: var(--site-fs-h3);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--color-text-hover);
}
.block-text :deep(h3) { font-size: var(--site-fs-small); letter-spacing: var(--site-tracking-label); }
.block-text :deep(strong) { color: var(--color-text-hover); font-weight: var(--font-weight-bold); }
.block-text :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: var(--vsui-space-2xs);
}
.block-text :deep(code) {
  font-size: var(--site-fs-small);
  padding: 0 var(--vsui-space-xs);
  background-color: var(--tag-bg);
}
.block-text :deep(blockquote) {
  margin: 0 0 var(--spacing-md);
  padding-left: var(--spacing-md);
  border-left: var(--border-width) solid var(--color-accent);
  color: var(--color-text-hover);
}

/*IMAGE AND VIDEO fill their cell; the cell sets the box, so nothing shifts
while they load*/
.block-media {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
}
.block-media--zoom { cursor: zoom-in; }
.block-media--zoom:focus-visible {
  outline: var(--border-width-md) solid hsl(var(--ring));
  outline-offset: calc(-1 * var(--border-width-md));
}
.block-media__el {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: var(--color-background-gray-50);
}

.block-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

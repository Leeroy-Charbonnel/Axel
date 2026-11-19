<script setup lang="ts">
import { computed } from "vue"
import { useEditor } from "../../../composables/useEditor"
import { useLightbox } from "../../../composables/useLightbox"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual, renderMd } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import { blockSizes } from "../../../lib/media"
import SiteImage from "../../SiteImage.vue"
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
import BlockText from "./BlockText.vue"
import BlockLegend from "./BlockLegend.vue"
import BlockSequence from "./BlockSequence.vue"
import BlockMaterials from "./BlockMaterials.vue"
import type {
  AccordionBlockContent, ButtonBlockContent, CarouselBlockContent, CompareBlockContent,
  CountersBlockContent, DetailBlock, EmbedBlockContent, HeadingBlockContent, ImageBlockContent,
  LegendBlockContent, MarqueeBlockContent, MaterialsBlockContent, QuoteBlockContent, SequenceBlockContent,
  SpecsBlockContent, TextBlockContent, VideoBlockContent, Viewer3dBlockContent,
} from "../../../types/portfolio"

//ONE BLOCK, whatever its type, for the public grid, the editor canvas and the
//styleguide. The editor wraps it in a pointer-events:none tile, so the
//interactive blocks render there as still previews; only their texts take the
//pointer, to be typed in place.

const props = defineProps<{
  block:   DetailBlock
  lang:    Lang
  //The page's desktop column count
  cols:    number
  mobile?: boolean
}>()

const { t } = useTranslations()
const lightbox = useLightbox()
const reducedMotion = useReducedMotion()
const { editMode: editing } = useEditor()

const c = computed(() => props.block.content)
const sizes = computed(() => blockSizes(props.block.w, props.cols))
const asText    = computed(() => c.value as TextBlockContent)
const asImage   = computed(() => c.value as ImageBlockContent)
const asVideo   = computed(() => c.value as VideoBlockContent)
const imageAlt  = computed(() => pickBilingual(asImage.value.alt, props.lang))
//A visitor who limits motion gets a still frame and the controls to start it
const autoplay  = computed(() => asVideo.value.autoplay && !reducedMotion.value)
const controls  = computed(() => asVideo.value.controls || (asVideo.value.autoplay && reducedMotion.value))

function enlarge() {
  if (asImage.value.url) lightbox.open([{ url: asImage.value.url, alt: imageAlt.value }])
}
</script>

<template>
  <BlockText
    v-if="block.type === 'text' && editing"
    tag="div"
    class="block-text md-content"
    multiline
    :lang="lang"
    :value="asText.text"
    :label="t('blockTypeText')"
    @write="(v) => (asText.text = v)"
  />

  <div v-else-if="block.type === 'text'" class="block-text md-content" :lang="lang" v-html="renderMd(pickBilingual(asText.text, lang))"></div>

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
      <SiteImage
        :src="asImage.url"
        :alt="imageAlt"
        :sizes="sizes"
        :class="['block-media__el', { 'block-media__el--whole': asImage.fit === 'contain' }]"
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

  <BlockCarousel v-else-if="block.type === 'carousel'" :content="(c as CarouselBlockContent)" :lang="lang" :sizes="sizes" />

  <BlockMarquee v-else-if="block.type === 'marquee'" :content="(c as MarqueeBlockContent)" :sizes="blockSizes(1, cols)" />

  <CompareSlider v-else-if="block.type === 'compare'" :content="(c as CompareBlockContent)" :lang="lang" :sizes="sizes" />

  <BlockAccordion v-else-if="block.type === 'accordion'" :content="(c as AccordionBlockContent)" :lang="lang" />

  <BlockSpecs v-else-if="block.type === 'specs'" :content="(c as SpecsBlockContent)" :lang="lang" />

  <BlockCounters v-else-if="block.type === 'counters'" :content="(c as CountersBlockContent)" :lang="lang" />

  <BlockButton v-else-if="block.type === 'button'" :content="(c as ButtonBlockContent)" :lang="lang" />

  <BlockEmbed v-else-if="block.type === 'embed'" :content="(c as EmbedBlockContent)" />

  <BlockLegend v-else-if="block.type === 'legend'" :content="(c as LegendBlockContent)" :lang="lang" />

  <!--each image of a sequence is narrower than one column-->
  <BlockSequence v-else-if="block.type === 'sequence'" :content="(c as SequenceBlockContent)" :lang="lang" :sizes="blockSizes(1, cols)" />

  <BlockMaterials v-else-if="block.type === 'materials'" :content="(c as MaterialsBlockContent)" :lang="lang" />

  <div v-else-if="block.type === 'viewer3d'" class="block-viewer">
    <Viewer3dBlock :content="(c as Viewer3dBlockContent)" :mobile="mobile" :sizes="sizes" />
  </div>
</template>

<style scoped>
/*TEXT - the prose styles are the shared .md-content; centred in its cell, so
a short text beside an image reads against it rather than above a gap*/
.block-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: var(--spacing-lg) var(--spacing-md);
  font-size: var(--site-fs-body);
  line-height: var(--site-lh-body);
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
/*shown whole: no box around the margins or behind a transparent drawing*/
.block-media__el--whole { background: none; }

.block-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

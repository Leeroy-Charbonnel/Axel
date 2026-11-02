<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import SiteImage from "../../SiteImage.vue"
import BlockEmpty from "./BlockEmpty.vue"
import type { MarqueeBlockContent } from "../../../types/portfolio"

//MARQUEE - an image strip that scrolls on its own, drawn twice and moved by
//one strip width so the loop has no seam. The pace is the configured speed in
//px per second over the measured strip. It stops on hover; for a reader who
//limits motion it stands still and scrolls by hand instead.

const props = defineProps<{ content: MarqueeBlockContent; sizes: string }>()
const reducedMotion = useReducedMotion()

const MIN_SPEED = 10

const items   = computed(() => props.content.items.filter((i) => i.url))
const strip   = ref<HTMLElement | null>(null)
const stripPx = ref(0)
const durationS = computed(() => stripPx.value / Math.max(MIN_SPEED, props.content.speedPxs))

let observer: ResizeObserver | null = null
onMounted(() => {
  if (!strip.value) return
  observer = new ResizeObserver(([entry]) => { stripPx.value = entry?.contentRect.width ?? 0 })
  observer.observe(strip.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    v-if="items.length"
    class="bmarquee"
    :class="{ 'bmarquee--still': reducedMotion }"
    :style="{ '--marquee-duration': `${durationS}s` }"
  >
    <div class="bmarquee__track">
      <div ref="strip" class="bmarquee__strip">
        <SiteImage
          v-for="(item, i) in items"
          :key="`${item.fileId}-${i}`"
          :src="item.url!"
          :sizes="sizes"
          class="bmarquee__img"
          draggable="false"
        />
      </div>
      <div v-if="!reducedMotion" class="bmarquee__strip" aria-hidden="true">
        <SiteImage
          v-for="(item, i) in items"
          :key="`copy-${item.fileId}-${i}`"
          :src="item.url!"
          :sizes="sizes"
          class="bmarquee__img"
          draggable="false"
        />
      </div>
    </div>
  </div>
  <BlockEmpty v-else type="marquee" />
</template>

<style scoped>
.bmarquee {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.bmarquee__track {
  display: flex;
  width: max-content;
  height: 100%;
  animation: bmarquee-scroll var(--marquee-duration) linear infinite;
}
.bmarquee:hover .bmarquee__track { animation-play-state: paused; }
.bmarquee--still { overflow-x: auto; }
.bmarquee--still .bmarquee__track { animation: none; }
.bmarquee__strip {
  display: flex;
  height: 100%;
  gap: var(--detail-gap);
  padding-right: var(--detail-gap);
}
.bmarquee__img {
  display: block;
  height: 100%;
  width: auto;
  object-fit: cover;
  user-select: none;
}
@keyframes bmarquee-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
</style>

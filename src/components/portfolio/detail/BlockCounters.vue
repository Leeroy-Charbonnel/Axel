<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import BlockEmpty from "./BlockEmpty.vue"
import type { CountersBlockContent } from "../../../types/portfolio"

//COUNTERS - the full numbers, written in the reader's language. They count up
//once when the block first comes into view; the final values are on screen
//from the start, so nothing is lost if the observer never fires, and a reader
//who limits motion never sees them move.

const props = defineProps<{ content: CountersBlockContent; lang: Lang }>()
const { t } = useTranslations()
const reducedMotion = useReducedMotion()

const COUNT_MS = 1400
const root = ref<HTMLElement | null>(null)
const progress = ref(1)
const format = computed(() => new Intl.NumberFormat(props.lang))

let observer: IntersectionObserver | null = null
let raf = 0

function run() {
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / COUNT_MS)
    progress.value = 1 - Math.pow(1 - p, 3)
    if (p < 1) raf = requestAnimationFrame(tick)
  }
  progress.value = 0
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  const el = root.value
  if (!el || reducedMotion.value) return
  const box = el.getBoundingClientRect()
  //already on screen at load: no count-up, the numbers simply stay
  if (box.top < window.innerHeight && box.bottom > 0) return
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return
    observer?.disconnect()
    observer = null
    run()
  })
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div v-if="content.items.length" ref="root" class="bcounters" :lang="lang">
    <div v-for="(item, i) in content.items" :key="i" class="bcounters__item">
      <span class="bcounters__value">{{ format.format(Math.round(item.value * progress)) }}</span>
      <span class="bcounters__label">{{ pickBilingual(item.label, lang) }}</span>
    </div>
  </div>
  <BlockEmpty v-else type="counters" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.bcounters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--detail-counter-min), 1fr));
  align-content: center;
  gap: var(--spacing-md);
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  overflow: auto;
}
.bcounters__item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-top: var(--spacing-sm);
  border-top: var(--border-width) solid hsl(var(--border-color));
}
.bcounters__value {
  font-size: var(--site-fs-h1);
  line-height: var(--site-lh-tight);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-hover);
}
.bcounters__label {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--color-text-tertiary);
}
</style>

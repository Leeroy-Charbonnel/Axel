<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { ChevronLeft, ChevronRight } from "lucide-vue-next"
import { useEditor } from "../../../composables/useEditor"
import { useReducedMotion } from "../../../composables/useReducedMotion"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import SiteImage from "../../SiteImage.vue"
import BlockEmpty from "./BlockEmpty.vue"
import BlockText from "./BlockText.vue"
import type { CarouselBlockContent } from "../../../types/portfolio"

//CAROUSEL - slides on a translated track, arrows, dots, left / right keys when
//focused, and a swipe on touch. Auto-advance pauses on hover and focus and is
//off for a reader who limits motion.

const props = defineProps<{ content: CarouselBlockContent; lang: Lang; sizes: string }>()
const { t } = useTranslations()
const reducedMotion = useReducedMotion()
const { editMode: editing } = useEditor()

const SWIPE_PX = 40

const index   = ref(0)
const hovered = ref(false)
const focused = ref(false)
//A caption being typed keeps its slide, wherever the pointer goes
const paused  = computed(() => hovered.value || focused.value)
const items  = computed(() => props.content.items.filter((i) => i.url))
const count  = computed(() => items.value.length)
const current = computed(() => items.value[index.value] ?? null)

watch(count, (n) => { if (index.value >= n) index.value = Math.max(0, n - 1) })

function goTo(i: number) {
  if (!count.value) return
  index.value = (i + count.value) % count.value
}

let timer: ReturnType<typeof setInterval> | null = null
function restartTimer() {
  if (timer) clearInterval(timer)
  timer = null
  const ms = props.content.intervalMs
  if (ms > 0 && count.value > 1 && !paused.value && !reducedMotion.value) {
    timer = setInterval(() => goTo(index.value + 1), ms)
  }
}
watch([() => props.content.intervalMs, count, paused, reducedMotion, index], restartTimer, { immediate: true })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

//In edit mode the arrows move the caret in the caption
function onKeydown(e: KeyboardEvent) {
  if (editing.value) return
  if (e.key === "ArrowLeft")  { e.preventDefault(); goTo(index.value - 1) }
  if (e.key === "ArrowRight") { e.preventDefault(); goTo(index.value + 1) }
}

let swipeX: number | null = null
function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== "mouse") swipeX = e.clientX
}
function onPointerUp(e: PointerEvent) {
  if (swipeX === null) return
  const dx = e.clientX - swipeX
  swipeX = null
  if (Math.abs(dx) >= SWIPE_PX) goTo(index.value + (dx < 0 ? 1 : -1))
}
</script>

<template>
  <div
    v-if="count"
    class="bcarousel"
    :class="{ 'bcarousel--still': reducedMotion }"
    role="region"
    aria-roledescription="carousel"
    :aria-label="t('blockCarouselLabel')"
    tabindex="0"
    :lang="lang"
    @keydown="onKeydown"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="focused = false"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <div class="bcarousel__track" :style="{ transform: `translateX(-${index * 100}%)` }">
      <figure
        v-for="(item, i) in items"
        :key="`${item.fileId}-${i}`"
        class="bcarousel__slide"
        role="group"
        aria-roledescription="slide"
        :aria-label="t('blockSlideOf').replace('{n}', String(i + 1)).replace('{total}', String(count))"
        :aria-hidden="i !== index"
        :inert="i !== index"
      >
        <SiteImage
          :src="item.url!"
          :alt="pickBilingual(item.caption, lang)"
          :sizes="sizes"
          :loading="i === 0 ? 'eager' : 'lazy'"
          class="bcarousel__img"
          draggable="false"
        />
      </figure>
    </div>

    <template v-if="count > 1">
      <button type="button" class="bcarousel__arrow bcarousel__arrow--prev" :aria-label="t('blockCarouselPrev')" @click="goTo(index - 1)">
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <button type="button" class="bcarousel__arrow bcarousel__arrow--next" :aria-label="t('blockCarouselNext')" @click="goTo(index + 1)">
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </template>

    <div class="bcarousel__bar">
      <p class="bcarousel__caption" aria-live="polite">
        <span class="bcarousel__count">{{ String(index + 1).padStart(2, "0") }} / {{ String(count).padStart(2, "0") }}</span>
        <BlockText
          v-if="current"
          optional
          :value="current.caption ?? { fr: '', en: '' }"
          :label="t('fieldCaption')"
          @write="(v) => (current!.caption = v)"
        />
      </p>
      <div v-if="count > 1" class="bcarousel__dots">
        <button
          v-for="(item, i) in items"
          :key="`dot-${item.fileId}-${i}`"
          type="button"
          class="bcarousel__dot"
          :aria-label="t('blockCarouselGoTo').replace('{n}', String(i + 1))"
          :aria-current="i === index"
          @click="goTo(i)"
        ><span class="bcarousel__dot-mark"></span></button>
      </div>
    </div>
  </div>
  <BlockEmpty v-else type="carousel" />
</template>

<style scoped>
.bcarousel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: pan-y;
}
.bcarousel:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: calc(-1 * var(--border-width-md)); }
.bcarousel__track {
  display: flex;
  height: 100%;
  transition: transform var(--site-reveal-duration) var(--site-ease);
}
.bcarousel--still .bcarousel__track { transition: none; }
.bcarousel__slide {
  flex: 0 0 100%;
  height: 100%;
  margin: 0;
}
.bcarousel__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: var(--color-background-gray-50);
}
.bcarousel__arrow {
  position: absolute;
  top: 50%;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  transform: translateY(-50%);
  color: var(--site-text-heading);
  background-color: var(--overlay-bg);
  border: var(--border-width) solid var(--site-line);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease, color var(--transition-fast) ease;
}
.bcarousel__arrow:hover { border-color: var(--site-accent); color: var(--site-accent); }
.bcarousel__arrow:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); }
.bcarousel__arrow--prev { left: var(--spacing-sm); }
.bcarousel__arrow--next { right: var(--spacing-sm); }
.bcarousel__bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-sm);
  background: linear-gradient(to top, var(--overlay-bg), transparent);
}
.bcarousel__caption {
  display: flex;
  gap: var(--spacing-sm);
  min-width: 0;
  margin: 0;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-body);
}
.bcarousel__count { color: var(--site-text-heading); font-variant-numeric: tabular-nums; }
.bcarousel__dots { display: flex; flex-shrink: 0; }
.bcarousel__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}
.bcarousel__dot:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: calc(-1 * var(--border-width-md)); }
.bcarousel__dot-mark {
  width: var(--detail-dot);
  height: var(--detail-dot);
  background-color: var(--site-text-caption);
  transition: background-color var(--transition-fast) ease;
}
.bcarousel__dot[aria-current="true"] .bcarousel__dot-mark { background-color: var(--site-accent); }
</style>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { ChevronLeft, ChevronRight, X } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { useLightbox } from "../../composables/useLightbox"

//LIGHTBOX - one instance in App.vue, opened by useLightbox().open(items, i).
//A modal <dialog>: the page behind is inert, focus stays inside, Escape
//(the cancel event) closes, and focus returns to the control that opened it.
//
//Infinite belt: the track holds [clone(last), ...items, clone(first)]. Going
//past an edge slides into the clone, then jumps (transition off) to the real
//slide at the same visual position, so it never rewinds.
const { items, index, isOpen, close, goTo } = useLightbox()
const { t } = useLanguage()

const dialog = ref<HTMLDialogElement | null>(null)

const firstCloneUrl = computed(() => items.value[0]?.url ?? "")
const lastCloneUrl  = computed(() => items.value[items.value.length - 1]?.url ?? "")
const caption       = computed(() => items.value[index.value]?.alt ?? "")

//displayed offset in the extended track; briefly -1 or items.length on a wrap
const position           = ref(0)
const transitionEnabled  = ref(true)
const trackOffsetPercent = computed(() => -((position.value + 1) * 100))

//SWIPE - the same pointer events for touch and mouse
const dragStartX = ref<number | null>(null)
const dragDX     = ref(0)
const SWIPE_THRESHOLD_PX = 60
//the click that follows a drag must not close the lightbox
const DRAG_CLICK_GUARD_PX = 5
let dragClickGuard = false

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragStartX.value = e.clientX
  dragDX.value = 0
  dragClickGuard = false
}

function onPointerMove(e: PointerEvent) {
  if (dragStartX.value === null) return
  dragDX.value = e.clientX - dragStartX.value
}

function onPointerUp(e: PointerEvent) {
  if (dragStartX.value === null) return
  const dx = e.clientX - dragStartX.value
  dragStartX.value = null
  dragClickGuard = Math.abs(dx) > DRAG_CLICK_GUARD_PX
  if (dx >  SWIPE_THRESHOLD_PX) prev()
  if (dx < -SWIPE_THRESHOLD_PX) next()
  dragDX.value = 0
}

//a click on a slide outside its image closes
function onSlideClick() {
  if (dragClickGuard) {
    dragClickGuard = false
    return
  }
  close()
}

function next() {
  if (items.value.length > 1) position.value++
}

function prev() {
  if (items.value.length > 1) position.value--
}

watch(position, (p) => {
  const n = items.value.length
  if (n > 0 && p >= 0 && p < n) index.value = p
})

//a dot jumps straight to its slide
watch(index, (i) => {
  const n = items.value.length
  if (n > 0 && i !== ((position.value % n) + n) % n) {
    transitionEnabled.value = true
    position.value = i
  }
})

async function snapWithoutTransition(p: number) {
  transitionEnabled.value = false
  position.value = p
  await nextTick()
  requestAnimationFrame(() => { transitionEnabled.value = true })
}

function onTrackTransitionEnd() {
  const n = items.value.length
  if (n === 0) return
  if (position.value >= n) void snapWithoutTransition(position.value - n)
  else if (position.value < 0) void snapWithoutTransition(position.value + n)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowRight") { e.preventDefault(); next() }
  if (e.key === "ArrowLeft")  { e.preventDefault(); prev() }
}

//opened after the slides render, so focus lands on the close button
watch(isOpen, async (open) => {
  const el = dialog.value
  if (!el) return
  document.documentElement.style.overflow = open ? "hidden" : ""
  if (open && !el.open) {
    void snapWithoutTransition(index.value)
    await nextTick()
    el.showModal()
  } else if (!open && el.open) {
    el.close()
  }
})
</script>

<template>
  <dialog
    ref="dialog"
    class="lightbox"
    :aria-label="t('lightboxLabel')"
    @cancel.prevent="close"
    @keydown="onKeydown"
  >
    <template v-if="isOpen">
      <div
        class="lightbox__track"
        :class="{ 'lightbox__track--no-transition': !transitionEnabled || dragStartX !== null }"
        :style="{ transform: `translateX(calc(${trackOffsetPercent}% + ${dragDX}px))` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @transitionend.self="onTrackTransitionEnd"
      >
        <div class="lightbox__slide" aria-hidden="true" @click.self="onSlideClick">
          <img v-if="lastCloneUrl" :src="lastCloneUrl" alt="" draggable="false" class="lightbox__image" />
        </div>
        <div
          v-for="(it, i) in items"
          :key="i"
          class="lightbox__slide"
          :aria-hidden="i !== index"
          @click.self="onSlideClick"
        >
          <img :src="it.url" :alt="it.alt ?? ''" draggable="false" class="lightbox__image" />
        </div>
        <div class="lightbox__slide" aria-hidden="true" @click.self="onSlideClick">
          <img v-if="firstCloneUrl" :src="firstCloneUrl" alt="" draggable="false" class="lightbox__image" />
        </div>
      </div>

      <button type="button" class="lightbox__button lightbox__close" :aria-label="t('lightboxClose')" @click="close">
        <X aria-hidden="true" />
      </button>

      <div class="lightbox__bar">
        <button
          v-if="items.length > 1"
          type="button"
          class="lightbox__button"
          :aria-label="t('lightboxPrevious')"
          @click="prev"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <p class="lightbox__caption" aria-live="polite">
          <span v-if="items.length > 1" class="lightbox__count">{{ index + 1 }} / {{ items.length }}</span>
          <span v-if="caption">{{ caption }}</span>
        </p>
        <button
          v-if="items.length > 1"
          type="button"
          class="lightbox__button"
          :aria-label="t('lightboxNext')"
          @click="next"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div v-if="items.length > 1" class="lightbox__dots">
        <button
          v-for="(_, i) in items"
          :key="i"
          type="button"
          class="lightbox__dot"
          :aria-label="`${i + 1} / ${items.length}`"
          :aria-current="i === index ? 'true' : undefined"
          @click="goTo(i)"
        ></button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.lightbox {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  border: none;
  overflow: hidden;
  background-color: var(--site-scrim);
  color: var(--site-text-heading);
  user-select: none;
}

.lightbox[open] { animation: lightbox-in var(--site-duration-fast) ease; }
.lightbox::backdrop { background-color: transparent; }

@keyframes lightbox-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.lightbox__track {
  display: flex;
  width: 100%;
  height: 100%;
  transition: transform var(--transition-slow) var(--site-ease);
  touch-action: pan-y;
  cursor: grab;
}

.lightbox__track:active { cursor: grabbing; }
.lightbox__track--no-transition { transition: none; }

.lightbox__slide {
  display: flex;
  flex: 0 0 100%;
  align-items: center;
  justify-content: center;
  padding: var(--site-topbar-height) var(--site-gutter) calc(var(--site-topbar-height) + var(--spacing-xl));
}

.lightbox__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.lightbox__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  border: var(--border-width-sm) solid var(--site-line-strong);
  background-color: var(--overlay-bg);
  color: var(--site-text-heading);
  transition: border-color var(--site-duration-fast) ease, color var(--site-duration-fast) ease;
}

.lightbox__button:hover {
  border-color: var(--site-accent);
  color: var(--site-accent);
}

.lightbox__button svg {
  width: var(--site-icon);
  height: var(--site-icon);
}

.lightbox__close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--site-gutter);
}

.lightbox__bar {
  position: absolute;
  left: var(--site-gutter);
  right: var(--site-gutter);
  bottom: var(--spacing-xl);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  pointer-events: none;
}

.lightbox__bar > * { pointer-events: auto; }

.lightbox__caption {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-xxs) var(--spacing-sm);
  min-width: 0;
  font-size: var(--site-fs-small);
  text-align: center;
  color: var(--site-text-body);
}

.lightbox__count {
  font-variant-numeric: tabular-nums;
  color: var(--site-text-caption);
}

.lightbox__dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--spacing-xxs);
  display: flex;
  justify-content: center;
}

/*a 24px hit area around an 8px square*/
.lightbox__dot {
  display: grid;
  place-content: center;
  width: var(--spacing-lg);
  height: var(--spacing-lg);
  padding: 0;
}

.lightbox__dot::before {
  content: "";
  width: var(--site-dot);
  height: var(--site-dot);
  border: var(--border-width-sm) solid var(--site-text-heading);
}

.lightbox__dot[aria-current="true"]::before { background-color: var(--site-text-heading); }
</style>

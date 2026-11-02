<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import { MoveHorizontal } from "lucide-vue-next"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import BlockEmpty from "./BlockEmpty.vue"
import type { CompareBlockContent } from "../../../types/portfolio"

//BEFORE / AFTER - the "after" image underneath, the "before" one clipped to
//the left of the divider so both stay aligned whatever the crop. The divider
//moves while the pointer is held (touch included), or follows the mouse when
//the block asks for it. Its handle is a slider: arrows step, Page keys jump,
//Home / End go to the edges.

const props = defineProps<{ content: CompareBlockContent; lang: Lang }>()
const { t } = useTranslations()

const STEP = 0.05
const JUMP = 0.25

const rootRef  = ref<HTMLDivElement | null>(null)
const position = ref(0.5)
const percent  = computed(() => Math.round(position.value * 100))

const beforeLabel = computed(() => pickBilingual(props.content.beforeLabel, props.lang))
const afterLabel  = computed(() => pickBilingual(props.content.afterLabel, props.lang))
const ready       = computed(() => Boolean(props.content.beforeUrl && props.content.afterUrl))

function clamp(v: number) {
  return Math.min(1, Math.max(0, v))
}

function fromPointer(e: PointerEvent) {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect?.width) return
  position.value = clamp((e.clientX - rect.left) / rect.width)
}

function onPointerDown(e: PointerEvent) {
  fromPointer(e)
  document.addEventListener("pointermove", fromPointer)
  document.addEventListener("pointerup", stopDrag)
  document.addEventListener("pointercancel", stopDrag)
}
function stopDrag() {
  document.removeEventListener("pointermove", fromPointer)
  document.removeEventListener("pointerup", stopDrag)
  document.removeEventListener("pointercancel", stopDrag)
}
function onHover(e: PointerEvent) {
  if (props.content.followMouse && e.pointerType === "mouse") fromPointer(e)
}

function onKeydown(e: KeyboardEvent) {
  const moves: Record<string, number> = {
    ArrowLeft: position.value - STEP, ArrowDown: position.value - STEP,
    ArrowRight: position.value + STEP, ArrowUp: position.value + STEP,
    PageDown: position.value - JUMP, PageUp: position.value + JUMP,
    Home: 0, End: 1,
  }
  const to = moves[e.key]
  if (to === undefined) return
  e.preventDefault()
  position.value = clamp(to)
}

onBeforeUnmount(stopDrag)
</script>

<template>
  <div
    v-if="ready"
    ref="rootRef"
    class="bcompare"
    :lang="lang"
    @pointerdown="onPointerDown"
    @pointermove="onHover"
  >
    <img :src="content.afterUrl!" :alt="afterLabel" loading="lazy" decoding="async" class="bcompare__img" draggable="false" />
    <img
      :src="content.beforeUrl!"
      :alt="beforeLabel"
      loading="lazy"
      decoding="async"
      class="bcompare__img bcompare__img--before"
      :style="{ clipPath: `inset(0 ${100 - position * 100}% 0 0)` }"
      draggable="false"
    />
    <div
      class="bcompare__divider"
      :style="{ left: `${position * 100}%` }"
      role="slider"
      tabindex="0"
      :aria-label="t('blockCompareSlider')"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      :aria-valuetext="`${beforeLabel} ${percent} %, ${afterLabel} ${100 - percent} %`"
      @keydown="onKeydown"
    >
      <span class="bcompare__handle"><MoveHorizontal :size="16" aria-hidden="true" /></span>
    </div>
    <span v-if="beforeLabel" class="bcompare__label bcompare__label--before">{{ beforeLabel }}</span>
    <span v-if="afterLabel" class="bcompare__label bcompare__label--after">{{ afterLabel }}</span>
  </div>
  <BlockEmpty v-else type="compare" />
</template>

<style scoped>
.bcompare {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: ew-resize;
  touch-action: pan-y;
  user-select: none;
}
.bcompare__img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.bcompare__img--before { z-index: 3; }
.bcompare__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: var(--border-width);
  background-color: var(--site-text-heading);
  transform: translateX(-50%);
}
.bcompare__divider:focus-visible { outline: none; }
.bcompare__handle {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  transform: translate(-50%, -50%);
  color: var(--site-text-heading);
  background-color: var(--overlay-bg);
  border: var(--border-width) solid var(--site-text-heading);
  border-radius: var(--border-radius-full);
}
.bcompare__divider:focus-visible .bcompare__handle {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 var(--border-width-md) hsl(var(--ring));
}
.bcompare__label {
  position: absolute;
  bottom: var(--spacing-sm);
  z-index: 4;
  padding: var(--spacing-xxs) var(--spacing-xs);
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-heading);
  background-color: var(--overlay-bg);
  pointer-events: none;
}
.bcompare__label--before { left: var(--spacing-sm); }
.bcompare__label--after  { right: var(--spacing-sm); }
</style>

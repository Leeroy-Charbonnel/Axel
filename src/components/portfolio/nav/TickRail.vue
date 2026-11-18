<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useSectionNav } from "../../../composables/useSectionNav"

//Page sections as ticks; a hover, the focus or a first tap shows the labels
const { sections, activeId, go } = useSectionNav()

//Hover time before the labels open
const OPEN_DELAY_MS = 200

const panel = ref<HTMLElement | null>(null)
//Opened by a hover or a tap
const open = ref(false)
//Closed by Escape until the focus leaves the panel
const dismissed = ref(false)
const current = computed(() => sections.value.findIndex((s) => s.id === activeId.value))

let openTimer = 0
function cancelOpen() {
  window.clearTimeout(openTimer)
  openTimer = 0
}

function show() {
  cancelOpen()
  open.value = true
  dismissed.value = false
}

function hide() {
  cancelOpen()
  open.value = false
}

function dismiss() {
  hide()
  dismissed.value = true
}

function enter(e: PointerEvent) {
  if (e.pointerType === "mouse") openTimer = window.setTimeout(show, OPEN_DELAY_MS)
}

function leave(e: PointerEvent) {
  if (e.pointerType !== "mouse") return
  hide()
  if (!panel.value?.contains(document.activeElement)) dismissed.value = false
}

function isShown(): boolean {
  return open.value || (!dismissed.value && !!panel.value?.querySelector(":focus-visible"))
}

//Safari gives a tap's click no touch type: it is read on pointerdown
let downPointer = ""
function notePointer(e: PointerEvent) {
  downPointer = e.pointerType
}

function pick(id: string) {
  const tapped = downPointer === "touch" || downPointer === "pen"
  downPointer = ""
  if (tapped && !isShown()) return show()
  hide()
  go(id)
}

function leaveFocus(e: FocusEvent) {
  if (!panel.value?.contains(e.relatedTarget as Node | null)) dismissed.value = false
}

//A tap elsewhere or Escape closes the labels
function closeOutside(e: PointerEvent) {
  if (!panel.value?.contains(e.target as Node)) hide()
}
function closeOnEscape(e: KeyboardEvent) {
  if (e.key === "Escape") dismiss()
}
function stopListening() {
  document.removeEventListener("pointerdown", closeOutside)
  document.removeEventListener("keydown", closeOnEscape)
}
watch(open, (isOpen) => {
  if (!isOpen) return stopListening()
  document.addEventListener("pointerdown", closeOutside)
  document.addEventListener("keydown", closeOnEscape)
})

//The current row stays in the middle of the panel
function centerCurrent() {
  const box = panel.value
  const row = box?.querySelector<HTMLElement>('[aria-current="true"]')
  if (!box || !row) return
  const rowTop = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  box.scrollTop = rowTop - (box.clientHeight - row.offsetHeight) / 2
}
watch([current, () => sections.value.length], centerCurrent, { flush: "post" })
onMounted(centerCurrent)

onBeforeUnmount(() => {
  cancelOpen()
  stopListening()
})
</script>

<template>
  <ol
    ref="panel"
    class="ticks"
    :class="{ 'ticks--open': open, 'ticks--dismissed': dismissed }"
    @pointerenter="enter"
    @pointerleave="leave"
    @pointerdown="notePointer"
    @keydown.esc="dismiss"
    @focusout="leaveFocus"
  >
    <li
      v-for="(section, i) in sections"
      :key="section.id"
      class="ticks__item"
      :class="{ 'ticks__item--past': i < current, 'ticks__item--current': i === current }"
    >
      <a
        :href="`#${section.id}`"
        class="site-rail-link ticks__link"
        :title="section.label"
        :aria-current="i === current ? 'true' : undefined"
        @click.prevent="pick(section.id)"
      >
        <span class="ticks__mark" aria-hidden="true"></span>
        <span class="ticks__label">{{ section.label }}</span>
      </a>
    </li>
  </ol>
</template>

<style scoped>
/*PANEL - always full width; closed, the clip shows only the tick strip*/
.ticks {
  --tick-col: var(--spacing-md);
  --tick-pad: var(--spacing-xxs);
  --tick-strip: calc(var(--border-width-sm) + 2 * var(--tick-pad) + var(--tick-col));
  margin-block: auto;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  padding: var(--spacing-xs) var(--spacing-md) var(--spacing-xs) var(--tick-pad);
  border: var(--border-width-sm) solid transparent;
  list-style: none;
  pointer-events: auto;
  clip-path: inset(0 calc(100% - var(--tick-strip)) 0 0);
  transition:
    clip-path var(--site-duration-fast) var(--site-ease),
    background-color var(--site-duration-fast) ease,
    border-color var(--site-duration-fast) ease;
}

.ticks:not(.ticks--dismissed):is(.ticks--open, :has(:focus-visible)) {
  clip-path: inset(0);
  border-color: var(--site-line);
  background-color: var(--site-scrim);
  backdrop-filter: blur(var(--filter-blur));
}

/*THE LINE - two halves per row, in the accent up to the current tick*/
.ticks__item {
  --line-above: var(--site-line);
  --line-below: var(--site-line);
}

.ticks__item:first-child { --line-above: transparent; }
.ticks__item:last-child { --line-below: transparent; }
.ticks__item--current { --line-above: var(--site-accent); }

.ticks__item--past {
  --line-above: var(--site-accent);
  --line-below: var(--site-accent);
}

.ticks__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--site-target-min);
  font-size: var(--site-fs-label);
  line-height: var(--site-lh-tight);
}

@media (pointer: coarse) {
  .ticks__link { min-height: var(--site-touch-target); }
}

/*The ring stays inside the clipped panel*/
.ticks__link:focus-visible { outline-offset: calc(-1 * var(--border-width-md)); }

/*TICK - short, full column width when current, over the line*/
.ticks__mark {
  display: flex;
  flex: none;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  width: var(--tick-col);
  background:
    linear-gradient(var(--line-above), var(--line-above)) center top / var(--border-width-sm) 50% no-repeat,
    linear-gradient(var(--line-below), var(--line-below)) center bottom / var(--border-width-sm) 50% no-repeat;
}

.ticks__mark::before {
  content: "";
  width: var(--spacing-xs);
  height: var(--border-width-sm);
  background-color: currentColor;
  transition: width var(--site-duration-fast) var(--site-ease);
}

.ticks__link[aria-current="true"] .ticks__mark::before {
  width: 100%;
  height: var(--border-width-md);
}

.ticks__label {
  max-width: var(--site-rail-label-width);
  padding-block: var(--spacing-xs);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>

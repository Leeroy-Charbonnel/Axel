<script setup lang="ts">
import { computed } from "vue"
import { useIsMobile } from "../../../composables/useIsMobile"
import { bottomOf, closeEmptyRows, layoutRects } from "../../../lib/bento-layout"
import type { Lang } from "../../../lib/lang"
import DetailBlockRenderer from "./DetailBlockRenderer.vue"
import BlockBorder from "./BlockBorder.vue"
import { FILL_TYPES } from "./block-types"
import type { DetailBlock } from "../../../types/portfolio"

//THE PUBLIC BLOCK GRID - three columns, or the phone stack once the grid
//itself is phone-narrow. A container query decides, not the window, so the
//styleguide frames and the editor preview render exactly what a phone shows.
//The page leaves out the blocks with nothing to show; the rows they held close up.
//A row is at least --detail-row-h high and grows with the text in it; media
//take the height of their cell and never push it.

const props = defineProps<{ blocks: DetailBlock[]; lang: Lang }>()
const { isMobile } = useIsMobile()

const desktop = computed(() => closeEmptyRows(layoutRects(props.blocks, "desktop")))
const phone   = computed(() => closeEmptyRows(layoutRects(props.blocks, "phone")))

function cellStyle(b: DetailBlock) {
  const d = desktop.value.get(b.id)!
  const p = phone.value.get(b.id)!
  return {
    "--d-col": d.x + 1, "--d-row": d.y + 1, "--d-w": d.w, "--d-h": d.h,
    "--p-row": p.y + 1, "--p-h": p.h,
  }
}
</script>

<template>
  <div class="detail-grid">
    <div
      class="detail-grid__inner"
      :style="{ '--d-rows': bottomOf(desktop.values()), '--p-rows': bottomOf(phone.values()) }"
    >
      <div
        v-for="b in blocks"
        :key="b.id"
        class="detail-grid__cell"
        :class="[`detail-grid__cell--${b.type}`, { 'detail-grid__cell--fill': FILL_TYPES.has(b.type) }]"
        :style="cellStyle(b)"
      >
        <DetailBlockRenderer :block="b" :lang="lang" :mobile="isMobile" />
        <BlockBorder :bstyle="b.style" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-grid {
  container: detail-grid / inline-size;
  width: 100%;
}
.detail-grid__inner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(var(--d-rows), minmax(var(--detail-row-h), auto));
  gap: var(--detail-gap);
}
.detail-grid__cell {
  position: relative;
  display: flex;
  min-width: 0;
  overflow: hidden;
  grid-column: var(--d-col) / span var(--d-w);
  grid-row: var(--d-row) / span var(--d-h);
}
/*sized as if empty: a large image never stretches its row*/
.detail-grid__cell--fill { contain: size; }
/*a phone-wide grid: 640px of window minus the two gutters*/
@container detail-grid (max-width: 590px) {
  .detail-grid__inner {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(var(--p-rows), minmax(var(--detail-row-h-phone), auto));
    gap: var(--detail-gap-phone);
  }
  .detail-grid__cell {
    grid-column: 1 / -1;
    grid-row: var(--p-row) / span var(--p-h);
  }
}
</style>

<script setup lang="ts">
import type { Component } from "vue"
import { Trash2 } from "lucide-vue-next"
import { useTranslations } from "../../../composables/useTranslations"
import { BLOCK_TYPES, blockType } from "./block-types"
import BlockStyleEditor from "./editors/BlockStyleEditor.vue"
import TextEditor      from "./editors/TextEditor.vue"
import HeadingEditor   from "./editors/HeadingEditor.vue"
import QuoteEditor     from "./editors/QuoteEditor.vue"
import ImageEditor     from "./editors/ImageEditor.vue"
import VideoEditor     from "./editors/VideoEditor.vue"
import CarouselEditor  from "./editors/CarouselEditor.vue"
import MarqueeEditor   from "./editors/MarqueeEditor.vue"
import CompareEditor   from "./editors/CompareEditor.vue"
import AccordionEditor from "./editors/AccordionEditor.vue"
import SpecsEditor     from "./editors/SpecsEditor.vue"
import CountersEditor  from "./editors/CountersEditor.vue"
import ButtonEditor    from "./editors/ButtonEditor.vue"
import EmbedEditor     from "./editors/EmbedEditor.vue"
import Viewer3dEditor  from "./editors/Viewer3dEditor.vue"
import type { DetailBlock, DetailBlockType } from "../../../types/portfolio"

//THE BENTO SIDE PANEL - the block types to add (click: first free spot,
//drag: where it is dropped), then the selected block's border and content.
//The editors write straight into the block; the page history records it.

defineProps<{ selected: DetailBlock | null }>()
const emit = defineEmits<{
  add:    [type: DetailBlockType]
  create: [e: PointerEvent, type: DetailBlockType]
  remove: []
}>()
const { t } = useTranslations()

const EDITORS: Record<DetailBlockType, Component> = {
  text: TextEditor, heading: HeadingEditor, quote: QuoteEditor, image: ImageEditor,
  video: VideoEditor, carousel: CarouselEditor, marquee: MarqueeEditor, compare: CompareEditor,
  accordion: AccordionEditor, specs: SpecsEditor, counters: CountersEditor, button: ButtonEditor,
  embed: EmbedEditor, viewer3d: Viewer3dEditor,
}
</script>

<template>
  <aside class="block-panel" :aria-label="t('detailPanel')">
    <section class="ed-form__section">
      <h2 class="ed-form__title">{{ t('detailAddBlock') }}</h2>
      <p class="ed-hint">{{ t('detailAddHint') }}</p>
      <div class="block-panel__types">
        <button
          v-for="bt in BLOCK_TYPES"
          :key="bt.type"
          type="button"
          class="ed-btn block-panel__type"
          @pointerdown="emit('create', $event, bt.type)"
          @keydown.enter.prevent="emit('add', bt.type)"
          @keydown.space.prevent="emit('add', bt.type)"
        >
          <component :is="bt.icon" :size="16" aria-hidden="true" />
          <span>{{ t(bt.labelKey) }}</span>
        </button>
      </div>
    </section>

    <section v-if="selected" class="ed-form__section">
      <div class="block-panel__head">
        <h2 class="ed-form__title block-panel__title">{{ t('detailBlockSettings').replace('{type}', t(blockType(selected.type).labelKey)) }}</h2>
        <button type="button" class="ed-btn ed-btn--ghost ed-btn--danger ed-btn--icon" :aria-label="t('detailDeleteBlock')" :title="t('detailDeleteBlock')" @click="emit('remove')">
          <Trash2 :size="16" aria-hidden="true" />
        </button>
      </div>
      <component :is="EDITORS[selected.type]" :key="selected.id" :content="selected.content" />
      <BlockStyleEditor :key="`style-${selected.id}`" :block="selected" />
    </section>
    <p v-else class="ed-hint">{{ t('detailNoSelection') }}</p>
  </aside>
</template>

<style scoped>
.block-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: var(--editor-bar-offset);
  z-index: calc(var(--editor-z-inspector) - 1);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: var(--detail-panel-width);
  padding: var(--spacing-lg);
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--editor-text);
  background-color: var(--editor-surface);
  border-left: var(--border-width) solid var(--editor-line);
  container: editor / inline-size;
}
.block-panel__types {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xxs);
}
.block-panel__type {
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.block-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
}
.block-panel__title { flex: 1; }
@media (max-width: 1024px) {
  .block-panel {
    top: auto;
    left: 0;
    width: auto;
    height: var(--detail-sheet-height);
    border-left: none;
    border-top: var(--border-width) solid var(--editor-line);
  }
}
</style>

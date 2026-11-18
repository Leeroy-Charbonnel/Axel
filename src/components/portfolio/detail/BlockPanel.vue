<script setup lang="ts">
import type { Component } from "vue"
import { Copy, Trash2 } from "lucide-vue-next"
import { useTranslations } from "../../../composables/useTranslations"
import { BLOCK_TYPES, blockType } from "./block-types"
import { SECTION_PRESETS } from "../../../lib/section-presets"
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
import LegendEditor    from "./editors/LegendEditor.vue"
import SequenceEditor  from "./editors/SequenceEditor.vue"
import MaterialsEditor from "./editors/MaterialsEditor.vue"
import type { DetailBlock, DetailBlockType } from "../../../types/portfolio"

//THE BENTO SIDE PANEL - the sections of the sheet to add whole, the block
//types to add (click: first free spot, drag: where it is dropped), then the
//selected block's border and content.
//The editors write straight into the block; the page history records it.

defineProps<{ selected: DetailBlock | null }>()
const emit = defineEmits<{
  add:        [type: DetailBlockType]
  create:     [e: PointerEvent, type: DetailBlockType]
  addSection: [key: string]
  duplicate:  []
  remove:     []
}>()
const { t } = useTranslations()

const EDITORS: Record<DetailBlockType, Component> = {
  text: TextEditor, heading: HeadingEditor, quote: QuoteEditor, image: ImageEditor,
  video: VideoEditor, carousel: CarouselEditor, marquee: MarqueeEditor, compare: CompareEditor,
  accordion: AccordionEditor, specs: SpecsEditor, counters: CountersEditor, button: ButtonEditor,
  embed: EmbedEditor, viewer3d: Viewer3dEditor, legend: LegendEditor, sequence: SequenceEditor,
  materials: MaterialsEditor,
}
</script>

<template>
  <aside class="block-panel ed-ui" :aria-label="t('detailPanel')">
    <!--the selected block comes first: the add lists are long-->
    <template v-if="selected">
      <section class="ed-form__section">
        <div class="block-panel__head">
          <h2 class="ed-form__title block-panel__title">{{ t('detailBlockSettings').replace('{type}', t(blockType(selected.type).labelKey)) }}</h2>
          <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('detailDuplicateBlock')" :title="t('detailDuplicateBlock')" @click="emit('duplicate')">
            <Copy :size="16" aria-hidden="true" />
          </button>
          <button type="button" class="ed-btn ed-btn--ghost ed-btn--danger ed-btn--icon" :aria-label="t('detailDeleteBlock')" :title="t('detailDeleteBlock')" @click="emit('remove')">
            <Trash2 :size="16" aria-hidden="true" />
          </button>
        </div>
        <component :is="EDITORS[selected.type]" :key="selected.id" :content="selected.content" />
      </section>
      <section class="ed-form__section">
        <BlockStyleEditor :key="`style-${selected.id}`" :block="selected" />
      </section>
    </template>
    <section v-else class="ed-form__section">
      <p class="ed-hint">{{ t('detailNoSelection') }}</p>
    </section>

    <section class="ed-form__section">
      <div class="block-panel__intro">
        <h2 class="ed-form__title">{{ t('detailAddSection') }}</h2>
        <p class="ed-hint">{{ t('detailAddSectionHint') }}</p>
      </div>
      <div class="block-panel__types">
        <button
          v-for="p in SECTION_PRESETS"
          :key="p.key"
          type="button"
          class="ed-btn block-panel__type"
          @click="emit('addSection', p.key)"
        >{{ t(p.labelKey) }}</button>
      </div>
    </section>

    <section class="ed-form__section">
      <div class="block-panel__intro">
        <h2 class="ed-form__title">{{ t('detailAddBlock') }}</h2>
        <p class="ed-hint">{{ t('detailAddHint') }}</p>
      </div>
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
  width: var(--detail-panel-width);
  padding: var(--vsui-space-md);
  overflow-y: auto;
  overscroll-behavior: contain;
  background-color: var(--editor-surface);
  border-left: var(--border-width) solid var(--editor-line);
  container: editor / inline-size;
}
.block-panel__intro {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-2xs);
}
.block-panel__types {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--vsui-space-2xs);
}
.block-panel__type {
  justify-content: flex-start;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.block-panel__type svg {
  flex-shrink: 0;
  color: var(--editor-text-muted);
}
.block-panel__head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-2xs);
}
.block-panel__title {
  flex: 1;
  min-width: 0;
}
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

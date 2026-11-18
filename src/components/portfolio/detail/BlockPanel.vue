<script setup lang="ts">
import { computed, ref, type Component } from "vue"
import { Copy, Folder, Palette, Plus, SlidersHorizontal, Trash2 } from "lucide-vue-next"
import { useTranslations } from "../../../composables/useTranslations"
import { BLOCK_TYPES, blockType } from "./block-types"
import { GRID_SETTINGS } from "../../../lib/detail-grid"
import { SECTION_PRESETS } from "../../../lib/section-presets"
import EditorTabs, { type EditorTab } from "../../admin/EditorTabs.vue"
import EditLangSwitch  from "../../admin/EditLangSwitch.vue"
import SliderField     from "../../model-editor/SliderField.vue"
import BlockStyleEditor from "./editors/BlockStyleEditor.vue"
import MediaBrowser    from "../../admin/media/MediaBrowser.vue"
import ThemeEditor     from "../../admin/theme/ThemeEditor.vue"
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
import type { DetailBlock, DetailBlockType, DetailGridSettings } from "../../../types/portfolio"

//THE BENTO SIDE PANEL - tabs, with the language being edited beside them.
//Add: the sections of the sheet to add whole and the block types (click:
//first free spot, drag: where it is dropped). Properties: the selected block's
//content and border, or the page grid when nothing is selected. The editors
//write straight into the block; the page history records it. Files: this
//project's own folder. CSS: the site theme, shared by every page.

defineProps<{ selected: DetailBlock | null; grid: DetailGridSettings; projectId: number }>()
const emit = defineEmits<{
  setGrid:    [key: keyof DetailGridSettings, value: number]
  add:        [type: DetailBlockType]
  create:     [e: PointerEvent, type: DetailBlockType]
  addSection: [key: string]
  duplicate:  []
  remove:     []
}>()
const { t } = useTranslations()

type TabKey = "add" | "props" | "files" | "css"
const TABS: { key: TabKey; icon: Component; labelKey: string }[] = [
  { key: "add",   icon: Plus,              labelKey: "detailTabAdd" },
  { key: "props", icon: SlidersHorizontal, labelKey: "detailTabProps" },
  { key: "files", icon: Folder,            labelKey: "detailTabFiles" },
  { key: "css",   icon: Palette,           labelKey: "themeTab" },
]
const tab  = ref<TabKey>("props")
const tabs = computed<EditorTab<TabKey>[]>(() => TABS.map((tb) => ({ key: tb.key, icon: tb.icon, label: t(tb.labelKey) })))

//Opens the properties of the block picked on the canvas
function showProperties() {
  tab.value = "props"
}
defineExpose({ showProperties })

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
    <EditorTabs v-model="tab" class="block-panel__tabs" :tabs="tabs" :label="t('detailPanel')" id-prefix="block" keep>
      <template #end>
        <EditLangSwitch />
      </template>

      <template #add>
        <section class="ed-form__section block-panel__section">
          <h2 class="block-panel__heading">{{ t('detailAddSection') }}</h2>
          <p class="ed-hint">{{ t('detailAddSectionHint') }}</p>
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
        <section class="ed-form__section block-panel__section">
          <h2 class="block-panel__heading">{{ t('detailAddBlock') }}</h2>
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
              <component :is="bt.icon" :size="14" aria-hidden="true" />
              <span>{{ t(bt.labelKey) }}</span>
            </button>
          </div>
        </section>
      </template>

      <template #props>
        <template v-if="selected">
          <section class="ed-form__section block-panel__section">
            <div class="block-panel__head">
              <h2 class="block-panel__heading block-panel__title">{{ t(blockType(selected.type).labelKey) }}</h2>
              <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('detailDuplicateBlock')" :title="t('detailDuplicateBlock')" @click="emit('duplicate')">
                <Copy :size="14" aria-hidden="true" />
              </button>
              <button type="button" class="ed-btn ed-btn--ghost ed-btn--danger ed-btn--icon" :aria-label="t('detailDeleteBlock')" :title="t('detailDeleteBlock')" @click="emit('remove')">
                <Trash2 :size="14" aria-hidden="true" />
              </button>
            </div>
            <component :is="EDITORS[selected.type]" :key="selected.id" :content="selected.content" />
          </section>
          <section class="ed-form__section block-panel__section">
            <BlockStyleEditor :key="`style-${selected.id}`" :block="selected" />
          </section>
        </template>
        <section v-else class="ed-form__section block-panel__section">
          <h2 class="block-panel__heading">{{ t('detailGridTitle') }}</h2>
          <SliderField
            v-for="g in GRID_SETTINGS"
            :key="g.key"
            :label="t(g.labelKey)"
            :model-value="grid[g.key]"
            :min="g.min"
            :max="g.max"
            :step="g.step"
            :unit="g.unit"
            :auto="g.default"
            :lazy="!g.live"
            strict
            @update:model-value="(v) => emit('setGrid', g.key, v)"
          />
          <p class="ed-hint">{{ t('detailNoSelection') }}</p>
        </section>
      </template>

      <template #files>
        <MediaBrowser mode="manage" :project="projectId" compact />
      </template>

      <template #css>
        <div class="block-panel__padded">
          <ThemeEditor />
        </div>
      </template>
    </EditorTabs>
  </aside>
</template>

<style scoped>
/*Flush to its edges: tabs on top, then panes with a small inner padding*/
.block-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: var(--editor-bar-offset);
  z-index: calc(var(--editor-z-inspector) - 1);
  display: flex;
  flex-direction: column;
  width: var(--detail-panel-width);
  background-color: var(--editor-surface);
  border-left: var(--border-width) solid var(--editor-line);
  container: editor / inline-size;
}
/*The inspector takes the right edge while open*/
html.editor-inspector-open .block-panel { visibility: hidden; }
.block-panel__tabs { flex: 1; }
.block-panel__padded { padding: var(--vsui-space-sm); }
.block-panel__section,
.block-panel__section:first-child { padding: var(--vsui-space-sm); }
.block-panel__heading {
  font-size: var(--editor-fs-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--editor-tracking-label);
  text-transform: uppercase;
  color: var(--editor-text-muted);
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

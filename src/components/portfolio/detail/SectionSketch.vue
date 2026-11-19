<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import { SHEET_COLS } from "../../../lib/project-sheet"
import { previewSection, type SectionPreset } from "../../../lib/section-presets"
import { blockType } from "./block-types"

//A SMALL PLAN OF A SECTION, for the help of the Add tab: the blocks the
//preset adds, where the sheet puts them, each named by its type.
const props = defineProps<{ preset: SectionPreset }>()
const { t } = useTranslations()

const tiles = computed(() => previewSection(props.preset).map((b) => ({
  id:    b.id,
  icon:  blockType(b.type).icon,
  label: t(blockType(b.type).labelKey),
  cell:  { gridColumn: `${b.x + 1} / span ${b.w}`, gridRow: `${b.y + 1} / span ${b.h}` },
})))
</script>

<template>
  <ul class="section-sketch" :style="{ '--section-sketch-cols': SHEET_COLS }">
    <li v-for="tile in tiles" :key="tile.id" class="section-sketch__tile" :style="tile.cell">
      <component :is="tile.icon" :size="14" aria-hidden="true" />
      <span class="section-sketch__label">{{ tile.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
.section-sketch {
  display: grid;
  grid-template-columns: repeat(var(--section-sketch-cols), minmax(0, 1fr));
  grid-auto-rows: var(--editor-control);
  gap: var(--vsui-space-xs);
  margin: 0;
  padding: var(--vsui-space-sm);
  list-style: none;
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line-soft);
}
.section-sketch__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-xs);
  min-width: 0;
  padding-inline: var(--vsui-space-xs);
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
  border: var(--border-width) dashed var(--editor-text-muted);
}
.section-sketch__tile svg { flex-shrink: 0; }
.section-sketch__label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>

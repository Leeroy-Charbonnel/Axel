<script setup lang="ts">
import { computed } from "vue"
import Field from "../../../admin/fields/Field.vue"
import NumberField from "../../../admin/fields/NumberField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import BorderSideIcon from "./BorderSideIcon.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { BorderLineStyle, BorderSides, DetailBlock, DetailBlockStyle } from "../../../../types/portfolio"

//THE BORDER OF ANY BLOCK - which sides (icon toggles, as in a spreadsheet),
//the line width and the line type.

const props = defineProps<{ block: DetailBlock }>()
const { t } = useTranslations()

const MAX_WIDTH = 12

const SIDES: { value: BorderSides; label: string }[] = [
  { value: "none",       label: "blockBorderNone" },
  { value: "all",        label: "blockBorderAll" },
  { value: "top",        label: "blockBorderTop" },
  { value: "bottom",     label: "blockBorderBottom" },
  { value: "left",       label: "blockBorderLeft" },
  { value: "right",      label: "blockBorderRight" },
  { value: "top-bottom", label: "blockBorderTopBottom" },
  { value: "left-right", label: "blockBorderLeftRight" },
]
const lines = computed<{ value: BorderLineStyle; label: string }[]>(() => [
  { value: "solid",    label: t("blockLineSolid") },
  { value: "dashed",   label: t("blockLineDashed") },
  { value: "dotted",   label: t("blockLineDotted") },
  { value: "dash-dot", label: t("blockLineDashDot") },
  { value: "double",   label: t("blockLineDouble") },
])

const sides = computed(() => props.block.style?.borderSides ?? "none")

function set(partial: DetailBlockStyle) {
  props.block.style = { ...props.block.style, ...partial }
}
</script>

<template>
  <Field :label="t('blockStyleBorder')" group v-slot="{ labelId }">
    <div class="style-editor__sides" role="radiogroup" :aria-labelledby="labelId">
      <button
        v-for="s in SIDES"
        :key="s.value"
        type="button"
        role="radio"
        class="ed-btn ed-btn--icon"
        :class="{ 'ed-btn--active': sides === s.value }"
        :aria-checked="sides === s.value"
        :aria-label="t(s.label)"
        :title="t(s.label)"
        @click="set({ borderSides: s.value })"
      >
        <BorderSideIcon :sides="s.value" />
      </button>
    </div>
  </Field>
  <div v-if="sides !== 'none'" class="ed-form__grid">
    <NumberField
      :label="t('blockBorderWidth')"
      :model-value="block.style?.borderWidth ?? 1"
      @update:model-value="(v) => set({ borderWidth: Math.max(1, Math.min(MAX_WIDTH, v)) })"
    />
    <SelectField
      :label="t('blockBorderStyle')"
      :model-value="block.style?.borderStyle ?? 'solid'"
      :options="lines"
      @update:model-value="(v) => set({ borderStyle: v })"
    />
  </div>
</template>

<style scoped>
.style-editor__sides {
  display: flex;
  flex-wrap: wrap;
  gap: var(--vsui-space-2xs);
}
</style>

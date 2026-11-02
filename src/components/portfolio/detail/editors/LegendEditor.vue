<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { Bilingual, LegendBlockContent, LegendMarker } from "../../../../types/portfolio"

const props = defineProps<{ content: LegendBlockContent }>()
const { t } = useTranslations()

const markers = computed<{ value: LegendMarker; label: string }[]>(() => [
  { value: "number", label: t("blockMarkerNumber") },
  { value: "letter", label: t("blockMarkerLetter") },
])
const newItem = (): Bilingual => ({ fr: "", en: "" })
</script>

<template>
  <SelectField
    :label="t('blockFieldMarker')"
    :hint="t('blockHintLegend')"
    :model-value="props.content.marker"
    :options="markers"
    @update:model-value="(v) => (props.content.marker = v)"
  />
  <ListField
    :label="t('blockFieldRows')"
    :add-label="t('blockAddRow')"
    :model-value="props.content.items"
    :create="newItem"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <BilingualField :label="t('blockFieldLabel')" :model-value="item" @update:model-value="update" />
    </template>
  </ListField>
</template>

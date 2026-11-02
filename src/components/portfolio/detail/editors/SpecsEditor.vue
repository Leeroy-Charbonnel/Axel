<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { SpecsBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: SpecsBlockContent }>()
const { t } = useTranslations()

type SpecRow = SpecsBlockContent["rows"][number]
const newRow = (): SpecRow => ({ label: { fr: "", en: "" }, value: { fr: "", en: "" } })
</script>

<template>
  <ListField
    :label="t('blockFieldRows')"
    :add-label="t('blockAddRow')"
    :model-value="props.content.rows"
    :create="newRow"
    @update:model-value="(v) => (props.content.rows = v)"
  >
    <template #item="{ item, update }">
      <BilingualField
        :label="t('blockFieldLabel')"
        :model-value="item.label"
        @update:model-value="(v) => update({ ...item, label: v })"
      />
      <BilingualField
        :label="t('blockFieldValue')"
        :model-value="item.value"
        @update:model-value="(v) => update({ ...item, value: v })"
      />
    </template>
  </ListField>
</template>

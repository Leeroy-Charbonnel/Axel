<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import NumberField from "../../../admin/fields/NumberField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { CountersBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: CountersBlockContent }>()
const { t } = useTranslations()

type Counter = CountersBlockContent["items"][number]
const newCounter = (): Counter => ({ label: { fr: "", en: "" }, value: 0 })
</script>

<template>
  <ListField
    :label="t('blockFieldCounters')"
    :add-label="t('blockAddCounter')"
    :model-value="props.content.items"
    :create="newCounter"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <NumberField
        :label="t('blockFieldValue')"
        :model-value="item.value"
        @update:model-value="(v) => update({ ...item, value: v })"
      />
      <BilingualField
        :label="t('blockFieldLabel')"
        :model-value="item.label"
        @update:model-value="(v) => update({ ...item, label: v })"
      />
    </template>
  </ListField>
</template>

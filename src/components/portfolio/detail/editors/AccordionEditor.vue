<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { AccordionBlockContent, AccordionItem } from "../../../../types/portfolio"

const props = defineProps<{ content: AccordionBlockContent }>()
const { t } = useTranslations()

const newSection = (): AccordionItem => ({ title: { fr: "", en: "" }, body: { fr: "", en: "" } })
</script>

<template>
  <ListField
    :label="t('blockFieldSections')"
    :add-label="t('blockAddSection')"
    :model-value="props.content.items"
    :create="newSection"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <BilingualField
        :label="t('fieldTitle')"
        :model-value="item.title"
        @update:model-value="(v) => update({ ...item, title: v })"
      />
      <BilingualField
        :label="t('blockFieldBody')"
        multiline
        :model-value="item.body"
        @update:model-value="(v) => update({ ...item, body: v })"
      />
    </template>
  </ListField>
</template>

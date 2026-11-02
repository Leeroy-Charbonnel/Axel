<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import TextField from "../../../admin/fields/TextField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { MaterialItem, MaterialsBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: MaterialsBlockContent }>()
const { t } = useTranslations()

type MaterialRow = MaterialItem["rows"][number]
//a material without a swatch is dropped on save
const newItem = (): MaterialItem => ({ fileId: "", url: null, name: { fr: "", en: "" }, rows: [] })
const newRow = (): MaterialRow => ({ label: { fr: "", en: "" }, value: "" })
</script>

<template>
  <ListField
    :label="t('blockTypeMaterials')"
    :add-label="t('blockAddMaterial')"
    :model-value="props.content.items"
    :create="newItem"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <MediaField
        :label="t('blockFieldSwatch')"
        accept="image"
        :clearable="false"
        :url="item.url"
        @pick="(f) => update({ ...item, fileId: f.id, url: f.url })"
      />
      <BilingualField
        :label="t('fieldName')"
        :model-value="item.name"
        @update:model-value="(v) => update({ ...item, name: v })"
      />
      <ListField
        :label="t('blockFieldRows')"
        :add-label="t('blockAddRow')"
        :model-value="item.rows"
        :create="newRow"
        @update:model-value="(rows) => update({ ...item, rows })"
      >
        <template #item="{ item: row, update: updateRow }">
          <BilingualField
            :label="t('blockFieldLabel')"
            :model-value="row.label"
            @update:model-value="(v) => updateRow({ ...row, label: v })"
          />
          <TextField
            :label="t('blockFieldValue')"
            :model-value="row.value"
            @update:model-value="(v) => updateRow({ ...row, value: v })"
          />
        </template>
      </ListField>
    </template>
  </ListField>
</template>

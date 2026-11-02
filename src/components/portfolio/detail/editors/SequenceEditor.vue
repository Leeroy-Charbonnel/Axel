<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import ToggleField from "../../../admin/fields/ToggleField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { MediaFile } from "../../../admin/media/useMediaLibrary"
import AddImagesButton from "./AddImagesButton.vue"
import type { SequenceBlockContent, SequenceItem } from "../../../../types/portfolio"

const props = defineProps<{ content: SequenceBlockContent }>()
const { t } = useTranslations()

//an image without a file is dropped on save
const newItem = (): SequenceItem => ({ fileId: "", url: null, caption: { fr: "", en: "" } })

function addImages(files: MediaFile[]) {
  props.content.items = [...props.content.items, ...files.map((f) => ({ fileId: f.id, url: f.url, caption: { fr: "", en: "" } }))]
}
</script>

<template>
  <ToggleField
    :label="t('blockSequenceNumbered')"
    :hint="t('blockHintSequence')"
    :model-value="props.content.numbered"
    @update:model-value="(v) => (props.content.numbered = v)"
  />
  <AddImagesButton @add="addImages" />
  <ListField
    :label="t('blockFieldSlides')"
    :add-label="t('blockAddSlide')"
    :model-value="props.content.items"
    :create="newItem"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <MediaField
        :label="t('fieldImage')"
        accept="image"
        :clearable="false"
        :url="item.url"
        @pick="(f) => update({ ...item, fileId: f.id, url: f.url })"
      />
      <BilingualField
        :label="t('fieldCaption')"
        :model-value="item.caption"
        @update:model-value="(v) => update({ ...item, caption: v })"
      />
    </template>
  </ListField>
</template>

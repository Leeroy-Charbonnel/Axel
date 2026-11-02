<script setup lang="ts">
import { computed } from "vue"
import ListField from "../../../admin/fields/ListField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { MarqueeBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: MarqueeBlockContent }>()
const { t } = useTranslations()

const speeds = computed(() => [
  { value: "30",  label: t("blockSpeedSlow") },
  { value: "60",  label: t("blockSpeedNormal") },
  { value: "120", label: t("blockSpeedFast") },
])

type MarqueeItem = MarqueeBlockContent["items"][number]
//an image without a file is dropped on save
const newImage = (): MarqueeItem => ({ fileId: "", url: null })
</script>

<template>
  <SelectField
    :label="t('blockFieldSpeed')"
    :hint="t('blockHintMarquee')"
    :model-value="String(props.content.speedPxs)"
    :options="speeds"
    @update:model-value="(v) => (props.content.speedPxs = Number(v))"
  />
  <ListField
    :label="t('blockFieldSlides')"
    :add-label="t('blockAddSlide')"
    :model-value="props.content.items"
    :create="newImage"
    @update:model-value="(v) => (props.content.items = v)"
  >
    <template #item="{ item, update }">
      <MediaField
        :label="t('fieldImage')"
        accept="image"
        :clearable="false"
        :url="item.url"
        @pick="(f) => update({ fileId: f.id, url: f.url })"
      />
    </template>
  </ListField>
</template>

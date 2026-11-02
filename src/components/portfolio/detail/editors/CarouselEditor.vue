<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ListField from "../../../admin/fields/ListField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { CarouselBlockContent, CarouselItem } from "../../../../types/portfolio"

const props = defineProps<{ content: CarouselBlockContent }>()
const { t } = useTranslations()

const INTERVALS_S = [3, 5, 8]
const intervals = computed(() => [
  { value: "0", label: t("blockIntervalOff") },
  ...INTERVALS_S.map((s) => ({ value: String(s * 1000), label: t("blockIntervalSeconds").replace("{n}", String(s)) })),
])

//a slide without a file is dropped on save
const newSlide = (): CarouselItem => ({ fileId: "", url: null, caption: { fr: "", en: "" } })
</script>

<template>
  <SelectField
    :label="t('blockFieldInterval')"
    :hint="t('blockHintCarousel')"
    :model-value="String(props.content.intervalMs)"
    :options="intervals"
    @update:model-value="(v) => (props.content.intervalMs = Number(v))"
  />
  <ListField
    :label="t('blockFieldSlides')"
    :add-label="t('blockAddSlide')"
    :model-value="props.content.items"
    :create="newSlide"
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
        :model-value="item.caption ?? { fr: '', en: '' }"
        @update:model-value="(v) => update({ ...item, caption: v })"
      />
    </template>
  </ListField>
</template>

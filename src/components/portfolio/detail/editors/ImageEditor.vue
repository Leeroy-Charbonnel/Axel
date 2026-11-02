<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../../../admin/fields/BilingualField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { ImageBlockContent, ImageFit } from "../../../../types/portfolio"

const props = defineProps<{ content: ImageBlockContent }>()
const { t } = useTranslations()

const fits = computed<{ value: ImageFit; label: string }[]>(() => [
  { value: "cover",   label: t("blockFitCover") },
  { value: "contain", label: t("blockFitContain") },
  { value: "fill",    label: t("blockFitFill") },
  { value: "none",    label: t("blockFitNone") },
])
</script>

<template>
  <MediaField
    :label="t('fieldImage')"
    accept="image"
    :url="props.content.url"
    @pick="(f) => { props.content.fileId = f.id; props.content.url = f.url }"
    @clear="props.content.fileId = null; props.content.url = null"
  />
  <SelectField
    :label="t('blockFieldFit')"
    :model-value="props.content.fit ?? 'cover'"
    :options="fits"
    @update:model-value="(v) => (props.content.fit = v)"
  />
  <BilingualField
    :label="t('blockFieldAlt')"
    :hint="t('blockHintAlt')"
    :model-value="props.content.alt ?? { fr: '', en: '' }"
    @update:model-value="(v) => (props.content.alt = v)"
  />
</template>

<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import MediaField from "../../../admin/fields/MediaField.vue"
import ToggleField from "../../../admin/fields/ToggleField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { CompareBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: CompareBlockContent }>()
const { t } = useTranslations()
</script>

<template>
  <MediaField
    :label="t('blockFieldBefore')"
    accept="image"
    :url="props.content.beforeUrl"
    @pick="(f) => { props.content.beforeFileId = f.id; props.content.beforeUrl = f.url }"
    @clear="props.content.beforeFileId = null; props.content.beforeUrl = null"
  />
  <MediaField
    :label="t('blockFieldAfter')"
    accept="image"
    :url="props.content.afterUrl"
    @pick="(f) => { props.content.afterFileId = f.id; props.content.afterUrl = f.url }"
    @clear="props.content.afterFileId = null; props.content.afterUrl = null"
  />
  <div class="ed-form__grid">
    <BilingualField
      :label="t('blockFieldBeforeLabel')"
      :model-value="props.content.beforeLabel"
      @update:model-value="(v) => (props.content.beforeLabel = v)"
    />
    <BilingualField
      :label="t('blockFieldAfterLabel')"
      :model-value="props.content.afterLabel"
      @update:model-value="(v) => (props.content.afterLabel = v)"
    />
  </div>
  <ToggleField
    :label="t('blockCompareFollow')"
    :model-value="props.content.followMouse ?? false"
    @update:model-value="(v) => (props.content.followMouse = v)"
  />
</template>

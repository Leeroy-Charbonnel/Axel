<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import ToggleField from "../../../admin/fields/ToggleField.vue"
import UrlField from "../../../admin/fields/UrlField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { ButtonBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: ButtonBlockContent }>()
const { t } = useTranslations()
</script>

<template>
  <BilingualField
    :label="t('blockFieldLabel')"
    :model-value="props.content.label"
    @update:model-value="(v) => (props.content.label = v)"
  />
  <UrlField
    :label="t('blockFieldUrl')"
    :model-value="props.content.url"
    @update:model-value="(v) => (props.content.url = v)"
  />
  <ToggleField
    :label="t('blockButtonNewTab')"
    :model-value="props.content.newTab"
    @update:model-value="(v) => (props.content.newTab = v)"
  />
</template>

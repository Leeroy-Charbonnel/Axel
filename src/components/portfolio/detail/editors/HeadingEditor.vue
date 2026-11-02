<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { HeadingBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: HeadingBlockContent }>()
const { t } = useTranslations()
</script>

<template>
  <BilingualField
    :label="t('fieldTitle')"
    :model-value="props.content.text"
    @update:model-value="(v) => (props.content.text = v)"
  />
</template>

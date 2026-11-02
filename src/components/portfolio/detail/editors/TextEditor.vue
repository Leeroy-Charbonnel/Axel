<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { TextBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: TextBlockContent }>()
const { t } = useTranslations()
</script>

<template>
  <BilingualField
    :label="t('blockFieldMarkdown')"
    :hint="t('blockHintText')"
    multiline
    :rows="8"
    :model-value="props.content.text"
    @update:model-value="(v) => (props.content.text = v)"
  />
</template>

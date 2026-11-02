<script setup lang="ts">
import BilingualField from "../../../admin/fields/BilingualField.vue"
import TextField from "../../../admin/fields/TextField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { QuoteBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: QuoteBlockContent }>()
const { t } = useTranslations()
</script>

<template>
  <BilingualField
    :label="t('blockFieldQuote')"
    multiline
    :rows="3"
    :model-value="props.content.text"
    @update:model-value="(v) => (props.content.text = v)"
  />
  <TextField
    :label="t('blockFieldAuthor')"
    :model-value="props.content.author"
    @update:model-value="(v) => (props.content.author = v)"
  />
</template>

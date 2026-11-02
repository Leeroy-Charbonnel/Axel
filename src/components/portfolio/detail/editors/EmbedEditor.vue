<script setup lang="ts">
import { computed } from "vue"
import UrlField from "../../../admin/fields/UrlField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import { embedSrc } from "../../../../lib/embed"
import type { EmbedBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: EmbedBlockContent }>()
const { t } = useTranslations()

const unsupported = computed(() => props.content.url.trim() !== "" && embedSrc(props.content.url) === null)
</script>

<template>
  <UrlField
    :label="t('blockFieldUrl')"
    :hint="t('blockHintEmbed')"
    placeholder="https://www.youtube.com/watch?v="
    :model-value="props.content.url"
    @update:model-value="(v) => (props.content.url = v)"
  />
  <p v-if="unsupported" class="ed-error" role="alert">{{ t('blockEmbedUnsupported') }}</p>
</template>

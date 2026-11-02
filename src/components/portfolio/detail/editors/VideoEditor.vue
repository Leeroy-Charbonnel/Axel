<script setup lang="ts">
import MediaField from "../../../admin/fields/MediaField.vue"
import ToggleField from "../../../admin/fields/ToggleField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { VideoBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: VideoBlockContent }>()
const { t } = useTranslations()

const TOGGLES = [
  { key: "autoplay", label: "blockVideoAutoplay" },
  { key: "loop",     label: "blockVideoLoop" },
  { key: "muted",    label: "blockVideoMuted" },
  { key: "controls", label: "blockVideoControls" },
] as const
</script>

<template>
  <MediaField
    :label="t('blockFieldVideo')"
    accept="video"
    :hint="t('blockHintVideo')"
    :url="props.content.url"
    @pick="(f) => { props.content.fileId = f.id; props.content.url = f.url }"
    @clear="props.content.fileId = null; props.content.url = null"
  />
  <ToggleField
    v-for="tg in TOGGLES"
    :key="tg.key"
    :label="t(tg.label)"
    :model-value="props.content[tg.key]"
    @update:model-value="(v) => (props.content[tg.key] = v)"
  />
</template>

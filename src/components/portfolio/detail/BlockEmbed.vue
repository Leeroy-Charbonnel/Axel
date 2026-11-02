<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import { EMBED_ALLOW, EMBED_SANDBOX, embedSrc } from "../../../lib/embed"
import BlockEmpty from "./BlockEmpty.vue"
import type { EmbedBlockContent } from "../../../types/portfolio"

//EMBED - a YouTube, Vimeo or Sketchfab player in a sandboxed frame
const props = defineProps<{ content: EmbedBlockContent }>()
const { t } = useTranslations()

const src = computed(() => embedSrc(props.content.url))
</script>

<template>
  <iframe
    v-if="src"
    :src="src"
    class="bembed"
    :title="t('blockEmbedTitle')"
    :sandbox="EMBED_SANDBOX"
    :allow="EMBED_ALLOW"
    allowfullscreen
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
  <BlockEmpty v-else type="embed" :message="content.url ? t('blockEmbedUnsupported') : t('blockEmptyMedia')" />
</template>

<style scoped>
.bembed {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background-color: var(--color-background-gray-50);
}
</style>

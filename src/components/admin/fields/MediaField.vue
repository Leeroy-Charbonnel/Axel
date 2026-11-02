<script setup lang="ts">
import { computed } from "vue"
import { Box, FileText, Film, ImageIcon, Sun } from "lucide-vue-next"
import Field from "./Field.vue"
import { useMediaLibrary, type MediaFile, type MediaType } from "../media/useMediaLibrary"
import { useTranslations } from "../../../composables/useTranslations"

//ONE FILE OF AN ENTITY - preview, then choose (upload or reuse) through the
//media library, or remove. The caller maps the picked file onto its fields.

const ICONS = { image: ImageIcon, video: Film, model: Box, hdr: Sun, document: FileText }

const props = withDefaults(defineProps<{
  label:      string
  url:        string | null
  accept:     MediaType
  hint?:      string
  clearable?: boolean
}>(), { clearable: true })

const emit = defineEmits<{ pick: [file: MediaFile]; clear: [] }>()
const { t } = useTranslations()
const { files, pickMedia } = useMediaLibrary()

//the library knows the original name; before it has loaded, the stored name says enough
const fileName = computed(() => {
  if (!props.url) return ""
  return files.value.find((f) => f.url === props.url)?.originalFilename ?? props.url.split("/").pop() ?? props.url
})

async function choose() {
  const [file] = await pickMedia({ accept: props.accept })
  if (file) emit("pick", file)
}
</script>

<template>
  <Field :label="label" :hint="hint" group v-slot="{ labelId }">
    <div class="ed-media" role="group" :aria-labelledby="labelId">
      <div class="ed-media__preview">
        <img v-if="url && accept === 'image'" :src="url" alt="" loading="lazy" />
        <component :is="ICONS[accept]" v-else :size="20" aria-hidden="true" />
      </div>
      <div class="ed-media__meta">
        <span class="ed-media__name" :title="fileName">{{ url ? fileName : t('fieldMediaEmpty') }}</span>
        <div class="ed-media__actions">
          <button type="button" class="ed-btn" @click="choose">
            {{ url ? t('fieldMediaReplace') : t('fieldMediaChoose') }}
          </button>
          <button
            v-if="url && clearable"
            type="button"
            class="ed-btn ed-btn--ghost ed-btn--danger"
            @click="emit('clear')"
          >
            {{ t('fieldMediaRemove') }}
          </button>
        </div>
      </div>
    </div>
  </Field>
</template>

<style scoped>
.ed-media {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ed-media__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--editor-media-preview);
  height: var(--editor-media-preview);
  overflow: hidden;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line);
}

.ed-media__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ed-media__meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.ed-media__name {
  font-size: var(--font-size-xs);
  color: var(--editor-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ed-media__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs);
}
</style>

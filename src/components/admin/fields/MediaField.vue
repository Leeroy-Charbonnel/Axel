<script setup lang="ts">
import { computed, onMounted } from "vue"
import { Box, FileText, Film, ImageIcon, Sun, X } from "lucide-vue-next"
import Field from "./Field.vue"
import { useMediaLibrary, type MediaFile, type MediaType } from "../media/useMediaLibrary"
import { useTranslations } from "../../../composables/useTranslations"
import { IMAGE_SIZES } from "../../../lib/media"
import SiteImage from "../../SiteImage.vue"

//ONE FILE OF AN ENTITY - preview, then choose (upload or reuse) through the
//media library, or remove. The caller maps the picked file onto its fields.

const ICONS = { image: ImageIcon, video: Film, model: Box, hdr: Sun, document: FileText }
const ICON_SIZE = 16
const CLEAR_ICON_SIZE = 12

const props = withDefaults(defineProps<{
  label:      string
  url:        string | null
  accept:     MediaType
  hint?:      string
  clearable?: boolean
  //A small tile only: click to choose, a corner button to remove
  compact?:   boolean
  //Folder the picker opens and uploads to (null = shared); left out, the project page being edited
  project?:   number | null
}>(), { clearable: true, compact: false, project: undefined })

const emit = defineEmits<{ pick: [file: MediaFile]; clear: [] }>()
const { t } = useTranslations()
const { files, ensureLoaded, pickMedia } = useMediaLibrary()
onMounted(() => { void ensureLoaded() })

//The original name once the library has loaded, the stored name until then
const fileName = computed(() => {
  if (!props.url) return ""
  return files.value.find((f) => f.url === props.url)?.originalFilename ?? props.url.split("/").pop() ?? props.url
})

const pickText = computed(() => props.url ? t("fieldMediaReplace") : t("fieldMediaChoose"))
const tileLabel = (action: string) => t("fieldMediaTileAction").replace("{field}", props.label).replace("{action}", action)

async function choose() {
  const [file] = await pickMedia({ accept: props.accept, project: props.project })
  if (file) emit("pick", file)
}
</script>

<template>
  <div v-if="compact" class="ed-media-tile" :title="url ? `${label} · ${fileName}` : label">
    <button type="button" class="ed-media__preview ed-media-tile__pick" :aria-label="tileLabel(pickText)" @click="choose">
      <SiteImage v-if="url && accept === 'image'" :src="url" :sizes="IMAGE_SIZES.tile" />
      <component :is="ICONS[accept]" v-else :size="ICON_SIZE" aria-hidden="true" />
    </button>
    <span class="ed-media-tile__label">{{ label }}</span>
    <button
      v-if="url && clearable"
      type="button"
      class="ed-media-tile__clear"
      :aria-label="tileLabel(t('fieldMediaRemove'))"
      @click="emit('clear')"
    >
      <X :size="CLEAR_ICON_SIZE" aria-hidden="true" />
    </button>
  </div>
  <Field v-else :label="label" :hint="hint" group v-slot="{ labelId }">
    <div class="ed-media" role="group" :aria-labelledby="labelId">
      <div class="ed-media__preview">
        <SiteImage v-if="url && accept === 'image'" :src="url" :sizes="IMAGE_SIZES.tile" />
        <component :is="ICONS[accept]" v-else :size="ICON_SIZE" aria-hidden="true" />
      </div>
      <div class="ed-media__meta">
        <span class="ed-media__name" :title="fileName">{{ url ? fileName : t('fieldMediaEmpty') }}</span>
        <div class="ed-media__actions">
          <button type="button" class="ed-btn" @click="choose">{{ pickText }}</button>
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
  gap: var(--vsui-space-sm);
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
  border: var(--border-width) solid var(--editor-line-soft);
  border-radius: var(--editor-radius);
}

.ed-media__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ed-media__meta {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  min-width: 0;
}

.ed-media__name {
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ed-media__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--vsui-space-xs);
}

/*COMPACT TILE - the preview is the pick button*/
.ed-media-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vsui-space-2xs);
  flex-shrink: 0;
  width: var(--editor-media-preview);
}

.ed-media-tile__pick {
  padding: 0;
  cursor: pointer;
}

.ed-media-tile__pick:hover { border-color: var(--editor-accent); }

.ed-media-tile__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
}

.ed-media-tile__clear {
  position: absolute;
  top: calc(-1 * var(--vsui-space-xs));
  right: calc(-1 * var(--vsui-space-xs));
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--editor-icon);
  height: var(--editor-icon);
  padding: 0;
  color: var(--editor-text);
  background-color: var(--editor-surface-raised);
  border: var(--border-width) solid var(--editor-line-soft);
  border-radius: var(--border-radius-full);
  cursor: pointer;
}

/*Hit area larger than the drawn button*/
.ed-media-tile__clear::before {
  content: "";
  position: absolute;
  inset: calc((var(--editor-icon) - var(--editor-target-min)) / 2);
}

.ed-media-tile__clear:hover { color: var(--editor-danger); }

.ed-media-tile__pick:focus-visible,
.ed-media-tile__clear:focus-visible {
  outline: none;
  box-shadow: var(--editor-focus);
}
</style>

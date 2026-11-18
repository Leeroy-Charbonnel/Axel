<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { Box, Brush, Check, FileText, Film, ImageIcon, RefreshCw, Sun, Trash2, Upload } from "lucide-vue-next"
import { MEDIA_TYPES, acceptFor, inScope, mediaTypeOf, useMediaLibrary, type MediaFile, type MediaType, type StorageSummary } from "./useMediaLibrary"
import { useConfirm } from "../../../composables/useConfirm"
import { useToast } from "../../../composables/useToast"
import { useTranslations } from "../../../composables/useTranslations"
import { formatBytes } from "../../../lib/format"
import { IMAGE_SIZES } from "../../../lib/media"
import SiteImage from "../../SiteImage.vue"

//THE FILE GRID - shared by the picker dialog ("pick"), the settings files tab
//and a project's files panel ("manage"). Search, type filter, upload (button
//or drop), previews. With a project: manage shows its files only, pick shows
//its files and the shared ones, and uploads go to its folder. Manage mode
//also shows the storage used and sweeps the orphans. compact: inside a panel.

const ICONS = { image: ImageIcon, video: Film, model: Box, hdr: Sun, document: FileText }
//placeholders drawn before the very first answer; later loads keep the last list on screen
const SKELETON_TILES = 8

const props = withDefaults(defineProps<{
  mode:      "pick" | "manage"
  accept?:   MediaType | null
  multiple?: boolean
  project?:  number | null
  compact?:  boolean
}>(), { accept: null, multiple: false, project: null, compact: false })

const emit = defineEmits<{ pick: [files: MediaFile[]] }>()
const { t } = useTranslations()
const { confirm } = useConfirm()
const toast = useToast()
const library = useMediaLibrary()
const { files, loading, uploading, error } = library

const filter   = ref<MediaType | "all">(props.accept ?? "all")
const query    = ref("")
const chosen   = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dropping = ref(false)

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return files.value.filter((f) =>
    visible(f) &&
    (filter.value === "all" || mediaTypeOf(f) === filter.value) &&
    (!q || f.originalFilename.toLowerCase().includes(q)))
})

const firstLoad = computed(() => loading.value && files.value.length === 0)

function visible(f: MediaFile): boolean {
  if (props.mode === "pick" && props.project !== null) return f.projectId === props.project || f.projectId === null
  return inScope(f, props.project)
}

function allowed(f: MediaFile): boolean {
  return props.mode === "manage" || props.accept === null || mediaTypeOf(f) === props.accept
}

function onTile(f: MediaFile) {
  if (props.mode !== "pick" || !allowed(f)) return
  if (!props.multiple) {
    emit("pick", [f])
    return
  }
  chosen.value = chosen.value.includes(f.id) ? chosen.value.filter((id) => id !== f.id) : [...chosen.value, f.id]
}

function confirmChosen() {
  const byId = new Map(files.value.map((f) => [f.id, f]))
  emit("pick", chosen.value.map((id) => byId.get(id)).filter((f): f is MediaFile => Boolean(f)))
}

async function uploadList(list: File[]) {
  const added = await library.upload(list, props.project)
  if (!added.length || props.mode !== "pick") return
  const usable = added.filter(allowed)
  if (!props.multiple && usable[0]) emit("pick", [usable[0]])
  else chosen.value = [...chosen.value, ...usable.map((f) => f.id)]
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  void uploadList(Array.from(input.files ?? []))
  input.value = ""
}

function onDrop(e: DragEvent) {
  dropping.value = false
  void uploadList(Array.from(e.dataTransfer?.files ?? []))
}

async function onDelete(f: MediaFile) {
  const ok = await confirm({
    title:       t("mediaDeleteTitle"),
    what:        f.originalFilename,
    action:      t("mediaDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  try {
    await library.remove(f)
  } catch (e) {
    console.error("[media] delete failed:", e)
  }
}

//STORAGE - what the files take on the server, and the orphans the sweep frees
const summary  = ref<StorageSummary | null>(null)
const sweeping = ref(false)
const orphanCount = computed(() => summary.value ? summary.value.orphans.rows + summary.value.orphans.strayFiles : 0)

async function refreshSummary() {
  if (props.mode !== "manage") return
  summary.value = await library.storage(props.project)
}

async function onSweep() {
  if (!summary.value) return
  const ok = await confirm({
    title:       t("mediaOrphansTitle"),
    what:        t("mediaOrphansWhat").replace("{n}", String(orphanCount.value)).replace("{size}", formatBytes(summary.value.orphans.bytes)),
    action:      t("mediaOrphansDelete"),
    destructive: true,
  })
  if (!ok) return
  sweeping.value = true
  try {
    const done = await library.sweepOrphans(props.project)
    toast.success(t("mediaOrphansDone").replace("{n}", String(done.deletedObjects)).replace("{size}", formatBytes(done.freedBytes)))
  } finally {
    sweeping.value = false
  }
}

//every change to the list (upload, delete, sweep, reload) changes the sizes
watch(files, () => { void refreshSummary() })
watch(() => props.project, () => { void refreshSummary() })

onMounted(() => { void library.load() })
</script>

<template>
  <div
    class="ed-ui media"
    :class="{ 'media--dropping': dropping, 'media--compact': compact }"
    @dragover.prevent="dropping = true"
    @dragleave.self="dropping = false"
    @drop.prevent="onDrop"
  >
    <div class="media__toolbar">
      <input
        v-model="query"
        class="ed-input media__search"
        type="search"
        :placeholder="t('mediaSearch')"
        :aria-label="t('mediaSearch')"
      />
      <button type="button" class="ed-btn ed-btn--primary" :disabled="uploading" @click="fileInput?.click()">
        <Upload :size="16" />
        <span>{{ uploading ? t('mediaUploading') : t('mediaUpload') }}</span>
      </button>
      <button type="button" class="ed-btn ed-btn--icon" :aria-label="t('mediaReload')" :disabled="loading" @click="library.load()">
        <RefreshCw :size="16" />
      </button>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        multiple
        tabindex="-1"
        aria-hidden="true"
        :accept="acceptFor(accept)"
        @change="onFileInput"
      />
    </div>

    <div class="media__filters" role="group" :aria-label="t('mediaFilter')">
      <button
        type="button"
        class="ed-btn ed-btn--ghost media__filter"
        :class="{ 'ed-btn--active': filter === 'all' }"
        :aria-pressed="filter === 'all'"
        @click="filter = 'all'"
      >
        {{ t('mediaTypeAll') }}
      </button>
      <button
        v-for="type in MEDIA_TYPES"
        :key="type.type"
        type="button"
        class="ed-btn ed-btn--ghost media__filter"
        :class="{ 'ed-btn--active': filter === type.type }"
        :aria-pressed="filter === type.type"
        @click="filter = type.type"
      >
        {{ t(type.labelKey) }}
      </button>
    </div>

    <div v-if="mode === 'manage' && summary" class="media__storage">
      <span class="media__storage-total">{{ t('mediaStorage').replace('{size}', formatBytes(summary.totalBytes)) }}</span>
      <span class="media__storage-meta">{{ t('mediaStorageCache').replace('{size}', formatBytes(summary.cacheBytes)) }}</span>
      <span class="media__storage-meta">
        {{ orphanCount
          ? t('mediaOrphans').replace('{n}', String(orphanCount)).replace('{size}', formatBytes(summary.orphans.bytes))
          : t('mediaNoOrphans') }}
      </span>
      <button
        v-if="orphanCount"
        type="button"
        class="ed-btn ed-btn--ghost ed-btn--danger media__sweep"
        :disabled="sweeping"
        @click="onSweep"
      >
        <Brush :size="14" />
        <span>{{ t('mediaOrphansDelete') }}</span>
      </button>
    </div>

    <p v-if="error" class="ed-error" role="alert">{{ error }}</p>
    <p v-if="!compact" class="ed-hint">{{ t('mediaDropHint') }}</p>

    <ul v-if="firstLoad" class="media__grid" aria-hidden="true">
      <li v-for="i in SKELETON_TILES" :key="i" class="media__tile media__tile--skeleton">
        <span class="media__card">
          <span class="media__preview"></span>
          <span class="media__name">&nbsp;</span>
          <span class="media__meta">&nbsp;</span>
        </span>
      </li>
    </ul>
    <p v-else-if="!shown.length" class="media__empty">{{ t('mediaEmpty') }}</p>
    <ul v-else class="media__grid">
      <li
        v-for="f in shown"
        :key="f.id"
        class="media__tile"
        :class="{ 'media__tile--chosen': chosen.includes(f.id), 'media__tile--blocked': !allowed(f) }"
      >
        <component
          :is="mode === 'pick' ? 'button' : 'div'"
          :type="mode === 'pick' ? 'button' : undefined"
          class="media__card"
          :disabled="mode === 'pick' && !allowed(f) ? true : undefined"
          :aria-pressed="mode === 'pick' && multiple ? chosen.includes(f.id) : undefined"
          @click="onTile(f)"
        >
          <span class="media__preview">
            <SiteImage v-if="mediaTypeOf(f) === 'image'" :src="f.url" :sizes="IMAGE_SIZES.tile" />
            <component :is="ICONS[mediaTypeOf(f) ?? 'document']" v-else :size="24" aria-hidden="true" />
            <span v-if="chosen.includes(f.id)" class="media__check"><Check :size="12" /></span>
          </span>
          <span class="media__name" :title="f.originalFilename">{{ f.originalFilename }}</span>
          <span class="media__meta">
            {{ formatBytes(f.sizeBytes) }} ·
            {{ f.referenceCount ? t('mediaUsed').replace('{n}', String(f.referenceCount)) : t('mediaUnused') }}
          </span>
        </component>
        <button
          v-if="mode === 'manage' && f.referenceCount === 0"
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--icon ed-btn--danger media__delete"
          :aria-label="`${t('mediaDeleteAction')} ${f.originalFilename}`"
          @click="onDelete(f)"
        >
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>

    <div v-if="mode === 'pick' && multiple" class="media__footer">
      <button type="button" class="ed-btn ed-btn--primary" :disabled="!chosen.length" @click="confirmChosen">
        {{ t('mediaAddChosen').replace('{n}', String(chosen.length)) }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.media {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  min-height: 0;
  border-radius: var(--editor-radius);
}

.media--dropping { box-shadow: var(--editor-focus); }

/*COMPACT - inside a side panel: smaller tiles, no hint line*/
.media--compact { --editor-media-tile: var(--editor-media-tile-compact); }

/*STORAGE - one line: total, cache share, orphans, the sweep*/
.media__storage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--vsui-space-2xs) var(--vsui-space-sm);
  font-size: var(--editor-fs-xs);
}

.media__storage-total {
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text);
}

.media__storage-meta { color: var(--editor-text-muted); }

.media__sweep {
  margin-left: auto;
  font-size: var(--editor-fs-xs);
}

.media__toolbar {
  display: flex;
  gap: var(--vsui-space-xs);
}

.media__search { flex: 1; min-width: 0; }

/*FILTERS - a compact segmented row*/
.media__filters {
  display: flex;
  align-self: flex-start;
  gap: var(--vsui-space-2xs);
  max-width: 100%;
  padding: var(--vsui-space-2xs);
  overflow-x: auto;
  scrollbar-width: thin;
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}

.media__filter {
  flex-shrink: 0;
  min-height: calc(var(--editor-control) - 2 * var(--vsui-space-2xs));
  font-size: var(--editor-fs-sm);
}

.media__filter:not(.ed-btn--active) { color: var(--editor-text-muted); }
.media__filter:not(.ed-btn--active):hover { color: var(--editor-text); }

/*THE GRID - dense tiles, the selection drawn by the border colour only*/
.media__grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--editor-media-tile), 1fr));
  gap: var(--vsui-space-xs);
}

.media__tile {
  position: relative;
  min-width: 0;
}

.media__card {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-2xs);
  width: 100%;
  padding: var(--vsui-space-xs);
  text-align: left;
  color: var(--editor-text);
  border: var(--border-width) solid transparent;
  border-radius: var(--editor-radius);
  transition: border-color var(--transition-fast) ease, background-color var(--transition-fast) ease;
}

button.media__card { cursor: pointer; }
button.media__card:hover:not(:disabled) { background-color: var(--editor-surface-raised); }
button.media__card:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.media__tile--chosen .media__card {
  background-color: var(--editor-accent-soft);
  border-color: var(--editor-accent);
}
.media__tile--blocked .media__card { opacity: var(--vsui-disabled-opacity); cursor: not-allowed; }

.media__preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}

.media__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media__tile--skeleton .media__preview { background-color: var(--editor-surface-raised); }

.media__check {
  position: absolute;
  top: var(--vsui-space-xs);
  right: var(--vsui-space-xs);
  z-index: var(--editor-z-region);
  display: flex;
  padding: var(--vsui-space-2xs);
  color: var(--editor-on-accent);
  background-color: var(--editor-accent);
  border-radius: var(--border-radius-full);
}

.media__name {
  font-size: var(--editor-fs-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media__meta {
  font-size: var(--editor-fs-xs);
  color: var(--editor-text-muted);
}

.media__delete {
  position: absolute;
  top: var(--vsui-space-xs);
  right: var(--vsui-space-xs);
  z-index: var(--editor-z-region);
  background-color: var(--editor-surface);
}

.media__empty {
  padding: var(--vsui-space-xl);
  text-align: center;
  color: var(--editor-text-muted);
}

.media__footer {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: var(--vsui-space-sm) 0 0;
  background-color: var(--editor-surface);
  border-top: var(--border-width) solid var(--editor-line-soft);
}
</style>

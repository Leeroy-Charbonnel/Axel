<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { Brush, Check, RefreshCw, Trash2, Upload } from "lucide-vue-next"
import {
  MEDIA_TYPES, acceptFor, inScope, mediaTypeOf, mediaTypeOfUpload, reportFailure, useMediaLibrary,
  type MediaFile, type MediaType, type StorageSummary,
} from "./useMediaLibrary"
import { useConfirm } from "../../../composables/useConfirm"
import { useEditor } from "../../../composables/useEditor"
import { useToast } from "../../../composables/useToast"
import { useTranslations } from "../../../composables/useTranslations"
import { formatBytes } from "../../../lib/format"
import FileThumb from "./FileThumb.vue"

//THE FILE GRID - shared by the picker dialog ("pick"), the settings files tab
//and a project's files panel ("manage"). Search, type filter, upload (button
//or drop), a picture of every file (FileThumb). With a project: manage shows
//its files only, pick shows its files and the shared ones, and uploads go to
//its folder. Manage mode also shows the storage used and sweeps the orphans;
//a deletion waits for Save. compact: inside a panel.

//placeholders drawn before the very first answer; later loads keep the last list on screen
const SKELETON_TILES = 8
//Tiles drawn at once, "show more" adds as many
const PAGE_SIZE = 60
const ICON_SIZE = 16
const SMALL_ICON_SIZE = 14
const PREVIEW_ICON_SIZE = 24
const CHECK_ICON_SIZE = 12

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
const { dirty } = useEditor()
const toast = useToast()
const library = useMediaLibrary()
const { files, loading, uploading, error } = library

const filter    = ref<MediaType | "all">(props.accept ?? "all")
const query     = ref("")
const chosen    = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const search    = ref<HTMLInputElement | null>(null)
const grid      = ref<HTMLElement | null>(null)
const dropping  = ref(false)
const limit     = ref(PAGE_SIZE)

//This folder's files, before the search and the type filter
const scoped = computed(() => files.value.filter(visible))

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return scoped.value.filter((f) =>
    (filter.value === "all" || mediaTypeOf(f) === filter.value) &&
    (!q || f.originalFilename.toLowerCase().includes(q)))
})

const paged = computed(() => shown.value.slice(0, limit.value))
watch([query, filter, () => props.project], () => { limit.value = PAGE_SIZE })

const firstLoad = computed(() => loading.value && files.value.length === 0)

//Nothing matches the search, or the folder holds nothing yet
const emptyText = computed(() => {
  if (scoped.value.length) return t("mediaNoMatch")
  return props.compact ? t("mediaDropHint") : t("mediaEmpty")
})

const uploadLabel = computed(() => uploading.value ? t("mediaUploading") : t("mediaUpload"))


function metaText(f: MediaFile): string {
  const use = f.referenceCount ? t("mediaUsed").replace("{n}", String(f.referenceCount)) : t("mediaUnused")
  return `${formatBytes(f.sizeBytes)} · ${use}`
}

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

//In pick mode only files of the asked type are sent
function acceptable(list: File[]): File[] {
  if (props.mode !== "pick" || props.accept === null) return list
  const refused = list.filter((f) => mediaTypeOfUpload(f) !== props.accept)
  if (refused.length) toast.error(refused.map((f) => f.name).join(", "), t("mediaWrongType"))
  return list.filter((f) => !refused.includes(f))
}

async function uploadList(list: File[]) {
  const sendable = acceptable(list)
  if (!sendable.length) return
  const added = await library.upload(sendable, props.project)
  void refreshSummary()
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

//DROP - enter and leave fire on every child: a counter keeps the highlight on
let dragDepth = 0
const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes("Files"))

function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth++
  dropping.value = true
}

function onDragOver(e: DragEvent) {
  if (hasFiles(e)) e.preventDefault()
}

function onDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dropping.value = false
}

function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth = 0
  dropping.value = false
  void uploadList(Array.from(e.dataTransfer?.files ?? []))
}

async function onDelete(f: MediaFile, index: number) {
  const ok = await confirm({
    title:       t("mediaDeleteTitle"),
    what:        f.originalFilename,
    action:      t("mediaDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  await library.remove(f)
  toast.info(t("mediaDeleteOnSave"))
  await nextTick()
  focusNear(index)
}

//After a delete: the nearest delete button left, else the search
function focusNear(index: number) {
  const tiles = [...(grid.value?.querySelectorAll<HTMLElement>(".media__tile") ?? [])]
  const next = [...tiles.slice(index), ...tiles.slice(0, index).reverse()]
    .map((tile) => tile.querySelector<HTMLElement>(".media__delete"))
    .find((button) => button !== null)
  ;(next ?? search.value)?.focus()
}

//STORAGE - what the files take on the server, and the orphans the sweep frees
const summary  = ref<StorageSummary | null>(null)
const sweeping = ref(false)
const orphanCount = computed(() => summary.value?.orphans.files ?? 0)

const orphanText = computed(() => {
  const s = summary.value
  if (!s) return ""
  if (!s.orphans.files) return t("mediaNoOrphans")
  const n = String(s.orphans.files)
  return props.compact
    ? t("mediaOrphansCount").replace("{n}", n)
    : t("mediaOrphans").replace("{n}", n).replace("{size}", formatBytes(s.orphans.bytes))
})

//Only the latest answer is drawn: the project can change on the way
let summarySeq = 0

async function refreshSummary() {
  if (props.mode !== "manage") return
  const seq = ++summarySeq
  try {
    const answer = await library.storage(props.project)
    if (seq === summarySeq) summary.value = answer
  } catch (e) {
    reportFailure(e, "GET /api/files/storage")
  }
}

async function onSweep() {
  if (!summary.value) return
  const what = props.project === null ? "mediaOrphansWhatSite" : "mediaOrphansWhatProject"
  const ok = await confirm({
    title:       t("mediaOrphansTitle"),
    what:        t(what).replace("{n}", String(orphanCount.value)).replace("{size}", formatBytes(summary.value.orphans.bytes)),
    action:      t("mediaOrphansDelete"),
    destructive: true,
  })
  if (!ok) return
  await library.sweepOrphans(props.project)
  toast.info(t("mediaDeleteOnSave"))
}

watch(() => props.project, () => {
  summary.value = null
  void refreshSummary()
})
//A save or a discard changes which files are orphans
watch(dirty, (now) => { if (!now) void refreshSummary() })

onMounted(() => {
  void library.ensureLoaded()
  void refreshSummary()
})
</script>

<template>
  <div
    class="ed-ui media"
    :class="{ 'media--dropping': dropping, 'media--compact': compact }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="media__toolbar">
      <input
        ref="search"
        v-model="query"
        class="ed-input media__search"
        type="search"
        :placeholder="t('mediaSearch')"
        :aria-label="t('mediaSearch')"
      />
      <button
        type="button"
        class="ed-btn ed-btn--primary"
        :class="{ 'ed-btn--icon': compact }"
        :disabled="uploading"
        :aria-label="compact ? uploadLabel : undefined"
        :title="compact ? uploadLabel : undefined"
        @click="fileInput?.click()"
      >
        <Upload :size="ICON_SIZE" />
        <span v-if="!compact">{{ uploadLabel }}</span>
      </button>
      <button v-if="!compact" type="button" class="ed-btn ed-btn--icon" :aria-label="t('mediaReload')" :disabled="loading" @click="library.load()">
        <RefreshCw :size="ICON_SIZE" />
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

    <div v-if="mode === 'manage'" class="media__storage" :aria-busy="!summary">
      <template v-if="summary">
        <span class="media__storage-total">
          {{ compact ? formatBytes(summary.totalBytes) : t('mediaStorage').replace('{size}', formatBytes(summary.totalBytes)) }}
        </span>
        <span v-if="!compact" class="media__storage-meta">{{ t('mediaStorageDerived').replace('{size}', formatBytes(summary.cacheBytes)) }}</span>
        <span class="media__storage-meta">{{ compact ? `· ${orphanText}` : orphanText }}</span>
        <button
          v-if="orphanCount"
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--danger media__sweep"
          :disabled="sweeping"
          @click="onSweep"
        >
          <Brush :size="SMALL_ICON_SIZE" />
          <span>{{ compact ? t('mediaOrphansClean') : t('mediaOrphansDelete') }}</span>
        </button>
      </template>
      <span v-else class="media__storage-placeholder">&nbsp;</span>
    </div>

    <p v-if="error" class="ed-error" role="alert">{{ error }}</p>
    <p v-if="!compact" class="ed-hint">{{ t('mediaDropHint') }}</p>

    <ul v-if="firstLoad" class="media__grid" aria-busy="true">
      <li v-for="i in SKELETON_TILES" :key="i" class="media__tile media__tile--skeleton" aria-hidden="true">
        <span class="media__card">
          <span class="media__preview"></span>
          <span class="media__name">&nbsp;</span>
          <span class="media__meta">&nbsp;</span>
        </span>
      </li>
    </ul>
    <p v-else-if="!shown.length && !error" class="media__empty">{{ emptyText }}</p>
    <ul v-else-if="shown.length" ref="grid" class="media__grid">
      <li
        v-for="(f, index) in paged"
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
            <FileThumb :file="f" :icon-size="PREVIEW_ICON_SIZE" />
            <span v-if="chosen.includes(f.id)" class="media__check"><Check :size="CHECK_ICON_SIZE" /></span>
          </span>
          <span class="media__name" :title="f.originalFilename">{{ f.originalFilename }}</span>
          <span class="media__meta" :title="metaText(f)">{{ metaText(f) }}</span>
        </component>
        <button
          v-if="mode === 'manage' && f.referenceCount === 0"
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--icon ed-btn--danger media__delete"
          :aria-label="`${t('mediaDeleteAction')} ${f.originalFilename}`"

          @click="onDelete(f, index)"
        >
          <Trash2 :size="SMALL_ICON_SIZE" />
        </button>
      </li>
    </ul>
    <button v-if="shown.length > paged.length" type="button" class="ed-btn ed-btn--ghost media__more" @click="limit += PAGE_SIZE">
      {{ t('mediaShowMore').replace('{n}', String(shown.length - paged.length)) }}
    </button>

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

/*Inset: a pane clips a ring drawn outside*/
.media--dropping { box-shadow: inset var(--editor-focus); }

/*COMPACT - inside a side panel: smaller tiles, no hint line, the whole pane catches a drop*/
.media--compact {
  --editor-media-tile: var(--editor-media-tile-compact);
  min-height: 100%;
}

/*STORAGE - one line: total, cache share, orphans, the sweep. As tall as the sweep button with or without it*/
.media__storage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--vsui-space-2xs) var(--vsui-space-sm);
  min-height: var(--editor-control);
  font-size: var(--editor-fs-xs);
}

.media__storage-placeholder {
  width: var(--site-skeleton-short);
  background-color: var(--editor-surface-raised);
  border-radius: var(--editor-radius);
}

.media--compact .media__storage { gap: var(--vsui-space-2xs) var(--vsui-space-xs); }

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media__more { align-self: center; }

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

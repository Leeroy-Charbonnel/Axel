<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { Plus, Save, Trash2 } from "lucide-vue-next"
import TextField from "../admin/fields/TextField.vue"
import UrlField from "../admin/fields/UrlField.vue"
import MediaField from "../admin/fields/MediaField.vue"
import { usePortfolio } from "../../composables/usePortfolio"
import { useConfirm } from "../../composables/useConfirm"
import { useTranslations } from "../../composables/useTranslations"
import type { MediaFile } from "../admin/media/useMediaLibrary"
import type { SoftwareDto } from "../../types/portfolio"

//SOFTWARE CATALOGUE - the logos projects list. Each row edits a local copy
//and saves it with its own button; deleting asks first. The server removes
//the logo file with the row when nothing else uses it.

interface Row { key: string; url: string; logoFileId: string | null; logoUrl: string | null }

const { data, createSoftware, updateSoftware, deleteSoftware } = usePortfolio()
const { confirm } = useConfirm()
const { t } = useTranslations()

const software = computed(() => data.value?.software ?? [])

//EDITS IN PROGRESS, per row id
const edits = reactive<Record<number, Row>>({})
const savingId = ref<number | null>(null)

function rowOf(sw: SoftwareDto): Row {
  return edits[sw.id] ?? { key: sw.key, url: sw.url, logoFileId: sw.logoFileId, logoUrl: sw.logoUrl }
}

function edit(sw: SoftwareDto, partial: Partial<Row>) {
  edits[sw.id] = { ...rowOf(sw), ...partial }
}

async function save(sw: SoftwareDto) {
  const row = edits[sw.id]
  if (!row) return
  savingId.value = sw.id
  try {
    await updateSoftware(sw.id, { key: row.key.trim(), url: row.url, logoFileId: row.logoFileId })
    delete edits[sw.id]
  } catch (e) {
    console.error("[SoftwareEditor] save failed:", e)
  } finally {
    savingId.value = null
  }
}

async function remove(sw: SoftwareDto) {
  const ok = await confirm({
    title:       t("softwareDeleteTitle"),
    what:        sw.key,
    action:      t("softwareDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  try {
    await deleteSoftware(sw.id)
    delete edits[sw.id]
  } catch (e) {
    console.error("[SoftwareEditor] delete failed:", e)
  }
}

//NEW ENTRY - POST /api/software takes the logo as multipart, so the picked
//library file is sent again as the upload
const draft = reactive<{ key: string; url: string; logo: MediaFile | null }>({ key: "", url: "", logo: null })
const adding = ref(false)
const canAdd = computed(() => draft.key.trim() !== "" && draft.logo !== null && !adding.value)

async function add() {
  const logo = draft.logo
  if (!logo) return
  adding.value = true
  try {
    const res = await fetch(logo.url)
    if (!res.ok) throw new Error(`${logo.url} returned ${res.status}`)
    const file = new File([await res.blob()], logo.originalFilename, { type: logo.mimeType })
    await createSoftware(file, draft.key.trim(), draft.url)
    Object.assign(draft, { key: "", url: "", logo: null })
  } catch (e) {
    console.error("[SoftwareEditor] create failed:", e)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <section class="software">
    <form class="software__new" @submit.prevent="add">
      <h2 class="ed-form__title">{{ t('softwareAddTitle') }}</h2>
      <div class="software__fields">
        <TextField :label="t('softwareName')" :model-value="draft.key" @update:model-value="(v) => (draft.key = v)" />
        <UrlField :label="t('softwareUrl')" :model-value="draft.url" @update:model-value="(v) => (draft.url = v)" />
      </div>
      <MediaField
        :label="t('softwareLogo')"
        accept="image"
        :url="draft.logo?.url ?? null"
        @pick="(f) => (draft.logo = f)"
        @clear="draft.logo = null"
      />
      <button type="submit" class="ed-btn ed-btn--primary software__submit" :disabled="!canAdd">
        <Plus :size="16" />
        <span>{{ adding ? t('mediaUploading') : t('softwareAdd') }}</span>
      </button>
    </form>

    <h2 class="ed-form__title">{{ t('softwareListTitle') }} ({{ software.length }})</h2>
    <p v-if="!software.length" class="ed-hint">{{ t('softwareEmpty') }}</p>

    <ul v-else class="software__list">
      <li v-for="sw in software" :key="sw.id" class="software__row">
        <MediaField
          :label="t('softwareLogo')"
          accept="image"
          :clearable="false"
          :url="rowOf(sw).logoUrl"
          @pick="(f) => edit(sw, { logoFileId: f.id, logoUrl: f.url })"
        />
        <div class="software__fields">
          <TextField :label="t('softwareName')" :model-value="rowOf(sw).key" @update:model-value="(v) => edit(sw, { key: v })" />
          <UrlField :label="t('softwareUrl')" :model-value="rowOf(sw).url" @update:model-value="(v) => edit(sw, { url: v })" />
        </div>
        <div class="software__actions">
          <button
            type="button"
            class="ed-btn ed-btn--primary"
            :disabled="!edits[sw.id] || savingId === sw.id"
            @click="save(sw)"
          >
            <Save :size="16" />
            <span>{{ t('editorSave') }}</span>
          </button>
          <button
            type="button"
            class="ed-btn ed-btn--icon ed-btn--danger"
            :aria-label="`${t('softwareDeleteAction')} ${sw.key}`"
            @click="remove(sw)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.software {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  container: editor / inline-size;
}

.software__new,
.software__row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
}

.software__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spacing-sm);
}

@container editor (min-width: 36rem) {
  .software__fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.software__submit { align-self: flex-start; }

.software__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.software__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-xxs);
}
</style>

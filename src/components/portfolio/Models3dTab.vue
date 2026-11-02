<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { Box, Pencil, Plus, Trash2 } from "lucide-vue-next"
import { useRouter } from "vue-router"
import TextField from "../admin/fields/TextField.vue"
import MediaField from "../admin/fields/MediaField.vue"
import { usePortfolio } from "../../composables/usePortfolio"
import { useConfirm } from "../../composables/useConfirm"
import { useTranslations } from "../../composables/useTranslations"
import type { MediaFile } from "../admin/media/useMediaLibrary"
import { toastOptimizeOutcome } from "../model-editor/optimizeReport"

//3D MODELS - the reusable model_3d assets. A new model is a name, a .glb and a
//thumbnail, all picked through the media library. The server optimizes the
//GLB; creating it opens the 3D editor, which sets the model up automatically.

const router = useRouter()
const { data, createModel, deleteModel } = usePortfolio()
const { confirm } = useConfirm()
const { t } = useTranslations()

const models = computed(() => data.value?.models ?? [])

const draft  = reactive<{ name: string; glb: MediaFile | null; thumbnail: MediaFile | null }>({ name: "", glb: null, thumbnail: null })
const adding = ref(false)
const canAdd = computed(() => draft.name.trim() !== "" && draft.glb !== null && draft.thumbnail !== null && !adding.value)

function pickGlb(file: MediaFile) {
  draft.glb = file
  if (!draft.name.trim()) draft.name = file.originalFilename.replace(/\.(glb|gltf)$/i, "")
}

async function add() {
  if (!draft.glb || !draft.thumbnail) return
  adding.value = true
  try {
    const created = await createModel(draft.name.trim(), draft.glb.id, draft.thumbnail.id)
    toastOptimizeOutcome(created)
    Object.assign(draft, { name: "", glb: null, thumbnail: null })
    void router.push(`/edit-3d/${created.id}`)
  } catch (e) {
    console.error("[Models3dTab] create failed:", e)
  } finally {
    adding.value = false
  }
}

async function remove(id: string, name: string) {
  const ok = await confirm({
    title:       t("modelsDeleteTitle"),
    what:        name,
    action:      t("modelsDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  try {
    await deleteModel(id)
  } catch (e) {
    //the server answers 409 while a project still uses the model; it has toasted the reason
    console.warn("[Models3dTab] delete refused:", e)
  }
}
</script>

<template>
  <section class="models">
    <form class="models__new" @submit.prevent="add">
      <h2 class="ed-form__title">{{ t('modelsAddTitle') }}</h2>
      <TextField :label="t('modelsName')" :model-value="draft.name" @update:model-value="(v) => (draft.name = v)" />
      <MediaField
        :label="t('modelsGlb')"
        accept="model"
        :url="draft.glb?.url ?? null"
        @pick="pickGlb"
        @clear="draft.glb = null"
      />
      <MediaField
        :label="t('modelsThumbnail')"
        accept="image"
        :url="draft.thumbnail?.url ?? null"
        @pick="(f) => (draft.thumbnail = f)"
        @clear="draft.thumbnail = null"
      />
      <button type="submit" class="ed-btn ed-btn--primary models__submit" :disabled="!canAdd">
        <Plus :size="16" />
        <span>{{ adding ? t('modelsAdding') : t('modelsAdd') }}</span>
      </button>
      <p v-if="adding" class="ed-hint" role="status">{{ t('modelsAddingHint') }}</p>
    </form>

    <h2 class="ed-form__title">{{ t('modelsListTitle') }} ({{ models.length }})</h2>
    <p v-if="!models.length" class="ed-hint">{{ t('modelsEmpty') }}</p>

    <ul v-else class="models__grid">
      <li v-for="m in models" :key="m.id" class="models__card">
        <div class="models__thumb">
          <img v-if="m.thumbnailUrl" :src="m.thumbnailUrl" :alt="m.name" loading="lazy" />
          <Box v-else :size="32" aria-hidden="true" />
        </div>
        <div class="models__meta">
          <span class="models__name" :title="m.name">{{ m.name }}</span>
          <span class="ed-hint">{{ t('modelsViews').replace('{n}', String(m.views.length)) }}</span>
        </div>
        <div class="models__actions">
          <RouterLink class="ed-btn" :to="`/edit-3d/${m.id}`">
            <Pencil :size="16" />
            <span>{{ t('modelsEdit') }}</span>
          </RouterLink>
          <button
            type="button"
            class="ed-btn ed-btn--icon ed-btn--danger"
            :aria-label="`${t('modelsDeleteAction')} ${m.name}`"
            @click="remove(m.id, m.name)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.models {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.models__new {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
}

.models__submit { align-self: flex-start; }

.models__grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--vsui-panel-sm), 1fr));
  gap: var(--spacing-md);
}

.models__card {
  display: flex;
  flex-direction: column;
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
}

.models__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: var(--mp-viewer-aspect);
  overflow: hidden;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
}

.models__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.models__meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-sm) var(--spacing-md);
}

.models__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-hover);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.models__actions {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-xxs);
  padding: 0 var(--spacing-md) var(--spacing-md);
}
</style>

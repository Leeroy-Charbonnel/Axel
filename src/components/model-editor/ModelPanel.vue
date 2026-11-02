<script setup lang="ts">
import { computed, ref } from "vue"
import { FileUp, Gauge, ListChecks, TriangleAlert } from "lucide-vue-next"
import { useMediaLibrary } from "../admin/media/useMediaLibrary"
import { useLang } from "../../composables/useLang"
import { apiJson, usePortfolio } from "../../composables/usePortfolio"
import { useToast } from "../../composables/useToast"
import { useTranslations } from "../../composables/useTranslations"
import { toastOptimizeOutcome } from "./optimizeReport"
import { useModelEditor } from "./useModelEditor"
import type { AutoSetupWarning } from "../../three/autoSetup"

//THE MODEL - what the file contains, what may slow it down, and the file
//itself: optimise it, replace it, copy its counts to the projects using it.
//These act at once, outside the document and its undo.

const ed = useModelEditor()
const portfolio = usePortfolio()
const media = useMediaLibrary()
const toast = useToast()
const { lang } = useLang()
const { t } = useTranslations()

const optimizing = ref(false)
const applying = ref(false)

const stats = computed(() => ed.setup.value?.stats ?? null)
const warnings = computed(() => (ed.setup.value?.warnings ?? []).map(warningText))
const num = (n: number) => n.toLocaleString(lang.value)

//a model with hundreds of bare meshes names the first few
const NAMED_MESHES_MAX = 5

function warningText(w: AutoSetupWarning): string {
  switch (w.code) {
    case "unsupportedMaterial":
      return t("autoSetupWarnUnsupportedMaterial").replace("{material}", w.material).replace("{type}", w.type)
    case "transmission":
      return t("autoSetupWarnTransmission").replace("{material}", w.material)
    case "oversizedTextures":
      return t("autoSetupWarnOversizedTextures")
        .replace("{n}", num(w.count)).replace("{limit}", num(w.limit)).replace("{largest}", num(w.largest))
    case "texturesWithoutUV": {
      const shown = w.meshes.slice(0, NAMED_MESHES_MAX).join(", ")
      const names = w.meshes.length > NAMED_MESHES_MAX ? `${shown}, ...` : shown
      return t("autoSetupWarnTexturesWithoutUV").replace("{n}", num(w.meshes.length)).replace("{names}", names)
    }
  }
}

const rows = computed(() => {
  const s = stats.value
  if (!s) return []
  const materials = Object.values(s.materials).reduce((a, b) => a + b, 0)
  const yes = t("modelEditorYes")
  const no = t("modelEditorNo")
  return [
    { label: t("modelEditorStatTriangles"), value: num(s.triangles) },
    { label: t("modelEditorStatVertices"),  value: num(s.vertices) },
    { label: t("modelEditorStatMeshes"),    value: num(s.meshes) },
    { label: t("modelEditorStatMaterials"), value: `${num(materials)} (${Object.entries(s.materials).map(([k, v]) => `${k.replace(/^Mesh|Material$/g, "")} ${v}`).join(", ")})` },
    { label: t("modelEditorStatTextures"),  value: s.textures ? `${num(s.textures)}, max ${num(s.maxTextureSize)} px` : "0" },
    { label: t("modelEditorStatUv"),        value: s.hasUV ? yes : no },
    { label: t("modelEditorStatVertexColors"), value: s.vertexColors ? yes : no },
    { label: t("modelEditorStatAnimations"), value: num(s.animations) },
    { label: t("modelEditorStatSkinned"),   value: s.skinned || s.morphTargets ? yes : no },
  ]
})

const projects = computed(() => (portfolio.data.value?.mainProjects ?? []).filter((p) => p.model3dId === ed.model.value?.id))

async function applyToProjects() {
  const s = stats.value
  if (!s || !projects.value.length) return
  applying.value = true
  try {
    for (const p of projects.value) {
      await apiJson("PUT", `/api/main-project/${p.id}`, { stats: { ...p.stats, vertices: s.vertices, triangles: s.triangles } })
    }
    await portfolio.reload()
    toast.success(t("modelEditorAppliedToProjects").replace("{n}", String(projects.value.length)))
  } catch (e) {
    //apiJson has toasted the server's reason
    console.error("[model-editor] stats to projects failed:", e)
  } finally {
    applying.value = false
  }
}

async function optimize() {
  const row = ed.model.value
  if (!row) return
  optimizing.value = true
  try {
    const res = await apiJson<{ report: { bytesBefore: number; bytesAfter: number }; glbUrl: string; sourceGlbFileId: string }>("POST", `/api/models/${row.id}/optimize`)
    toastOptimizeOutcome({ optimizeReport: res.report, optimizeError: null })
    ed.setGlb(res.glbUrl, res.sourceGlbFileId)
    await portfolio.reload()
  } catch (e) {
    console.error("[model-editor] optimize failed:", e)
  } finally {
    optimizing.value = false
  }
}

async function replace() {
  const row = ed.model.value
  if (!row) return
  const [file] = await media.pickMedia({ accept: "model" })
  if (!file) return
  try {
    await apiJson("PUT", `/api/models/${row.id}`, { glbFileId: file.id, sourceGlbFileId: null })
    ed.setGlb(file.url, null)
    await portfolio.reload()
  } catch (e) {
    console.error("[model-editor] replace failed:", e)
  }
}
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorStats') }}</h3>
      <p v-if="!stats" class="ed-hint">{{ t('modelEditorLoading') }}</p>
      <dl v-else class="mo__stats">
        <template v-for="r in rows" :key="r.label">
          <dt>{{ r.label }}</dt>
          <dd>{{ r.value }}</dd>
        </template>
      </dl>
      <button type="button" class="ed-btn mo__action" :disabled="!stats || !projects.length || applying" @click="applyToProjects">
        <ListChecks :size="16" aria-hidden="true" />
        <span>{{ t('modelEditorApplyToProjects') }}</span>
      </button>
      <p class="ed-hint">
        {{ projects.length ? t('modelEditorUsedByProjects').replace('{names}', projects.map((p) => p.title[lang] || p.title.fr || `#${p.id}`).join(', ')) : t('modelEditorNoProjects') }}
      </p>
    </section>

    <section v-if="warnings.length" class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorWarnings') }}</h3>
      <ul class="mo__warnings">
        <li v-for="w in warnings" :key="w"><TriangleAlert :size="16" aria-hidden="true" /><span>{{ w }}</span></li>
      </ul>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorFile') }}</h3>
      <template v-if="ed.model.value && !ed.model.value.sourceGlbFileId">
        <p class="ed-hint">{{ t('modelEditorOptimizeHint') }}</p>
        <button type="button" class="ed-btn ed-btn--primary mo__action" :disabled="optimizing" @click="optimize">
          <Gauge :size="16" aria-hidden="true" />
          <span>{{ optimizing ? t('modelEditorOptimizing') : t('modelEditorOptimize') }}</span>
        </button>
      </template>
      <p v-else class="ed-hint">{{ t('modelEditorOptimized') }}</p>
      <button type="button" class="ed-btn mo__action" @click="replace">
        <FileUp :size="16" aria-hidden="true" />
        <span>{{ t('modelEditorReplaceGlb') }}</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.mo__stats {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
}

.mo__stats dt { color: var(--editor-text-muted); }
.mo__stats dd {
  font-variant-numeric: tabular-nums;
  color: var(--editor-text);
  overflow-wrap: anywhere;
}

.mo__warnings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  list-style: none;
  font-size: var(--font-size-sm);
  color: var(--editor-warning);
}

.mo__warnings li {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
}

.mo__action { align-self: flex-start; }
</style>

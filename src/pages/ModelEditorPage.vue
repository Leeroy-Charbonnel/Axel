<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from "vue"
import { useRoute } from "vue-router"
import { ArrowLeft, Box, Grid3x3, Info, Palette, SlidersHorizontal, Sparkles, Sun, X } from "lucide-vue-next"
import { useConfirm } from "../composables/useConfirm"
import { isTextTarget, useEditor } from "../composables/useEditor"
import { useLang } from "../composables/useLang"
import { usePortfolio } from "../composables/usePortfolio"
import { useToast } from "../composables/useToast"
import { useTranslations } from "../composables/useTranslations"
import type { ModelViewer } from "../three/modelViewer"
import AppearancePanel from "../components/model-editor/AppearancePanel.vue"
import EditorToolbar from "../components/model-editor/EditorToolbar.vue"
import EditorViewport from "../components/model-editor/EditorViewport.vue"
import MaterialsPanel from "../components/model-editor/MaterialsPanel.vue"
import ModelPanel from "../components/model-editor/ModelPanel.vue"
import EditorTabs, { type EditorTab } from "../components/admin/EditorTabs.vue"
import ViewStrip from "../components/model-editor/ViewStrip.vue"
import WireframePanel from "../components/model-editor/WireframePanel.vue"
import { applyAutoSetup, type AutoSummary } from "../components/model-editor/autoSettings"
import { PANELS, type PanelKey, useModelEditor } from "../components/model-editor/useModelEditor"

//THE 3D MODEL EDITOR (/edit-3d/:id). The viewport shows the model through
//the public viewer; the panels edit one document saved through the edit bar
//(Save, Discard, Undo, Redo, Ctrl+S). "Reglage automatique" derives framing,
//lights, stage and sweep from the model itself; a model opened for the first
//time gets it straight away.

const route = useRoute()
const ed = useModelEditor()
const editor = useEditor()
const portfolio = usePortfolio()
const { confirm } = useConfirm()
const toast = useToast()
const { lang } = useLang()
const { t } = useTranslations()

const loadError = ref<string | null>(null)
const help = ref(false)
const drawer = ref(false)
const summary = ref<AutoSummary | null>(null)

const TABS: Record<PanelKey, { icon: Component; label: string }> = {
  appearance: { icon: Sun,     label: "modelEditorPanelAppearance" },
  materials:  { icon: Palette, label: "modelEditorPanelMaterials" },
  wireframe:  { icon: Grid3x3, label: "modelEditorPanelWireframe" },
  model:      { icon: Info,    label: "modelEditorPanelModel" },
}
//Each tab's title carries its number key
const tabs = computed<EditorTab<PanelKey>[]>(() => PANELS.map((key, i) => ({
  key, icon: TABS[key].icon, label: t(TABS[key].label), title: `${t(TABS[key].label)} (${i + 1})`,
})))

//AUTO SETUP - one undo step, previewed at once; material overrides go only
//when the admin says so
async function runAuto(firstOpen: boolean) {
  const setup = ed.setup.value
  if (!setup) return
  const overrides = ed.doc.value.settings.materials?.length ?? 0
  const resetMaterials = !firstOpen && overrides > 0 && await confirm({
    title:  t("modelEditorAutoMaterialsTitle"),
    what:   t("modelEditorAutoMaterialsWhat").replace("{n}", String(overrides)),
    action: t("modelEditorAutoMaterialsAction"),
  })
  let result: AutoSummary | null = null
  const names = autoViewNames()
  ed.change("auto-setup", (d) => {
    const r = applyAutoSetup(d.settings, d.views, setup, { resetMaterials, names })
    d.settings = r.settings
    d.views = r.views
    result = r.summary
  })
  summary.value = result
  //the viewer takes the new settings on the next flush, then flies to the new start view
  await nextTick()
  ed.viewer.value?.resetView()
}

//Without start views yet, the auto views take the names the projects already
//use for this model, so the site shows the new framing straight away.
function mostUsed(names: string[]): string | null {
  const counts = new Map<string, number>()
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function autoViewNames(): { desktop: string; phone: string } {
  const projects = (portfolio.data.value?.mainProjects ?? []).filter((p) => p.model3dId === ed.model.value?.id)
  const desktop = mostUsed(projects.map((p) => p.model3dDesktopView)) ?? t("modelEditorViewDesktop")
  const phone = mostUsed(projects.map((p) => p.model3dMobileView))
  return { desktop, phone: phone && phone !== desktop ? phone : t("modelEditorViewPhone") }
}

async function onReady(viewer: ModelViewer, firstLoad: boolean) {
  const neverSet = Object.keys(ed.saved.value.settings).length === 0
  if (firstLoad && neverSet) {
    await runAuto(true)
    toast.info(t("modelEditorAutoAppliedFirst"))
    return
  }
  viewer.playIntro()
}

function frameModel() {
  const v = ed.viewer.value
  if (v) v.flyTo(v.autoView())
}

function restView() {
  ed.viewer.value?.resetView()
}

//a new frame changes the camera's shape: go to that screen's start view once the canvas has it
watch(ed.frame, () => {
  requestAnimationFrame(() => requestAnimationFrame(restView))
})

const summaryLines = computed(() => {
  const s = summary.value
  if (!s) return []
  const n = (v: number, digits = 1) => v.toLocaleString(lang.value, { maximumFractionDigits: digits })
  const axis = ["X", "Y", "Z"][s.sweepAxis.findIndex((v) => v !== 0)] ?? "?"
  const lines = [
    t("modelEditorSummaryViews").replace("{names}", s.views.join(", ")),
    t("modelEditorSummaryZoom").replace("{min}", n(s.orbit.min, 2)).replace("{max}", n(s.orbit.max)),
    t("modelEditorSummaryLights").replace("{n}", String(s.lights)),
    t("modelEditorSummarySweep").replace("{axis}", axis).replace("{s}", n(s.sweepMs / 1000)),
  ]
  if (s.materialsReset > 0) lines.push(t("modelEditorSummaryMaterials").replace("{n}", String(s.materialsReset)))
  return lines
})

//KEYBOARD - F frames, 1 to 4 pick a panel, ? toggles the help, Escape closes
function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || isTextTarget(e.target, { editable: true })) return
  if (e.key === "f" || e.key === "F") {
    e.preventDefault()
    frameModel()
    return
  }
  const index = Number(e.key) - 1
  if (Number.isInteger(index) && index >= 0 && index < PANELS.length) {
    ed.panel.value = PANELS[index]!
    return
  }
  if (e.key === "?") {
    help.value = !help.value
    return
  }
  if (e.key === "Escape") {
    if (help.value) help.value = false
    else if (drawer.value) drawer.value = false
    else summary.value = null
  }
}

let unregister: (() => void) | null = null
let wasEditing = false

onMounted(async () => {
  wasEditing = editor.editMode.value
  await editor.setEditMode(true)
  window.addEventListener("keydown", onKeydown)
  try {
    await ed.open(String(route.params.id))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    return
  }
  unregister = editor.registerPageActions({
    save:    ed.save,
    discard: ed.discard,
    dirty:   ed.dirty,
    undo:    ed.undo,
    redo:    ed.redo,
    canUndo: ed.canUndo,
    canRedo: ed.canRedo,
  })
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown)
  unregister?.()
  if (!wasEditing) void editor.setEditMode(false)
})
</script>

<template>
  <div class="ed-ui me">
    <header class="me__head">
      <RouterLink class="ed-btn ed-btn--ghost ed-btn--icon" :to="{ path: '/settings', query: { tab: 'models' } }" :aria-label="t('modelEditorBack')" :title="t('modelEditorBack')">
        <ArrowLeft :size="16" />
      </RouterLink>
      <div class="me__title">
        <p class="me__eyebrow">{{ t('modelEditorTitle') }}</p>
        <h1 class="me__name">{{ ed.model.value?.name ?? '' }}</h1>
      </div>
      <button type="button" class="ed-btn ed-btn--primary" :disabled="!ed.setup.value" :title="t('modelEditorAutoHint')" @click="runAuto(false)">
        <Sparkles :size="16" aria-hidden="true" />
        <span>{{ t('modelEditorAuto') }}</span>
      </button>
      <button type="button" class="ed-btn me__drawer-btn" :aria-expanded="drawer" aria-controls="me-panel" @click="drawer = !drawer">
        <SlidersHorizontal :size="16" aria-hidden="true" />
        <span class="me__drawer-label">{{ t('modelEditorSettings') }}</span>
      </button>
    </header>

    <div v-if="loadError" class="me__error" role="alert">
      <Box :size="24" aria-hidden="true" />
      <p>{{ t('modelEditorOpenFailed') }}</p>
      <p class="ed-hint">{{ loadError }}</p>
    </div>

    <div v-else-if="ed.model.value" class="me__body">
      <div class="me__stage">
        <EditorToolbar v-model:help="help" @frame-model="frameModel" @rest-view="restView" />
        <div class="me__viewport">
          <EditorViewport :key="ed.model.value.id" @ready="onReady">
            <aside v-if="summary" class="me__summary" role="status" :aria-label="t('modelEditorSummaryTitle')">
              <div class="me__summary-head">
                <Sparkles :size="16" aria-hidden="true" />
                <p class="me__summary-title">{{ t('modelEditorSummaryTitle') }}</p>
                <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon me__summary-close" :aria-label="t('modelEditorClose')" @click="summary = null">
                  <X :size="16" />
                </button>
              </div>
              <ul class="me__summary-list">
                <li v-for="line in summaryLines" :key="line">{{ line }}</li>
              </ul>
              <p class="ed-hint">{{ t('modelEditorSummaryUndo') }}</p>
            </aside>
          </EditorViewport>
        </div>
        <ViewStrip />
      </div>

      <button v-if="drawer" type="button" class="me__scrim" :aria-label="t('modelEditorClose')" @click="drawer = false"></button>

      <aside id="me-panel" class="me__panel" :class="{ 'me__panel--open': drawer }" :aria-label="t('modelEditorSettings')">
        <EditorTabs v-model="ed.panel.value" class="me__tabs" :tabs="tabs" :label="t('modelEditorSettings')" id-prefix="me" padded>
          <template #end>
            <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon me__panel-close" :aria-label="t('modelEditorClose')" @click="drawer = false">
              <X :size="16" />
            </button>
          </template>
          <template #appearance><AppearancePanel /></template>
          <template #materials><MaterialsPanel /></template>
          <template #wireframe><WireframePanel /></template>
          <template #model><ModelPanel /></template>
        </EditorTabs>
      </aside>
    </div>

    <div v-else class="me__loading" role="status">
      <span class="me__skeleton me__skeleton--stage" aria-hidden="true"></span>
      <span class="me__skeleton me__skeleton--panel" aria-hidden="true"></span>
      <span class="sr-only">{{ t('modelEditorLoading') }}</span>
    </div>
  </div>
</template>

<style scoped>
.me {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  height: calc(100dvh - var(--editor-bar-offset));
  background-color: var(--editor-surface);
}

/*HEADER - one control tall*/
.me__head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs) var(--vsui-space-sm);
  border-bottom: var(--border-width) solid var(--editor-line);
}

.me__title {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: var(--vsui-space-sm);
  min-width: 0;
}

.me__eyebrow {
  flex-shrink: 0;
  font-size: var(--editor-fs-sm);
  color: var(--editor-text-muted);
}

.me__name {
  min-width: 0;
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me__drawer-btn { display: none; }

/*BODY*/
.me__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-inspector-width);
  min-height: 0;
}

.me__stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.me__viewport {
  position: relative;
  flex: 1;
  min-height: 0;
}

/*AUTO SETUP SUMMARY - over the viewport, bottom left*/
.me__summary {
  position: absolute;
  left: var(--vsui-space-sm);
  bottom: var(--vsui-space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
  width: min(var(--vsui-panel-lg), calc(100% - 2 * var(--vsui-space-sm)));
  padding: var(--vsui-space-sm) var(--vsui-space-md);
  background-color: var(--editor-surface-raised);
  border: var(--border-width) solid var(--editor-accent-line);
  border-radius: var(--editor-radius);
  box-shadow: var(--editor-shadow);
}

.me__summary-head {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-xs);
  color: var(--editor-accent);
}

.me__summary-title { font-weight: var(--font-weight-semibold); }

.me__summary-close { margin-left: auto; }

.me__summary-list {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-2xs);
  padding-left: var(--vsui-space-lg);
  font-size: var(--editor-fs-sm);
}

/*PANEL*/
.me__panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--editor-surface);
  border-left: var(--border-width) solid var(--editor-line);
}

.me__tabs {
  flex: 1;
  min-height: 0;
}

.me__panel-close { display: none; }

.me__scrim { display: none; }

/*STATES*/
.me__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xl);
  text-align: center;
  color: var(--editor-danger);
}

.me__loading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--editor-inspector-width);
  gap: var(--border-width);
}

.me__skeleton {
  display: block;
  background-color: var(--editor-surface-raised);
  animation: me-pulse var(--me-indeterminate-duration) ease-in-out infinite alternate;
}

@keyframes me-pulse {
  from { opacity: var(--me-pulse-low); }
  to   { opacity: 1; }
}

/*TABLET AND PHONE - the panel slides over the viewport*/
@media (max-width: 1024px) {
  .me__body,
  .me__loading { grid-template-columns: minmax(0, 1fr); }
  .me__skeleton--panel { display: none; }
  .me__drawer-btn { display: inline-flex; }
  .me__panel-close { display: inline-flex; flex-shrink: 0; }

  .me__panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: var(--editor-bar-offset);
    z-index: var(--editor-z-inspector);
    width: var(--me-drawer-width);
    box-shadow: var(--editor-shadow);
    transform: translateX(100%);
    visibility: hidden;
    transition: transform var(--transition-slow) ease-out, visibility 0s linear var(--transition-slow);
  }

  .me__panel--open {
    transform: none;
    visibility: visible;
    transition: transform var(--transition-slow) ease-out;
  }

  .me__scrim {
    position: fixed;
    inset: 0 0 var(--editor-bar-offset);
    z-index: var(--editor-z-inspector);
    display: block;
    background-color: var(--overlay-bg);
  }
}

/*PHONE*/
@media (max-width: 640px) {
  .me__drawer-label,
  .me__eyebrow { display: none; }
  .me__head { gap: var(--vsui-space-xs); }
}

@media (prefers-reduced-motion: reduce) {
  .me__panel,
  .me__panel--open { transition: none; }
  .me__skeleton { animation: none; }
}
</style>

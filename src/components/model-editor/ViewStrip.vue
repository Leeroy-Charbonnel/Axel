<script setup lang="ts">
import { computed, nextTick, ref } from "vue"
import { Camera, Check, Monitor, Pencil, Plus, Smartphone, Trash2, X } from "lucide-vue-next"
import { useConfirm } from "../../composables/useConfirm"
import { usePortfolio } from "../../composables/usePortfolio"
import { useToast } from "../../composables/useToast"
import { useTranslations } from "../../composables/useTranslations"
import type { DefaultView } from "../../three/types"
import type { Model3dView } from "../../types/portfolio"
import { toStartView } from "./autoSettings"
import { useModelEditor } from "./useModelEditor"

//CAMERA BOOKMARKS under the viewport. Projects and 3D blocks pick one by name;
//one can be the start view of desktop screens and one of phone screens, used
//when a project names none. Saved with everything else.

type Screen = "desktop" | "phone"

const ed = useModelEditor()
const { data } = usePortfolio()
const { confirm } = useConfirm()
const toast = useToast()
const { t } = useTranslations()

const selected = ref<string | null>(null)
const renaming = ref<string | null>(null)
const draftName = ref("")
//inside the v-for, so an array; one rename at a time
const renameInput = ref<HTMLInputElement[]>([])

const views = computed(() => ed.doc.value.views)
const defaults = computed(() => ed.doc.value.settings.defaultViews ?? {})

//how many projects and 3D blocks point at a view, by name
function usages(name: string): number {
  const id = ed.model.value?.id
  let n = 0
  for (const p of data.value?.mainProjects ?? []) {
    if (p.model3dId === id && (p.model3dDesktopView === name || p.model3dMobileView === name)) n++
    for (const b of p.detailPage?.blocks ?? []) {
      const c = b.content as { model3dId?: string; desktopView?: string; mobileView?: string }
      if (b.type === "viewer3d" && c.model3dId === id && (c.desktopView === name || c.mobileView === name)) n++
    }
  }
  return n
}

function screenOf(name: string): Screen[] {
  return (["desktop", "phone"] as const).filter((s) => defaults.value[s]?.name === name)
}

function nextName(): string {
  const base = t("modelEditorViewName")
  let i = views.value.length + 1
  while (views.value.some((v) => v.name === `${base} ${i}`)) i++
  return `${base} ${i}`
}

function capture(): Omit<Model3dView, "name"> | null {
  const v = ed.viewer.value
  if (!v) return null
  const cam = v.cameraView()
  return { position: cam.position, target: cam.target, wireframe: ed.preview.value === "wireframe", aspect: toStartView(cam, v.core.camera.aspect).aspect }
}

function asDefault(view: Model3dView): DefaultView {
  return { name: view.name, pos: view.position, target: view.target, aspect: view.aspect }
}

function add() {
  const pose = capture()
  if (!pose) return
  const name = nextName()
  ed.change("view-add", (d) => {
    d.views.push({ name, ...pose })
  })
  selected.value = name
}

function go(view: Model3dView) {
  selected.value = view.name
  const v = ed.viewer.value
  if (!v) return
  ed.preview.value = view.wireframe ? "wireframe" : "render"
  v.flyTo(v.fitView({ pos: view.position, target: view.target, aspect: view.aspect }))
}

function update(view: Model3dView) {
  const pose = capture()
  if (!pose) return
  ed.change("view-update", (d) => {
    const target = d.views.find((v) => v.name === view.name)
    if (!target) return
    Object.assign(target, pose)
    for (const s of screenOf(view.name)) d.settings.defaultViews![s] = asDefault(target)
  })
  toast.success(t("modelEditorViewUpdated").replace("{name}", view.name))
}

function setDefault(view: Model3dView, screen: Screen) {
  ed.change(`view-default-${screen}`, (d) => {
    d.settings.defaultViews = { ...(d.settings.defaultViews ?? {}), [screen]: asDefault(view) }
  })
}

async function startRename(view: Model3dView) {
  renaming.value = view.name
  draftName.value = view.name
  await nextTick()
  renameInput.value[0]?.select()
}

async function commitRename() {
  const from = renaming.value
  const to = draftName.value.trim()
  renaming.value = null
  if (!from || !to || to === from) return
  if (views.value.some((v) => v.name === to)) {
    toast.error(t("modelEditorViewNameTaken").replace("{name}", to))
    return
  }
  const used = usages(from)
  if (used > 0) {
    const ok = await confirm({
      title:  t("modelEditorViewRenameTitle"),
      what:   t("modelEditorViewUsedBy").replace("{n}", String(used)),
      action: t("modelEditorViewRenameAction"),
    })
    if (!ok) return
  }
  ed.change("view-rename", (d) => {
    const target = d.views.find((v) => v.name === from)
    if (target) target.name = to
    for (const s of ["desktop", "phone"] as const) {
      const dv = d.settings.defaultViews?.[s]
      if (dv?.name === from) dv.name = to
    }
  })
  selected.value = to
}

async function remove(view: Model3dView) {
  const used = usages(view.name)
  const ok = await confirm({
    title:       t("modelEditorViewDeleteTitle"),
    what:        used > 0 ? `${view.name} - ${t("modelEditorViewUsedBy").replace("{n}", String(used))}` : view.name,
    action:      t("modelEditorViewDeleteAction"),
    destructive: true,
  })
  if (!ok) return
  ed.change("view-delete", (d) => {
    d.views = d.views.filter((v) => v.name !== view.name)
    for (const s of ["desktop", "phone"] as const) {
      if (d.settings.defaultViews?.[s]?.name === view.name) delete d.settings.defaultViews[s]
    }
  })
  selected.value = null
}
</script>

<template>
  <section class="vs" :aria-label="t('modelEditorViews')">
    <button type="button" class="ed-btn vs__add" :disabled="!ed.viewer.value" @click="add">
      <Plus :size="16" aria-hidden="true" />
      <span>{{ t('modelEditorViewSave') }}</span>
    </button>

    <p v-if="!views.length" class="ed-hint vs__empty">{{ t('modelEditorViewsEmpty') }}</p>

    <ul v-else class="vs__list">
      <li v-for="view in views" :key="view.name" class="vs__item">
        <form v-if="renaming === view.name" class="vs__rename" @submit.prevent="commitRename">
          <input
            ref="renameInput"
            v-model="draftName"
            class="ed-input vs__rename-input"
            :aria-label="t('modelEditorViewRename')"
            @keydown.esc.stop="renaming = null"
          />
          <button type="submit" class="ed-btn ed-btn--icon ed-btn--ghost" :aria-label="t('modelEditorViewRename')"><Check :size="16" /></button>
          <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost" :aria-label="t('modelEditorCancel')" @click="renaming = null"><X :size="16" /></button>
        </form>

        <template v-else>
          <button
            type="button"
            class="ed-btn vs__chip"
            :class="{ 'ed-btn--active': selected === view.name }"
            :title="usages(view.name) ? t('modelEditorViewUsedBy').replace('{n}', String(usages(view.name))) : undefined"
            @click="go(view)"
          >
            <span class="vs__name">{{ view.name }}</span>
            <Monitor v-if="screenOf(view.name).includes('desktop')" :size="14" class="vs__badge" :aria-label="t('modelEditorViewIsDesktop')" />
            <Smartphone v-if="screenOf(view.name).includes('phone')" :size="14" class="vs__badge" :aria-label="t('modelEditorViewIsPhone')" />
          </button>
          <div v-if="selected === view.name" class="vs__actions">
            <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost" :title="t('modelEditorViewRename')" :aria-label="t('modelEditorViewRename')" @click="startRename(view)"><Pencil :size="16" /></button>
            <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost" :title="t('modelEditorViewUpdate')" :aria-label="t('modelEditorViewUpdate')" @click="update(view)"><Camera :size="16" /></button>
            <button
              type="button"
              class="ed-btn ed-btn--icon ed-btn--ghost"
              :class="{ 'ed-btn--active': screenOf(view.name).includes('desktop') }"
              :title="t('modelEditorViewSetDesktop')"
              :aria-label="t('modelEditorViewSetDesktop')"
              :aria-pressed="screenOf(view.name).includes('desktop')"
              @click="setDefault(view, 'desktop')"
            ><Monitor :size="16" /></button>
            <button
              type="button"
              class="ed-btn ed-btn--icon ed-btn--ghost"
              :class="{ 'ed-btn--active': screenOf(view.name).includes('phone') }"
              :title="t('modelEditorViewSetPhone')"
              :aria-label="t('modelEditorViewSetPhone')"
              :aria-pressed="screenOf(view.name).includes('phone')"
              @click="setDefault(view, 'phone')"
            ><Smartphone :size="16" /></button>
            <button type="button" class="ed-btn ed-btn--icon ed-btn--ghost ed-btn--danger" :title="t('modelEditorViewDeleteAction')" :aria-label="t('modelEditorViewDeleteAction')" @click="remove(view)"><Trash2 :size="16" /></button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.vs {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs) var(--vsui-space-sm);
  overflow-x: auto;
  scrollbar-width: thin;
  background-color: var(--editor-surface);
  border-top: var(--border-width) solid var(--editor-line-soft);
}

.vs__add { flex-shrink: 0; }

.vs__empty { white-space: nowrap; }

.vs__list {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  list-style: none;
}

.vs__item {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--vsui-space-2xs);
}

.vs__chip { font-size: var(--editor-fs-sm); }

.vs__name {
  max-width: var(--vsui-panel-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs__badge { flex-shrink: 0; color: var(--editor-accent); }

.vs__actions {
  display: flex;
  gap: var(--vsui-space-2xs);
}

.vs__rename {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-2xs);
}

.vs__rename-input { width: var(--vsui-panel-xs); }
</style>

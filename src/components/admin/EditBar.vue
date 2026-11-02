<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Box, Ellipsis, Eraser, LogOut, Pencil, PencilOff, Redo2, Save, SlidersHorizontal, Undo2 } from "lucide-vue-next"
import { useEditor } from "../../composables/useEditor"
import { useAdmin } from "../../composables/useAdmin"
import { useTranslations } from "../../composables/useTranslations"

//THE ADMIN BAR - the one place the admin edits from. In read mode a small
//floating pair (edit, menu); in edit mode a bar docked at the bottom with the
//editing language, the save state, undo / redo, discard and save. It also
//owns the guard that stops a navigation from dropping unsaved work.

const editor = useEditor()
const { editMode, editLang, status, dirty, saving, canUndo, canRedo } = editor
const { isAdmin, signOut } = useAdmin()
const { t } = useTranslations()
const route  = useRoute()
const router = useRouter()

//the public pages are the editable ones; any page that plugs its own actions in joins them
const visible = computed(() => isAdmin.value && (route.path === "/" || route.path.startsWith("/project/") || editor.pageActive.value))

const STATUS_KEYS = { saved: "editorStatusSaved", dirty: "editorStatusDirty", saving: "editorStatusSaving" } as const
const statusText = computed(() => t(STATUS_KEYS[status.value]))

//MENU - one registry for the entries
interface MenuEntry { key: string; icon: Component; labelKey: string; run: () => void; danger?: boolean }
const MENU: MenuEntry[] = [
  { key: "settings", icon: SlidersHorizontal, labelKey: "editorMenuSettings", run: () => { void router.push("/settings") } },
  { key: "models",   icon: Box,               labelKey: "editorMenuModels",   run: () => { void router.push({ path: "/settings", query: { tab: "models" } }) } },
  { key: "signout",  icon: LogOut,            labelKey: "signOut",            run: () => { void onSignOut() }, danger: true },
]

const menuOpen   = ref(false)
const menuHost   = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)

function runEntry(entry: MenuEntry) {
  menuOpen.value = false
  entry.run()
}

function onDocumentPointer(e: PointerEvent) {
  if (menuOpen.value && !menuHost.value?.contains(e.target as Node)) menuOpen.value = false
}

async function onMenuKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape" || !menuOpen.value) return
  e.stopPropagation()
  menuOpen.value = false
  await nextTick()
  menuButton.value?.focus()
}

async function onSignOut() {
  if (!(await editor.setEditMode(false))) return
  await signOut()
}

function toggleLang() {
  editLang.value = editLang.value === "fr" ? "en" : "fr"
}

//GUARD - a route change with unsaved work asks first
const removeGuard = router.beforeEach(async (to, from) => {
  if (to.path === from.path || !dirty.value) return true
  return editor.confirmDiscard()
})
//a selection belongs to the page it was made on
const removeAfter = router.afterEach((to, from) => {
  if (to.path !== from.path) editor.clear()
})

watch(() => visible.value && editMode.value, (docked) => {
  document.documentElement.classList.toggle("editor-editing", docked)
}, { immediate: true })

onMounted(() => document.addEventListener("pointerdown", onDocumentPointer))
onBeforeUnmount(() => {
  removeGuard()
  removeAfter()
  document.removeEventListener("pointerdown", onDocumentPointer)
  document.documentElement.classList.remove("editor-editing")
})
</script>

<template>
  <div v-if="visible" class="edit-bar" :class="{ 'edit-bar--docked': editMode }" role="region" :aria-label="t('editorBar')">
    <template v-if="!editMode">
      <button type="button" class="ed-btn" :aria-label="t('editorEnter')" @click="editor.setEditMode(true)">
        <Pencil :size="16" aria-hidden="true" />
        <span class="edit-bar__label">{{ t('editorEnter') }}</span>
      </button>
    </template>

    <template v-else>
      <button type="button" class="ed-btn ed-btn--ghost" :aria-label="t('editorExit')" @click="editor.setEditMode(false)">
        <PencilOff :size="16" aria-hidden="true" />
        <span class="edit-bar__label">{{ t('editorExit') }}</span>
      </button>

      <button
        type="button"
        class="ed-btn edit-bar__lang"
        :title="t('editorEditLangHint')"
        :aria-label="t('editorEditLang').replace('{lang}', editLang.toUpperCase())"
        @click="toggleLang"
      >
        <span :class="{ 'edit-bar__lang--on': editLang === 'fr' }">FR</span>
        <span aria-hidden="true">/</span>
        <span :class="{ 'edit-bar__lang--on': editLang === 'en' }">EN</span>
      </button>

      <p class="edit-bar__status max-sm:sr-only" :class="`edit-bar__status--${status}`" role="status">{{ statusText }}</p>

      <div class="edit-bar__actions">
        <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorUndo')" :title="t('editorUndo')" :disabled="!canUndo" @click="editor.undo()">
          <Undo2 :size="18" />
        </button>
        <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorRedo')" :title="t('editorRedo')" :disabled="!canRedo" @click="editor.redo()">
          <Redo2 :size="18" />
        </button>
        <button type="button" class="ed-btn" :aria-label="t('editorDiscard')" :disabled="!dirty || saving" @click="editor.confirmDiscard()">
          <Eraser :size="16" aria-hidden="true" />
          <span class="edit-bar__label">{{ t('editorDiscard') }}</span>
        </button>
        <button type="button" class="ed-btn ed-btn--primary edit-bar__save" :aria-label="t('editorSave')" :disabled="!dirty || saving" @click="editor.saveAll()">
          <Save :size="16" aria-hidden="true" />
          <span class="edit-bar__label">{{ t('editorSave') }}</span>
          <span v-if="dirty" class="edit-bar__save-dot" aria-hidden="true"></span>
        </button>
      </div>
    </template>

    <div ref="menuHost" class="edit-bar__menu-host" @keydown="onMenuKeydown">
      <button
        ref="menuButton"
        type="button"
        class="ed-btn ed-btn--ghost ed-btn--icon"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        :aria-label="t('editorMenu')"
        @click="menuOpen = !menuOpen"
      >
        <Ellipsis :size="18" />
      </button>
      <div v-if="menuOpen" class="edit-bar__menu" role="menu">
        <button
          v-for="entry in MENU"
          :key="entry.key"
          type="button"
          role="menuitem"
          class="edit-bar__item"
          :class="{ 'edit-bar__item--danger': entry.danger }"
          @click="runEntry(entry)"
        >
          <component :is="entry.icon" :size="16" aria-hidden="true" />
          <span>{{ t(entry.labelKey) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-bar {
  position: fixed;
  right: var(--spacing-md);
  bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  z-index: var(--editor-z-bar);
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  color: var(--editor-text);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  box-shadow: var(--vsui-shadow-lg);
}

.edit-bar--docked {
  left: 0;
  right: 0;
  bottom: 0;
  min-height: var(--editor-bar-height);
  padding: var(--spacing-xxs) var(--spacing-sm) calc(var(--spacing-xxs) + env(safe-area-inset-bottom));
  border-width: var(--border-width) 0 0;
}

.edit-bar__lang {
  gap: var(--spacing-xxs);
  color: var(--editor-text-muted);
}

.edit-bar__lang--on { color: var(--editor-accent); }

.edit-bar__status {
  flex: 1;
  min-width: 0;
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--editor-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-bar__status--dirty  { color: var(--editor-warning); }
.edit-bar__status--saving { color: var(--editor-accent); }

.edit-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
}

.edit-bar__save { position: relative; }

.edit-bar__save-dot {
  position: absolute;
  top: var(--spacing-xxs);
  right: var(--spacing-xxs);
  display: none;
  width: var(--spacing-xs);
  height: var(--spacing-xs);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-warning);
}

/*MENU*/
.edit-bar__menu-host { position: relative; }

.edit-bar__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--spacing-sm));
  display: flex;
  flex-direction: column;
  min-width: var(--editor-menu-width);
  padding: var(--spacing-xxs);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  box-shadow: var(--vsui-shadow-lg);
}

.edit-bar__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--editor-target);
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-sm);
  text-align: left;
  color: var(--editor-text);
}

.edit-bar__item:hover { background-color: var(--editor-surface-raised); }
.edit-bar__item:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.edit-bar__item--danger { color: var(--editor-danger); }

/*PHONE - icons only, the state moves onto the save button*/
@media (max-width: 640px) {
  .edit-bar__label { display: none; }
  .edit-bar--docked { justify-content: space-between; }
  .edit-bar__save-dot { display: block; }
}
</style>

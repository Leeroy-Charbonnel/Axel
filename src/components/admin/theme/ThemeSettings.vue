<script setup lang="ts">
import { Eraser, Save } from "lucide-vue-next"
import ThemeEditor from "./ThemeEditor.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"

//Theme tab of the settings: the editor, then the editor's own discard and save

const editor = useEditor()
const { dirty, saving } = editor
const { t } = useTranslations()
</script>

<template>
  <div class="theme-settings ed-ui">
    <ThemeEditor />
    <div class="theme-settings__actions">
      <button type="button" class="ed-btn" :disabled="!dirty || saving" @click="editor.confirmDiscard()">
        <Eraser class="theme-settings__icon" aria-hidden="true" />
        {{ t("editorDiscard") }}
      </button>
      <button type="button" class="ed-btn ed-btn--primary" :disabled="!dirty || saving" @click="editor.saveAll()">
        <Save class="theme-settings__icon" aria-hidden="true" />
        {{ t("editorSave") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.theme-settings {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-lg);
  max-width: var(--editor-inspector-width);
}

.theme-settings__actions {
  display: flex;
  gap: var(--vsui-space-sm);
  padding-top: var(--vsui-space-md);
  border-top: var(--border-width) solid var(--editor-line-soft);
}

.theme-settings__icon {
  width: var(--editor-icon);
  height: var(--editor-icon);
}
</style>

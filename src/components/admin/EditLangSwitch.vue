<script setup lang="ts">
import { useEditor } from "../../composables/useEditor"
import { useTranslations } from "../../composables/useTranslations"
import { LANGS } from "../../lib/lang"

//THE LANGUAGE BEING EDITED, which is also the site's language. Same
//registry as the public switch, drawn as an editor control

const { editLang } = useEditor()
const { t } = useTranslations()
</script>

<template>
  <div class="ed-lang" role="group" :aria-label="t('editorLangHint')" :title="t('editorLangHint')">
    <button
      v-for="item in LANGS"
      :key="item.code"
      type="button"
      class="ed-lang__btn"
      :lang="item.code"
      :aria-pressed="editLang === item.code"
      :aria-label="item.name"
      @click="editLang = item.code"
    >
      {{ item.code.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.ed-lang {
  display: flex;
  flex-shrink: 0;
  padding: var(--vsui-space-2xs);
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}

.ed-lang__btn {
  min-width: var(--editor-control);
  min-height: calc(var(--editor-control) - 2 * var(--vsui-space-2xs));
  padding: 0 var(--vsui-space-sm);
  font-size: var(--editor-fs-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text-muted);
  border-radius: var(--editor-radius);
  cursor: pointer;
}

.ed-lang__btn:hover { color: var(--editor-text); }
.ed-lang__btn:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.ed-lang__btn[aria-pressed="true"] {
  color: var(--editor-text);
  background-color: var(--editor-surface-raised);
}
</style>

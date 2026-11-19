<script setup lang="ts">
import Field from "../fields/Field.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import { LABEL_GROUPS, labelFieldId } from "../labels"

//THE FIXED TEXTS OF THE HOME PAGE, by section, in the site's language. Each
//field is named by its saved text and holds the draft the page shows.

const editor = useEditor()
const { t } = useTranslations()

//A label cannot be empty: it gets its saved text back
function onChange(key: string) {
  if (editor.label(key).trim() === "") editor.setLabel(key, t(key))
}
</script>

<template>
  <div class="ed-form">
    <section v-for="group in LABEL_GROUPS" :key="group.titleKey" class="ed-form__section">
      <h3 class="ed-form__title">{{ t(group.titleKey) }}</h3>
      <div v-for="key in group.keys" :key="key" :data-field="labelFieldId(key)">
        <Field :label="t(key)" v-slot="{ id }">
          <input
            :id="id"
            class="ed-input"
            :class="{ 'labels__input--dirty': editor.isLabelDirty(key) }"
            :lang="editor.editLang.value"
            :value="editor.label(key)"
            @input="editor.setLabel(key, ($event.target as HTMLInputElement).value)"
            @change="onChange(key)"
          />
        </Field>
      </div>
    </section>
  </div>
</template>

<style scoped>
.labels__input--dirty { border-color: var(--editor-warning); }
</style>

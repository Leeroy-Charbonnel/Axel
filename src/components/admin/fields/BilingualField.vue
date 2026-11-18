<script setup lang="ts">
import { computed } from "vue"
import Field from "./Field.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { Bilingual } from "../../../types/portfolio"
import type { Lang } from "../../../lib/lang"

//ONE TEXT IN TWO LANGUAGES, one control: it edits the site's current language.
//Switching the site language switches the value. A dot on the label says the
//other language is still empty.

const TEXTAREA_ROWS = 4

const props = withDefaults(defineProps<{
  label:      string
  modelValue: Bilingual
  multiline?: boolean
  rows?:      number
  hint?:      string
}>(), { multiline: false, rows: TEXTAREA_ROWS })

const emit = defineEmits<{ "update:modelValue": [value: Bilingual] }>()
const { editLang } = useEditor()
const { t } = useTranslations()

const otherLang  = computed<Lang>(() => editLang.value === "fr" ? "en" : "fr")
const otherEmpty = computed(() => props.modelValue[otherLang.value].trim() === "")
const missingText = computed(() => t("fieldOtherLangEmpty").replace("{lang}", otherLang.value.toUpperCase()))
//The accessible name says which language the control writes
const controlName = computed(() => `${props.label} (${editLang.value.toUpperCase()})`)

function set(value: string) {
  emit("update:modelValue", { ...props.modelValue, [editLang.value]: value })
}
</script>

<template>
  <Field :label="label" :hint="hint">
    <template #aside>
      <span v-if="otherEmpty" class="ed-bi__missing" :title="missingText">
        <span class="sr-only">{{ missingText }}</span>
      </span>
      <span class="ed-bi__lang">{{ editLang.toUpperCase() }}</span>
    </template>
    <template #default="{ id, describedBy }">
      <textarea
        v-if="multiline"
        :id="id"
        class="ed-input"
        :rows="rows"
        :lang="editLang"
        :aria-label="controlName"
        :aria-describedby="describedBy"
        :value="modelValue[editLang]"
        @input="set(($event.target as HTMLTextAreaElement).value)"
      />
      <input
        v-else
        :id="id"
        class="ed-input"
        type="text"
        :lang="editLang"
        :aria-label="controlName"
        :aria-describedby="describedBy"
        :value="modelValue[editLang]"
        @input="set(($event.target as HTMLInputElement).value)"
      />
    </template>
  </Field>
</template>

<style scoped>
.ed-bi__lang {
  font-size: var(--editor-fs-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-accent);
}

.ed-bi__missing {
  width: var(--vsui-space-xs);
  height: var(--vsui-space-xs);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-warning);
}
</style>

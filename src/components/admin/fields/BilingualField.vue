<script setup lang="ts">
import { computed } from "vue"
import Field from "./Field.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { Bilingual } from "../../../types/portfolio"
import type { Lang } from "../../../lib/lang"

//BOTH LANGUAGES OF ONE TEXT, one row each. The language being edited is
//highlighted; a dot on the label says the other one is still empty.

const LANGS: Lang[] = ["fr", "en"]
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

function set(lang: Lang, value: string) {
  emit("update:modelValue", { ...props.modelValue, [lang]: value })
}
</script>

<template>
  <Field :label="label" :hint="hint" group>
    <template #aside>
      <span
        v-if="otherEmpty"
        class="ed-bi__missing"
        :title="t('fieldOtherLangEmpty').replace('{lang}', otherLang.toUpperCase())"
      >
        <span class="sr-only">{{ t('fieldOtherLangEmpty').replace('{lang}', otherLang.toUpperCase()) }}</span>
      </span>
    </template>
    <template #default="{ labelId, describedBy }">
      <div class="ed-bi" role="group" :aria-labelledby="labelId" :aria-describedby="describedBy">
        <label
          v-for="lang in LANGS"
          :key="lang"
          class="ed-bi__col"
          :class="{ 'ed-bi__col--active': lang === editLang }"
        >
          <span class="ed-bi__lang">{{ lang.toUpperCase() }}</span>
          <textarea
            v-if="multiline"
            class="ed-input"
            :rows="rows"
            :lang="lang"
            :value="modelValue[lang]"
            @input="set(lang, ($event.target as HTMLTextAreaElement).value)"
          />
          <input
            v-else
            class="ed-input"
            type="text"
            :lang="lang"
            :value="modelValue[lang]"
            @input="set(lang, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </template>
  </Field>
</template>

<style scoped>
/*one control per language, the tag drawn inside its left edge, so a bilingual
field lines up with the single-language ones*/
.ed-bi {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
}

.ed-bi__col {
  position: relative;
  display: block;
  min-width: 0;
}

.ed-bi__col .ed-input { padding-left: var(--editor-control); }

.ed-bi__lang {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--editor-control);
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--editor-control);
  font-size: var(--editor-fs-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text-muted);
  pointer-events: none;
}

.ed-bi__col--active .ed-bi__lang { color: var(--editor-accent); }

.ed-bi__missing {
  width: var(--vsui-space-xs);
  height: var(--vsui-space-xs);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-warning);
}
</style>

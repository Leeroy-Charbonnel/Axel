<script setup lang="ts">
import { computed } from "vue"
import Field from "./Field.vue"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { Bilingual } from "../../../types/portfolio"
import type { Lang } from "../../../lib/lang"

//BOTH LANGUAGES OF ONE TEXT. Side by side when the panel is wide enough,
//stacked otherwise. The language being edited is highlighted; a dot on the
//label says the other one is still empty.

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
.ed-bi {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spacing-xs);
}

@container editor (min-width: 26rem) {
  .ed-bi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.ed-bi__col {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
}

.ed-bi__lang {
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-tight);
  color: var(--editor-text-muted);
}

.ed-bi__col--active .ed-bi__lang { color: var(--editor-accent); }
.ed-bi__col--active .ed-input { border-color: var(--editor-accent-line); }
.ed-bi__col--active .ed-input:focus-visible { border-color: var(--editor-accent); }

.ed-bi__missing {
  width: var(--spacing-xs);
  height: var(--spacing-xs);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-warning);
}
</style>

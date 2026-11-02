<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../fields/BilingualField.vue"
import TextField from "../fields/TextField.vue"
import ListField from "../fields/ListField.vue"
import { useEditor, type DraftOf } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { Bilingual, ExperienceDto } from "../../../types/portfolio"

const props = defineProps<{ entity: ExperienceDto }>()
const editor = useEditor()
const { t } = useTranslations()

const e = computed(() => editor.display("experience", props.entity))
function set(partial: DraftOf<"experience">) {
  editor.patch("experience", props.entity.id, partial)
}

//one bullet edits both languages together; the stored shape is one list per language
const bullets = computed<Bilingual[]>(() => {
  const { fr, en } = e.value.description
  return Array.from({ length: Math.max(fr.length, en.length) }, (_, i) => ({ fr: fr[i] ?? "", en: en[i] ?? "" }))
})
function setBullets(list: Bilingual[]) {
  set({ description: { fr: list.map((b) => b.fr), en: list.map((b) => b.en) } })
}
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionContent') }}</h3>
      <BilingualField :label="t('fieldPeriod')" :model-value="e.period" @update:model-value="(v) => set({ period: v })" />
      <BilingualField :label="t('fieldJobTitle')" :model-value="e.title" @update:model-value="(v) => set({ title: v })" />
      <div class="ed-form__grid">
        <TextField :label="t('fieldCompany')" :model-value="e.company" @update:model-value="(v) => set({ company: v })" />
        <TextField :label="t('fieldLocation')" :model-value="e.location" @update:model-value="(v) => set({ location: v })" />
      </div>
      <BilingualField
        :label="t('fieldSummary')"
        multiline
        :model-value="e.summary"
        @update:model-value="(v) => set({ summary: v })"
      />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionBullets') }}</h3>
      <ListField
        :label="t('fieldBullets')"
        :add-label="t('fieldAddBullet')"
        :model-value="bullets"
        :create="() => ({ fr: '', en: '' })"
        @update:model-value="setBullets"
      >
        <template #item="{ item, index, update }">
          <BilingualField
            :label="`${t('fieldBullet')} ${index + 1}`"
            :model-value="item"
            @update:model-value="update"
          />
        </template>
      </ListField>
    </section>
  </div>
</template>

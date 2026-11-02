<script setup lang="ts">
import { computed, reactive } from "vue"
import BilingualField from "../admin/fields/BilingualField.vue"
import ListField from "../admin/fields/ListField.vue"
import MediaField from "../admin/fields/MediaField.vue"
import ModelField from "../admin/fields/ModelField.vue"
import NumberField from "../admin/fields/NumberField.vue"
import SelectField from "../admin/fields/SelectField.vue"
import SoftwareField from "../admin/fields/SoftwareField.vue"
import TextField from "../admin/fields/TextField.vue"
import TextareaField from "../admin/fields/TextareaField.vue"
import ToggleField from "../admin/fields/ToggleField.vue"
import UrlField from "../admin/fields/UrlField.vue"
import { useTranslations } from "../../composables/useTranslations"
import type { SoftwareDto } from "../../types/portfolio"

//EVERY SHARED ADMIN FIELD, live, on local state: nothing here is saved
const { t } = useTranslations()

const state = reactive({
  title:    { fr: "Fauteuil Atelier", en: "Atelier armchair" },
  year:     "2025",
  summary:  "",
  count:    95640,
  url:      "https://www.artstation.com/",
  fit:      "cover",
  on:       true,
  imageUrl: null as string | null,
  bullets:  ["Blocking", "UV"],
  model:    { model3dId: null as string | null, desktopView: "", mobileView: "" },
  software: [] as SoftwareDto[],
})
const fits = computed(() => [
  { value: "cover",   label: t("blockFitCover") },
  { value: "contain", label: t("blockFitContain") },
])
</script>

<template>
  <div class="sgf">
    <BilingualField :label="t('fieldTitle')" v-model="state.title" />
    <div class="ed-form__grid">
      <TextField :label="t('fieldYear')" v-model="state.year" />
      <NumberField :label="t('projectsStatTriangles')" v-model="state.count" />
    </div>
    <TextareaField :label="t('fieldSummary')" v-model="state.summary" :placeholder="t('styleguideSampleText')" />
    <UrlField :label="t('fieldLink')" :hint="t('fieldLinkHint')" v-model="state.url" />
    <SelectField :label="t('blockFieldFit')" v-model="state.fit" :options="fits" />
    <ToggleField :label="t('fieldAvailable')" :hint="t('fieldAvailabilityHint')" v-model="state.on" />
    <MediaField
      :label="t('fieldImage')"
      accept="image"
      :url="state.imageUrl"
      @pick="(f) => (state.imageUrl = f.url)"
      @clear="state.imageUrl = null"
    />
    <ListField :label="t('fieldBullets')" :add-label="t('fieldAddBullet')" v-model="state.bullets" :create="() => ''">
      <template #item="{ item, update }">
        <TextField :label="t('fieldBullet')" :model-value="item" @update:model-value="update" />
      </template>
    </ListField>
    <ModelField :label="t('fieldModel')" v-model="state.model" />
    <SoftwareField :label="t('fieldSoftware')" v-model="state.software" />
  </div>
</template>

<style scoped>
.sgf {
  container: editor / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: var(--editor-inspector-width);
  padding: var(--spacing-lg);
  color: var(--editor-text);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
}
</style>

<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../fields/BilingualField.vue"
import TextField from "../fields/TextField.vue"
import ToggleField from "../fields/ToggleField.vue"
import UrlField from "../fields/UrlField.vue"
import MediaField from "../fields/MediaField.vue"
import ListField from "../fields/ListField.vue"
import { useEditor, type DraftOf } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { ProfileDto, ProfileLinks } from "../../../types/portfolio"

const props = defineProps<{ entity: ProfileDto }>()
const editor = useEditor()
const { t } = useTranslations()

const p = computed(() => editor.display("profile", props.entity))
function set(partial: DraftOf<"profile">) {
  editor.patch("profile", null, partial)
}

const LINKS: { key: keyof ProfileLinks; labelKey: string }[] = [
  { key: "artstation", labelKey: "fieldLinkArtstation" },
  { key: "sketchfab",  labelKey: "fieldLinkSketchfab" },
  { key: "linkedin",   labelKey: "fieldLinkLinkedin" },
  { key: "instagram",  labelKey: "fieldLinkInstagram" },
  { key: "website",    labelKey: "fieldLinkWebsite" },
]

const INTERESTS: { key: keyof ProfileDto["interests"]; labelKey: string }[] = [
  { key: "games", labelKey: "experienceGames" },
  { key: "art",   labelKey: "experienceArt" },
]
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionIdentity') }}</h3>
      <TextField :label="t('fieldName')" :model-value="p.name" autocomplete="name" @update:model-value="(v) => set({ name: v })" />
      <BilingualField :label="t('fieldHeadline')" :model-value="p.headline" @update:model-value="(v) => set({ headline: v })" />
      <TextField :label="t('fieldLocation')" :model-value="p.location" @update:model-value="(v) => set({ location: v })" />
      <MediaField
        :label="t('fieldAvatar')"
        accept="image"
        :url="p.avatarUrl || null"
        @pick="(f) => set({ avatarUrl: f.url })"
        @clear="set({ avatarUrl: '' })"
      />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionHero') }}</h3>
      <BilingualField :label="t('fieldPitch')" multiline :model-value="p.pitch" @update:model-value="(v) => set({ pitch: v })" />
      <ToggleField :label="t('fieldAvailable')" :model-value="p.available" @update:model-value="(v) => set({ available: v })" />
      <BilingualField
        :label="t('fieldAvailability')"
        :hint="t('fieldAvailabilityHint')"
        :model-value="p.availability"
        @update:model-value="(v) => set({ availability: v })"
      />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionAbout') }}</h3>
      <BilingualField :label="t('fieldAbout')" multiline :model-value="p.about" @update:model-value="(v) => set({ about: v })" />
      <ListField
        v-for="i in INTERESTS"
        :key="i.key"
        :label="t(i.labelKey)"
        :add-label="t('fieldAddInterest')"
        :model-value="p.interests[i.key]"
        :create="() => ''"
        @update:model-value="(v) => set({ interests: { ...p.interests, [i.key]: v } })"
      >
        <template #item="{ item, index, update }">
          <TextField :label="`${t(i.labelKey)} ${index + 1}`" :model-value="item" @update:model-value="update" />
        </template>
      </ListField>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionContact') }}</h3>
      <TextField
        :label="t('email')"
        type="email"
        autocomplete="email"
        :model-value="p.contact.email"
        @update:model-value="(v) => set({ contact: { ...p.contact, email: v } })"
      />
      <TextField
        :label="t('fieldPhone')"
        type="tel"
        autocomplete="tel"
        :model-value="p.contact.phone"
        @update:model-value="(v) => set({ contact: { ...p.contact, phone: v } })"
      />
      <UrlField
        v-for="l in LINKS"
        :key="l.key"
        :label="t(l.labelKey)"
        :model-value="p.links[l.key]"
        @update:model-value="(v) => set({ links: { ...p.links, [l.key]: v } })"
      />
      <MediaField
        :label="t('fieldCv')"
        accept="document"
        :url="p.cvUrl"
        @pick="(f) => set({ cvUrl: f.url })"
        @clear="set({ cvUrl: null })"
      />
    </section>
  </div>
</template>

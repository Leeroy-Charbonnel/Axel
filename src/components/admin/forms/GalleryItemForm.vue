<script setup lang="ts">
import { computed } from "vue"
import BilingualField from "../fields/BilingualField.vue"
import UrlField from "../fields/UrlField.vue"
import MediaField from "../fields/MediaField.vue"
import StatsFields from "./StatsFields.vue"
import { useEditor, type DraftOf } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { GalleryProjectDto } from "../../../types/portfolio"

const props = defineProps<{ entity: GalleryProjectDto }>()
const editor = useEditor()
const { t } = useTranslations()

const g = computed(() => editor.display("galleryItem", props.entity))
function set(partial: DraftOf<"galleryItem">) {
  editor.patch("galleryItem", props.entity.id, partial)
}
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionContent') }}</h3>
      <BilingualField :label="t('fieldTitle')" :model-value="g.title" @update:model-value="(v) => set({ title: v })" />
      <UrlField :label="t('fieldLink')" :hint="t('fieldLinkHint')" :model-value="g.link" @update:model-value="(v) => set({ link: v })" />
      <MediaField
        :label="t('fieldImage')"
        accept="image"
        :url="g.imageUrl"
        @pick="(f) => set({ imageUrl: f.url, imageFileId: f.id })"
        @clear="set({ imageUrl: null, imageFileId: null })"
      />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionStats') }}</h3>
      <StatsFields :model-value="g.stats" @update:model-value="(v) => set({ stats: v })" />
    </section>
  </div>
</template>

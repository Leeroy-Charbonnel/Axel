<script setup lang="ts">
import { computed } from "vue"
import { Box, ExternalLink } from "lucide-vue-next"
import BilingualField from "../fields/BilingualField.vue"
import TextField from "../fields/TextField.vue"
import MediaField from "../fields/MediaField.vue"
import ListField from "../fields/ListField.vue"
import ModelField, { type ModelChoice } from "../fields/ModelField.vue"
import SoftwareField from "../fields/SoftwareField.vue"
import StatsFields from "./StatsFields.vue"
import { useEditor, type DraftOf } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import type { MainProjectDto, ThumbnailDto } from "../../../types/portfolio"

const props = defineProps<{ entity: MainProjectDto }>()
const editor = useEditor()
const { t } = useTranslations()

const p = computed(() => editor.display("mainProject", props.entity))
function set(partial: DraftOf<"mainProject">) {
  editor.patch("mainProject", props.entity.id, partial)
}

const model = computed<ModelChoice>(() => ({
  model3dId:   p.value.model3dId,
  desktopView: p.value.model3dDesktopView,
  mobileView:  p.value.model3dMobileView,
}))
function setModel(v: ModelChoice) {
  set({ model3dId: v.model3dId, model3dDesktopView: v.desktopView, model3dMobileView: v.mobileView })
}

const newThumbnail = (): ThumbnailDto => ({
  fileId: null, wireframeFileId: null, url: null, wireframeUrl: null, description: { fr: "", en: "" },
})
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionContent') }}</h3>
      <BilingualField :label="t('fieldTitle')" :model-value="p.title" @update:model-value="(v) => set({ title: v })" />
      <BilingualField :label="t('fieldRole')" :model-value="p.role" @update:model-value="(v) => set({ role: v })" />
      <TextField :label="t('fieldYear')" :model-value="p.year" @update:model-value="(v) => set({ year: v })" />
      <BilingualField
        :label="t('fieldDescription')"
        multiline
        :model-value="p.description"
        @update:model-value="(v) => set({ description: v })"
      />
      <RouterLink class="ed-form__link" :to="`/project/${entity.id}`">
        <ExternalLink :size="14" />
        <span>{{ t('formOpenDetailPage') }}</span>
      </RouterLink>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionVisuals') }}</h3>
      <MediaField
        :project="entity.id"
        :label="t('fieldMainImage')"
        accept="image"
        :url="p.mainImageUrl"
        @pick="(f) => set({ mainImageUrl: f.url, mainImageFileId: f.id })"
        @clear="set({ mainImageUrl: null, mainImageFileId: null })"
      />
      <MediaField
        :project="entity.id"
        :label="t('fieldWireframeImage')"
        accept="image"
        :url="p.mainWireframeUrl"
        @pick="(f) => set({ mainWireframeUrl: f.url, mainWireframeFileId: f.id })"
        @clear="set({ mainWireframeUrl: null, mainWireframeFileId: null })"
      />
      <ListField
        :label="t('fieldThumbnails')"
        :add-label="t('fieldAddThumbnail')"
        :model-value="p.thumbnails"
        :create="newThumbnail"
        @update:model-value="(v) => set({ thumbnails: v })"
      >
        <template #item="{ item, update }">
          <div class="ed-thumb">
            <MediaField
        :project="entity.id"
              compact
              :label="t('fieldImage')"
              accept="image"
              :url="item.url"
              @pick="(f) => update({ ...item, url: f.url, fileId: f.id })"
              @clear="update({ ...item, url: null, fileId: null })"
            />
            <MediaField
        :project="entity.id"
              compact
              :label="t('fieldWireframeImage')"
              accept="image"
              :url="item.wireframeUrl"
              @pick="(f) => update({ ...item, wireframeUrl: f.url, wireframeFileId: f.id })"
              @clear="update({ ...item, wireframeUrl: null, wireframeFileId: null })"
            />
            <BilingualField
              class="ed-thumb__caption"
              :label="t('fieldCaption')"
              :model-value="item.description"
              @update:model-value="(v) => update({ ...item, description: v })"
            />
          </div>
        </template>
      </ListField>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSection3d') }}</h3>
      <ModelField :label="t('fieldModel')" :model-value="model" @update:model-value="setModel" />
      <RouterLink v-if="p.model3dId" class="ed-form__link" :to="`/edit-3d/${p.model3dId}`">
        <Box :size="14" />
        <span>{{ t('formOpenModelEditor') }}</span>
      </RouterLink>
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionStats') }}</h3>
      <StatsFields :model-value="p.stats" @update:model-value="(v) => set({ stats: v })" />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('formSectionSoftware') }}</h3>
      <SoftwareField :label="t('fieldSoftware')" :model-value="p.software" @update:model-value="(v) => set({ software: v })" />
    </section>
  </div>
</template>

<style scoped>
/*One thumbnail on one line: image, wireframe, caption*/
.ed-thumb {
  display: flex;
  align-items: flex-start;
  gap: var(--vsui-space-sm);
}

.ed-thumb__caption {
  flex: 1;
  min-width: 0;
}
</style>

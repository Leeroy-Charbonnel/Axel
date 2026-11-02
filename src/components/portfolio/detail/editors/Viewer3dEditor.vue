<script setup lang="ts">
import { computed } from "vue"
import ModelField, { type ModelChoice } from "../../../admin/fields/ModelField.vue"
import SelectField from "../../../admin/fields/SelectField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { Viewer3dBlockContent, Viewer3dLook } from "../../../../types/portfolio"

const props = defineProps<{ content: Viewer3dBlockContent }>()
const { t } = useTranslations()

const looks = computed<{ value: Viewer3dLook; label: string }[]>(() => [
  { value: "render",    label: t("blockLookRender") },
  { value: "blueprint", label: t("blockLookBlueprint") },
])

function apply(v: ModelChoice) {
  Object.assign(props.content, v)
}
</script>

<template>
  <ModelField :label="t('fieldModel')" :hint="t('blockHintViewer3d')" :model-value="props.content" @update:model-value="apply" />
  <SelectField
    :label="t('blockFieldLook')"
    :model-value="props.content.look ?? 'render'"
    :options="looks"
    @update:model-value="(v) => (props.content.look = v)"
  />
</template>

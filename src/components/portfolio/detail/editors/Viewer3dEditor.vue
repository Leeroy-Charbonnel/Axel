<script setup lang="ts">
import ModelField, { type ModelChoice } from "../../../admin/fields/ModelField.vue"
import { useTranslations } from "../../../../composables/useTranslations"
import type { Viewer3dBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: Viewer3dBlockContent }>()
const { t } = useTranslations()

function apply(v: ModelChoice) {
  Object.assign(props.content, v)
}
</script>

<template>
  <ModelField :label="t('fieldModel')" :hint="t('blockHintViewer3d')" :model-value="props.content" @update:model-value="apply" />
</template>

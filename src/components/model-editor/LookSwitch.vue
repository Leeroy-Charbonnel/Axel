<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../composables/useTranslations"
import SegmentedControl from "./SegmentedControl.vue"
import { useModelEditor } from "./useModelEditor"

//WHICH LOOK IS BEING EDITED: the environment and each light's intensity and
//colour exist once for the render and once for the wireframe. The look edited
//is the look the viewport shows.

export type Look = "normal" | "wireframe"

const ed = useModelEditor()
const { t } = useTranslations()

const look = computed<Look>(() => (ed.preview.value === "wireframe" ? "wireframe" : "normal"))
const looks = computed<{ value: Look; label: string }[]>(() => [
  { value: "normal",    label: t("modelEditorLookNormal") },
  { value: "wireframe", label: t("modelEditorLookWireframe") },
])

function setLook(v: Look) {
  ed.preview.value = v === "wireframe" ? "wireframe" : "render"
}
</script>

<template>
  <SegmentedControl :label="t('modelEditorLook')" :model-value="look" :options="looks" @update:model-value="setLook" />
</template>

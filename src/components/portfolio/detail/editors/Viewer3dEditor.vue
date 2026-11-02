<script setup lang="ts">
import ModelField from "../../../admin/fields/ModelField.vue"
import type { Viewer3dBlockContent } from "../../../../types/portfolio"

const props = defineProps<{ content: Viewer3dBlockContent }>()
const emit = defineEmits<{ (e: "dirty"): void; (e: "structural"): void }>()

function apply(v: Viewer3dBlockContent) {
  Object.assign(props.content, v)
  emit("dirty")
}
</script>

<template>
  <p class="dp-hint">
    Pick which 3D model to embed and which named view to show on desktop /
    mobile. Models + views are managed in Settings → 3D Models and per-model
    from the Views tab of the 3D editor.
  </p>
  <ModelField label="3D" :model-value="content" @update:model-value="apply" />
</template>

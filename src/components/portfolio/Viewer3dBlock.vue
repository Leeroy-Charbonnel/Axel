<script setup lang="ts">
import { computed } from "vue"
import { usePortfolio } from "../../composables/usePortfolio"
import { viewerSettingsFor } from "../../composables/useEffectiveViewerSettings"
import ThreeViewer from "./ThreeViewer.vue"

//A viewer3d detail-page block: the picked model seen through the view named for
//this breakpoint. Renders nothing while no model is picked or the id is unknown.

const props = defineProps<{
  content: { model3dId: string | null; desktopView: string; mobileView: string }
  mobile?: boolean
  //how wide the block is drawn, for the poster
  sizes:   string
}>()

const { data } = usePortfolio()

const resolved = computed(() => {
  const c = props.content
  if (!c.model3dId) return null
  const model = data.value?.models.find((m) => m.id === c.model3dId)
  if (!model || !model.glbUrl) return null
  const viewName = props.mobile ? (c.mobileView || c.desktopView) : c.desktopView
  return {
    glbUrl:   model.glbUrl,
    settings: viewerSettingsFor(model, viewName, data.value?.editorPrefs),
    poster:   model.thumbnailUrl,
    alt:      model.name,
  }
})
</script>

<template>
  <ThreeViewer
    v-if="resolved"
    :glb-url="resolved.glbUrl"
    :settings="resolved.settings"
    :poster="resolved.poster"
    :poster-sizes="sizes"
    :alt="resolved.alt"
  />
</template>

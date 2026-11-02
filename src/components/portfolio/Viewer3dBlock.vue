<script setup lang="ts">
import { computed } from "vue"
import { usePortfolio } from "../../composables/usePortfolio"
import { viewerSettingsFor } from "../../composables/useEffectiveViewerSettings"
import { BLUEPRINT_LOOK } from "../../lib/viewer-defaults"
import type { ViewerSettings } from "../../three/types"
import type { Viewer3dBlockContent } from "../../types/portfolio"
import ThreeViewer from "./ThreeViewer.vue"

//A viewer3d detail-page block: the picked model seen through the view named for
//this breakpoint. Renders nothing while no model is picked or the id is unknown.
//The blueprint look stays in wireframe mode, white edges over clear surfaces,
//with no floor and no mode buttons: it is a plan, not a second render.

const props = defineProps<{
  content: Viewer3dBlockContent
  mobile?: boolean
  //how wide the block is drawn, for the poster
  sizes:   string
}>()

const { data } = usePortfolio()

const blueprint = computed(() => props.content.look === "blueprint")

function asBlueprint(s: ViewerSettings): ViewerSettings {
  return {
    ...s,
    //no floor, no shadow, no glow: a plan has no light
    stage: { ...s.stage, ground: false },
    wireframeMode: {
      ...s.wireframeMode,
      overlayOn:      true,
      overlayColor:   BLUEPRINT_LOOK.lineColor,
      material:       { ...BLUEPRINT_LOOK.material },
      emissiveMeshes: [],
    },
  }
}

const resolved = computed(() => {
  const c = props.content
  if (!c.model3dId) return null
  const model = data.value?.models.find((m) => m.id === c.model3dId)
  if (!model || !model.glbUrl) return null
  const viewName = props.mobile ? (c.mobileView || c.desktopView) : c.desktopView
  const settings = viewerSettingsFor(model, viewName, data.value?.editorPrefs)
  return {
    glbUrl:   model.glbUrl,
    settings: blueprint.value ? asBlueprint(settings) : settings,
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
    :wireframe="blueprint"
    :toolbar="!blueprint"
  />
</template>

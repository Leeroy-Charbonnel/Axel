<script setup lang="ts">
import { onMounted, watch } from "vue"
import { Box } from "lucide-vue-next"
import type { Model3dDto } from "../../../types/portfolio"
import SiteImage from "../../SiteImage.vue"
import { useThumbnails } from "./thumbnails"

//THE PICTURE OF ONE 3D MODEL ENTRY, filling the box it is put in: a render of
//the model from its start view. An entry without its render asks for it; until
//it comes the box shows the picture it had, or the icon.

const props = defineProps<{ model: Model3dDto; sizes: string; iconSize: number }>()
const { requestModelThumb } = useThumbnails()

function ensure() {
  if (props.model.thumbnailRendered === false) requestModelThumb(props.model.id, props.model.name)
}

onMounted(ensure)
watch(() => [props.model.id, props.model.thumbnailRendered], ensure)
</script>

<template>
  <span class="model-thumb">
    <SiteImage v-if="model.thumbnailUrl" :src="model.thumbnailUrl" :sizes="sizes" />
    <Box v-else :size="iconSize" aria-hidden="true" />
  </span>
</template>

<style scoped>
.model-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.model-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Box, FileText, Film, ImageIcon, Sun } from "lucide-vue-next"
import { IMAGE_SIZES } from "../../../lib/media"
import SiteImage from "../../SiteImage.vue"
import { useThumbnails } from "./thumbnails"
import { mediaTypeOf, type MediaFile } from "./useMediaLibrary"

//THE PICTURE OF ONE FILE, filling the box it is put in: an image as it is; a
//model, an environment map or a video through its thumbnail. A file without
//one shows its icon and, while it is on screen, asks for the thumbnail.

const ICONS = { image: ImageIcon, video: Film, model: Box, hdr: Sun, document: FileText }

const props = defineProps<{ file: MediaFile; iconSize: number }>()
const { requestFileThumb, cancelFileThumb, fileThumbPending } = useThumbnails()

const root = ref<HTMLElement | null>(null)
const type = computed(() => mediaTypeOf(props.file))
const pending = computed(() => fileThumbPending(props.file.id))
//the stored thumbnail this URL names did not load
const broken = ref<string | null>(null)
const thumb = computed(() => (props.file.thumbUrl && props.file.thumbUrl !== broken.value ? props.file.thumbUrl : null))
let observer: IntersectionObserver | null = null
let onScreen = false

function sync() {
  if (onScreen) requestFileThumb(props.file)
  else cancelFileThumb(props.file.id)
}

function onError() {
  broken.value = props.file.thumbUrl
  console.error(`[thumbnails] ${props.file.thumbUrl} failed to load, ${props.file.originalFilename} shows its icon`)
}

onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    onScreen = entry!.isIntersecting
    sync()
  })
  observer.observe(root.value!)
})
//the box shows another file: the one before gives its place up
watch(() => props.file.id, (_now, before) => {
  cancelFileThumb(before)
  sync()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelFileThumb(props.file.id)
})
</script>

<template>
  <span ref="root" class="file-thumb" :class="{ 'file-thumb--pending': pending }">
    <SiteImage v-if="type === 'image'" :src="file.url" :sizes="IMAGE_SIZES.tile" />
    <img v-else-if="thumb" :src="thumb" alt="" loading="lazy" decoding="async" @error="onError" />
    <component :is="ICONS[type ?? 'document']" v-else :size="iconSize" aria-hidden="true" />
  </span>
</template>

<style scoped>
.file-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*Its thumbnail is being made*/
@media (prefers-reduced-motion: no-preference) {
  .file-thumb--pending svg { animation: file-thumb-pulse var(--me-indeterminate-duration) ease-in-out infinite alternate; }
}

@keyframes file-thumb-pulse {
  from { opacity: 1; }
  to   { opacity: var(--me-pulse-low); }
}
</style>

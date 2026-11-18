<script lang="ts">
const warned = new Set<string>()
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { usePortfolio } from "../composables/usePortfolio"
import { enqueue, loadedStep, markLoaded, sizesWidth } from "../lib/image-queue"
import { derivativeUrl, stepFor, storedImage, type ImageSizes } from "../lib/media"

//EVERY PUBLIC IMAGE. An upload under /media/images loads one resized WebP
//copy, one image pixel per CSS pixel of the width `sizes` gives, when its turn
//comes in the image queue (one image at a time, the ones on screen first).
//`full` (the lightbox) loads the copy for the screen's pixel density at once,
//over the small copy while it comes. A copy already loaded at least as wide is
//reused. The stored width and height reserve the box before the bytes arrive.
//Anything else (a GIF, an external URL) is drawn as it is.
const props = withDefaults(defineProps<{
  src:   string
  sizes: string
  alt?:  string
  full?: boolean
}>(), { alt: "", full: false })

const { data } = usePortfolio()

//a payload cached from before a deploy can lack the sizes: the image is drawn
//without them, and the console says which one, once
const size = computed(() => {
  if (!data.value) return null
  const sizes: ImageSizes | undefined = data.value.images
  const found = sizes?.[props.src]
  if (found) return found
  if (storedImage(props.src) && !warned.has(props.src)) {
    warned.add(props.src)
    console.warn(`[image] no stored dimensions for ${props.src}, drawn without width and height`)
  }
  return null
})

const img = ref<HTMLImageElement | null>(null)
const shown = ref<string | null>(null)
//The copy being loaded, recorded once it arrives
let loading: { stored: string; step: number } | null = null
//Frees the queue turn
let release: (() => void) | null = null
//The full copy fetched behind the small one
let upgrade: HTMLImageElement | null = null

function stop(): void {
  release?.()
  release = null
  if (upgrade) upgrade.onload = upgrade.onerror = null
  upgrade = null
}

function show(stored: string, step: number): void {
  loading = { stored, step }
  shown.value = derivativeUrl(stored, step)
}

//Fetches the full copy, then swaps it in for the small one on screen
function fetchFull(stored: string, step: number): void {
  const url = derivativeUrl(stored, step)
  const full = new Image()
  full.onload = () => { upgrade = null; show(stored, step) }
  full.onerror = () => { upgrade = null; console.error(`[image] ${url} failed to load`) }
  full.src = url
  upgrade = full
}

function load(): void {
  stop()
  const stored = storedImage(props.src)
  if (!stored) {
    loading = null
    shown.value = props.src
    return
  }
  const drawn = sizesWidth(props.sizes)
  const step = stepFor(props.full ? drawn * window.devicePixelRatio : drawn, size.value?.[0] ?? null)
  const have = loadedStep(stored)
  if (have !== undefined && have >= step) return show(stored, have)
  if (props.full) {
    if (have === undefined) return show(stored, step)
    show(stored, have)
    return fetchFull(stored, step)
  }
  shown.value = null
  release = enqueue(() => show(stored, step), img.value)
}

function onLoad(): void {
  if (loading) markLoaded(loading.stored, loading.step)
  release?.()
  release = null
}

function onError(): void {
  console.error(`[image] ${shown.value} failed to load`)
  release?.()
  release = null
}

onMounted(load)
watch(() => [props.src, props.sizes, props.full, size.value?.[0]].join("|"), load)
onBeforeUnmount(stop)
</script>

<template>
  <img
    ref="img"
    :src="shown ?? undefined"
    :alt="alt"
    :width="size?.[0]"
    :height="size?.[1]"
    decoding="async"
    @load="onLoad"
    @error="onError"
  />
</template>

<style scoped>
/*Waiting for its turn: an empty box, not the alt text*/
img:not([src]) { visibility: hidden; }
</style>

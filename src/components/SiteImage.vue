<script lang="ts">
const warned = new Set<string>()
</script>

<script setup lang="ts">
import { computed } from "vue"
import { usePortfolio } from "../composables/usePortfolio"
import { derivativeUrl, storedImage, widthSteps, type ImageSizes } from "../lib/media"

//EVERY PUBLIC IMAGE. An upload under /media/images is offered as resized WebP
//copies (srcset), with the stored width and height so the box is reserved
//before the bytes arrive. Anything else (a GIF, an external URL) is drawn as
//it is. `sizes` says how wide the image is drawn, the browser picks the copy.
const props = withDefaults(defineProps<{
  src:            string
  sizes:          string
  alt?:           string
  loading?:       "lazy" | "eager"
  fetchpriority?: "high" | "auto"
}>(), { alt: "", loading: "lazy", fetchpriority: "auto" })

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

const variants = computed(() => {
  const stored = storedImage(props.src)
  if (!stored) return null
  const steps = widthSteps(size.value?.[0] ?? null)
  return {
    srcset: steps.map(({ step, width }) => `${derivativeUrl(stored, step)} ${width}w`).join(", "),
    src:    derivativeUrl(stored, steps[steps.length - 1]!.step),
  }
})
</script>

<template>
  <img
    :src="variants?.src ?? src"
    :srcset="variants?.srcset"
    :sizes="variants ? sizes : undefined"
    :alt="alt"
    :width="size?.[0]"
    :height="size?.[1]"
    :loading="loading"
    :fetchpriority="fetchpriority"
    decoding="async"
  />
</template>

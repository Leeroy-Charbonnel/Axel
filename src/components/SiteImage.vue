<script setup lang="ts">
import { computed } from "vue"
import { usePortfolio } from "../composables/usePortfolio"
import { derivativeUrl, storedImage, widthSteps } from "../lib/media"

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

const size = computed(() => data.value?.images[props.src] ?? null)

const variants = computed(() => {
  const stored = storedImage(props.src)
  if (!stored) return null
  const steps = widthSteps(size.value?.[0] ?? null)
  return {
    srcset: steps.map(({ step, width }) => `${derivativeUrl(stored, step)} ${width}w`).join(", "),
    src:    derivativeUrl(stored, steps.at(-1)!.step),
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

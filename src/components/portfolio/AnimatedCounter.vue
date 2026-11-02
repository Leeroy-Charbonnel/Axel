<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue"
import { useReveal } from "../../composables/useReveal"
import { formatNumber } from "../../lib/portfolio-utils"

//COUNTS UP TO `to` WHEN IT SCROLLS IN. It shows the final value until the
//observer says it is below the viewport, so a counter that is never observed,
//or a visitor who asked for less motion, reads the real number.
const props = withDefaults(defineProps<{ from: number; to: number; duration?: number }>(), { duration: 2 })

const root = ref<HTMLElement | null>(null)
const display = ref(formatNumber(props.to))
const { pending } = useReveal(root)

const easeOut = (x: number) => 1 - Math.pow(1 - x, 2)
let rafId: number | null = null

watch(pending, (isPending) => {
  if (isPending) {
    display.value = formatNumber(props.from)
    return
  }
  const startTs = performance.now()
  const total = props.duration * 1000
  function tick(ts: number) {
    const progress = Math.min((ts - startTs) / total, 1)
    display.value = formatNumber(props.from + (props.to - props.from) * easeOut(progress))
    if (progress < 1) rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
})

watch(() => props.to, (to) => { if (!pending.value) display.value = formatNumber(to) })

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <span ref="root">{{ display }}</span>
</template>

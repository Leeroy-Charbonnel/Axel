<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useReveal } from "../../composables/useReveal"

//COUNTS UP FROM 0 TO `to` WHEN IT SCROLLS IN, digits grouped in the reader's
//language. It shows the final value until the observer says it is below the
//viewport, so a counter that is never observed, or a visitor who asked for
//less motion, reads the real number.
const props = defineProps<{ to: number; lang: string }>()

const COUNT_MS = 2000

const root = ref<HTMLElement | null>(null)
const shown = ref(props.to)
const { pending } = useReveal(root)
const format = computed(() => new Intl.NumberFormat(props.lang))

const easeOut = (x: number) => 1 - Math.pow(1 - x, 2)
let rafId: number | null = null

watch(pending, (isPending) => {
  if (isPending) {
    shown.value = 0
    return
  }
  const start = performance.now()
  function tick(now: number) {
    const progress = Math.min((now - start) / COUNT_MS, 1)
    shown.value = Math.round(props.to * easeOut(progress))
    if (progress < 1) rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
})

watch(() => props.to, (to) => { if (!pending.value) shown.value = to })

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <span ref="root">{{ format.format(shown) }}</span>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useReveal } from "../../composables/useReveal"

//ONE REVEAL FOR THE SITE: a short fade and a small rise, timed by the
//--site-reveal-* tokens. Content stays visible unless the observer says it is
//still below the viewport (see useReveal).
const props = withDefaults(defineProps<{ delay?: number; tag?: string }>(), { delay: 0, tag: "div" })

const root = ref<HTMLElement | null>(null)
const { pending } = useReveal(root)
const style = computed(() => ({ transitionDelay: `${props.delay}s` }))
</script>

<template>
  <component :is="tag" ref="root" class="reveal" :class="{ 'reveal--pending': pending }" :style="style">
    <slot />
  </component>
</template>

<style scoped>
.reveal {
  transition:
    opacity var(--site-reveal-duration) var(--site-ease),
    transform var(--site-reveal-duration) var(--site-ease);
}

.reveal--pending {
  opacity: 0;
  transform: translateY(var(--site-reveal-distance));
}
</style>

import { ref } from "vue"

//THE VISITOR'S MOTION PREFERENCE, live: one media query for the whole app.
//Anything that moves on its own (autoplay, marquee, count-ups) reads this.
const query = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
const reduced = ref(query?.matches ?? false)
query?.addEventListener("change", (e) => { reduced.value = e.matches })

export function useReducedMotion() {
  return reduced
}

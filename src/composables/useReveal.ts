import { onBeforeUnmount, onMounted, ref, type Ref } from "vue"

//SCROLL REVEAL, VISIBLE BY DEFAULT. `pending` turns true only once the observer
//has answered that the element is still below the viewport, and false again
//when it comes in. An observer that never answers, a reduced-motion visitor and
//an element already on screen all keep the content in its final state.
export function useReveal(target: Ref<HTMLElement | null>) {
  const pending = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const el = target.value
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      if (entry.isIntersecting) {
        pending.value = false
        observer?.disconnect()
        observer = null
      } else if (entry.boundingClientRect.top > 0) {
        pending.value = true
      }
    }, { rootMargin: "0px 0px -8% 0px" })
    observer.observe(el)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { pending }
}

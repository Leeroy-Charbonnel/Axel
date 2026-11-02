import { ref } from "vue"

//PHONE WIDTH (<= 640px), one module-scoped ref and one listener for the app.
//Used where markup cannot express the difference in CSS, e.g. which named
//camera view a 3D model opens on.
const PHONE_QUERY = "(max-width: 640px)"

const isMobile = ref(false)
let wired = false

function wire() {
  if (wired || typeof window === "undefined") return
  wired = true
  const query = window.matchMedia(PHONE_QUERY)
  isMobile.value = query.matches
  query.addEventListener("change", (e) => { isMobile.value = e.matches })
}

export function useIsMobile() {
  wire()
  return { isMobile }
}

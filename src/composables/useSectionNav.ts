import { ref } from "vue"
import { useRoute, useRouter } from "vue-router"

//THE HOME PAGE SECTIONS, in page order, and the one way to reach them. On the
//home page a link scrolls (scroll-margin-top on .site-section clears the top
//bar); from any other page it goes home with the hash, and HomePage scrolls
//once the sections exist.
export const SECTIONS = [
  { id: "home",       labelKey: "navHome" },
  { id: "projects",   labelKey: "navProjects" },
  { id: "gallery",    labelKey: "navGallery" },
  { id: "experience", labelKey: "navExperience" },
  { id: "about",      labelKey: "navAbout" },
  { id: "contact",    labelKey: "navContact" },
] as const

export type SectionId = typeof SECTIONS[number]["id"]

//the section crossing this line of the viewport is the current one
const SPY_LINE = 0.35

const activeId = ref<SectionId>("home")
let spying = false

function spy() {
  const line = window.innerHeight * SPY_LINE
  let current: SectionId = "home"
  for (const { id } of SECTIONS) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= line) current = id
  }
  //the last section is too short to reach the line: the bottom of the page is it
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  const last = SECTIONS[SECTIONS.length - 1]!.id
  if (atBottom && document.getElementById(last)) current = last
  activeId.value = current
}

function startSpy() {
  if (spying || typeof window === "undefined") return
  spying = true
  let frame = 0
  window.addEventListener("scroll", () => {
    if (frame) return
    frame = requestAnimationFrame(() => { frame = 0; spy() })
  }, { passive: true })
  spy()
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) {
    console.warn(`[sections] no element #${id} on this page`)
    return
  }
  el.scrollIntoView()
}

export function useSectionNav() {
  const route  = useRoute()
  const router = useRouter()
  startSpy()

  function go(id: SectionId) {
    if (route.path === "/") scrollToSection(id)
    else void router.push({ path: "/", hash: `#${id}` })
  }

  return { sections: SECTIONS, activeId, go }
}

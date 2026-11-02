import { computed, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useLanguage } from "./useLanguage"

//THE SECTIONS THE RAIL LISTS, and the one way to reach them. The home page's
//own sections by default; a page with sections of its own (a project's
//headings) puts them in place while it is shown. On the page that owns them a
//link scrolls (scroll-margin-top clears the top bar); a home section reached
//from another page goes home with the hash, and HomePage scrolls once the
//sections exist.
export const SECTIONS = [
  { id: "home",       labelKey: "navHome" },
  { id: "projects",   labelKey: "navProjects" },
  { id: "gallery",    labelKey: "navGallery" },
  { id: "experience", labelKey: "navExperience" },
  { id: "about",      labelKey: "navAbout" },
  { id: "contact",    labelKey: "navContact" },
] as const

//a label of the page's own text, or a translation key read when drawn
export type NavSection = { id: string; label: string } | { id: string; labelKey: string }

//the section crossing this line of the viewport is the current one
const SPY_LINE = 0.35

const activeId = ref("")
const pageSections = ref<NavSection[] | null>(null)
let spying = false

function shownIds(): string[] {
  return pageSections.value ? pageSections.value.map((s) => s.id) : SECTIONS.map((s) => s.id)
}

function spy() {
  const ids = shownIds()
  const line = window.innerHeight * SPY_LINE
  let current = ids[0] ?? ""
  for (const id of ids) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= line) current = id
  }
  //the last section is too short to reach the line: the bottom of the page is it
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  const last = ids[ids.length - 1]
  if (atBottom && last && document.getElementById(last)) current = last
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

//a page lists its own sections while it is shown, null gives the home's back
export function setPageSections(list: NavSection[] | null) {
  pageSections.value = list
  if (typeof window !== "undefined") requestAnimationFrame(spy)
}

export function useSectionNav() {
  const route  = useRoute()
  const router = useRouter()
  const { t } = useLanguage()
  startSpy()

  const sections = computed(() => (pageSections.value ?? SECTIONS).map((s) =>
    ({ id: s.id, label: "labelKey" in s ? t(s.labelKey) : s.label })))
  //the rail marks where the reader is on the page that owns the list
  const ownPage = computed(() => pageSections.value !== null || route.path === "/")

  function go(id: string) {
    if (pageSections.value || route.path === "/") scrollToSection(id)
    else void router.push({ path: "/", hash: `#${id}` })
  }

  return { sections, activeId, ownPage, go }
}

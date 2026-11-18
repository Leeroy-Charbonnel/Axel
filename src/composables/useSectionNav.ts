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
//Rounding room when testing for the bottom of the page
const BOTTOM_SLACK_PX = 2

const activeId = ref("")
const pageSections = ref<NavSection[] | null>(null)
let spying = false
//The last section reached from a link: it wins a tie with a section on its row
let pickedId = ""

function shownIds(): string[] {
  return pageSections.value ? pageSections.value.map((s) => s.id) : SECTIONS.map((s) => s.id)
}

//Current: the section top closest above the line, the first one on a tie
function spy() {
  const ids = shownIds()
  const line = window.innerHeight * SPY_LINE
  let current = ids[0] ?? ""
  let best = -Infinity
  for (const id of ids) {
    const top = document.getElementById(id)?.getBoundingClientRect().top
    if (top === undefined || top > line) continue
    if (top > best || (top === best && id === pickedId)) {
      best = top
      current = id
    }
  }
  //the last section is too short to reach the line: the bottom of the page is it
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - BOTTOM_SLACK_PX
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
  pickedId = id
  el.scrollIntoView()
  //Sections carry tabindex="-1" to take the focus
  el.focus({ preventScroll: true })
}

//The page whose list is shown: only that page can take it away again
let pageOwner: symbol | null = null

//A page lists its own sections while it is shown
export function setPageSections(list: NavSection[], owner: symbol) {
  pageSections.value = list
  pageOwner = owner
  if (typeof window !== "undefined") requestAnimationFrame(spy)
}

//Gives the home's list back, unless another page took the rail since
export function clearPageSections(owner: symbol) {
  if (pageOwner !== owner) return
  pageSections.value = null
  pageOwner = null
  if (typeof window !== "undefined") requestAnimationFrame(spy)
}

export function useSectionNav() {
  const route  = useRoute()
  const router = useRouter()
  const { t } = useLanguage()
  startSpy()

  const sections = computed(() => (pageSections.value ?? SECTIONS).map((s) =>
    ({ id: s.id, label: "labelKey" in s ? t(s.labelKey) : s.label })))
  //A page shows its own list (a project's headings)
  const pageList = computed(() => pageSections.value !== null)
  //the rail marks where the reader is on the page that owns the list
  const ownPage = computed(() => pageList.value || route.path === "/")

  function go(id: string) {
    if (pageSections.value || route.path === "/") scrollToSection(id)
    else void router.push({ path: "/", hash: `#${id}` })
  }

  return { sections, activeId, ownPage, pageList, go }
}

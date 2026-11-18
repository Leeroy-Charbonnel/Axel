<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { Menu, X } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { usePortfolio } from "../../composables/usePortfolio"
import { useSectionNav } from "../../composables/useSectionNav"
import LangSwitch from "./LangSwitch.vue"
import TickRail from "./nav/TickRail.vue"

//Site chrome: the left rail and language above 768px, a top bar and menu dialog below
const { t } = useLanguage()
const { data } = usePortfolio()
const { sections, activeId, ownPage, pageList, go } = useSectionNav()
const route = useRoute()

const name = computed(() => data.value?.profile?.name ?? "")
const navLabel = computed(() => t(pageList.value ? "navContents" : "navSections"))

//Fewer page sections than this show no ticks
const MIN_TICKS = 2
//Hidden until the router resolves the first page
const railShown = computed(() => route.matched.length > 0 && (!pageList.value || sections.value.length >= MIN_TICKS))

//Fit: a short window shrinks the home labels, never above full size; ticks scroll instead
const railEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const fit = ref(1)
function measureFit() {
  const rail = railEl.value, list = listEl.value
  if (!rail || !list || !list.scrollHeight) return
  const style = getComputedStyle(rail)
  const room = rail.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  //the list's height at full size, from its height at the current fit
  const full = list.scrollHeight / fit.value
  fit.value = Math.min(1, room / full)
}
let fitObserver: ResizeObserver | null = null
onMounted(() => {
  fitObserver = new ResizeObserver(measureFit)
  if (railEl.value) fitObserver.observe(railEl.value)
})
onBeforeUnmount(() => fitObserver?.disconnect())
watch(sections, () => void nextTick(measureFit), { deep: true })

const menu = ref<HTMLDialogElement | null>(null)
const menuOpen = ref(false)

function openMenu() {
  menu.value?.showModal()
  menuOpen.value = true
}

//Escape arrives as a cancel event, prevented and routed here so the state never drifts
function closeMenu() {
  menu.value?.close()
  menuOpen.value = false
}

function pick(id: string) {
  closeMenu()
  go(id)
}

//a resize to desktop leaves no menu open behind the rail
const desktop = typeof window !== "undefined" ? window.matchMedia("(min-width: 769px)") : null
function onDesktopChange(e: MediaQueryListEvent) { if (e.matches) closeMenu() }
onMounted(() => desktop?.addEventListener("change", onDesktopChange))
onBeforeUnmount(() => desktop?.removeEventListener("change", onDesktopChange))
watch(() => route.fullPath, closeMenu)
</script>

<template>
  <!--DESKTOP RAIL-->
  <nav v-show="railShown" ref="railEl" class="rail" :class="{ 'rail--ticks': pageList }" :aria-label="navLabel" :style="{ '--rail-fit': fit }">
    <TickRail v-if="pageList" />
    <ul v-else ref="listEl" class="rail__list">
      <li v-for="section in sections" :key="section.id">
        <a
          :href="`/#${section.id}`"
          class="site-rail-link rail__link"
          :aria-current="ownPage && activeId === section.id ? 'true' : undefined"
          @click.prevent="go(section.id)"
        >{{ section.label }}</a>
      </li>
    </ul>
  </nav>

  <!--DESKTOP LANGUAGE - the top right corner, as on the first site-->
  <LangSwitch class="corner-lang" />

  <!--TABLET AND PHONE TOP BAR-->
  <header class="topbar">
    <a href="/#home" class="topbar__name" @click.prevent="go('home')">{{ name }}</a>
    <button
      type="button"
      class="topbar__menu-button"
      aria-controls="site-menu"
      :aria-expanded="menuOpen"
      :aria-label="t('navMenuOpen')"
      @click="openMenu"
    >
      <Menu aria-hidden="true" />
    </button>
  </header>

  <dialog id="site-menu" ref="menu" class="menu" :aria-label="navLabel" @cancel.prevent="closeMenu">
    <div class="menu__head">
      <span class="topbar__name">{{ name }}</span>
      <button type="button" class="topbar__menu-button" :aria-label="t('navMenuClose')" @click="closeMenu">
        <X aria-hidden="true" />
      </button>
    </div>
    <nav :aria-label="navLabel">
      <ul class="menu__list">
        <li v-for="section in sections" :key="section.id">
          <a
            :href="`/#${section.id}`"
            class="menu__link"
            :aria-current="ownPage && activeId === section.id ? 'true' : undefined"
            @click.prevent="pick(section.id)"
          >{{ section.label }}</a>
        </li>
      </ul>
    </nav>
    <LangSwitch class="menu__lang" />
  </dialog>
</template>

<style scoped>
/*RAIL - floats over the page at the left edge, no background, labels turned
to read bottom to top*/
.rail {
  position: fixed;
  top: 0;
  bottom: var(--editor-bar-offset);
  left: var(--spacing-xs);
  z-index: var(--site-z-chrome);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-block: var(--spacing-md);
  overflow-y: auto;
  scrollbar-width: none;
}

/*The ticks panel is wider than its strip: only the panel takes the pointer*/
.rail--ticks { pointer-events: none; }

/*centred in the rail*/
.rail__list {
  margin-block: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  list-style: none;
}

.rail__link {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing-sm) * var(--rail-fit)) var(--spacing-xs);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: calc(var(--site-fs-rail) * var(--rail-fit));
}

/*Below 1025px the editor's bottom sheets cover the rail*/
@media (max-width: 1024px) {
  html.editor-editing .rail { display: none; }
}

.corner-lang {
  position: fixed;
  top: var(--spacing-xs);
  right: var(--spacing-md);
  z-index: var(--site-z-chrome);
}

/*a laptop-short window: the labels sit closer, and below that the rail scrolls
rather than hiding its last links*/
@media (max-height: 800px) {
  .rail__link { padding: calc(var(--spacing-xxs) * var(--rail-fit)) 0; }
}

/*TOP BAR - hidden on desktop*/
.topbar {
  display: none;
}

.topbar__name {
  display: inline-flex;
  align-items: center;
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  font-weight: var(--site-fw-display);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.topbar__menu-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  margin-right: calc(-1 * var(--spacing-sm));
  color: var(--site-text-heading);
}

.topbar__menu-button svg {
  width: var(--site-icon);
  height: var(--site-icon);
}

/*MENU - a full-screen modal dialog*/
.menu {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  padding: 0 var(--site-gutter) var(--spacing-xl);
  border: none;
  background-color: var(--site-scrim);
  color: var(--site-text-heading);
  backdrop-filter: blur(var(--filter-blur));
}

.menu[open] {
  display: flex;
  flex-direction: column;
}

.menu::backdrop { background-color: transparent; }

.menu__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--site-topbar-height);
  border-bottom: var(--border-width-sm) solid var(--site-line);
}

.menu__list {
  display: flex;
  flex-direction: column;
  padding-block: var(--spacing-xl);
  list-style: none;
}

.menu__link {
  display: flex;
  align-items: center;
  min-height: var(--site-touch-target);
  padding-block: var(--spacing-xs);
  font-size: var(--site-fs-h2);
  font-weight: var(--site-fw-display);
  letter-spacing: var(--site-tracking-heading);
  text-transform: uppercase;
  color: var(--site-text-heading);
  transition: color var(--site-duration-fast) ease;
}

.menu__link:hover,
.menu__link[aria-current="true"] { color: var(--site-accent); }

.menu__lang {
  margin-top: auto;
  margin-left: calc(-1 * var(--spacing-sm));
}

@media (max-width: 768px) {
  .rail,
  .corner-lang { display: none; }

  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--site-z-chrome);
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--site-topbar-height);
    padding-inline: var(--site-gutter);
    border-bottom: var(--border-width-sm) solid var(--site-line);
    background-color: var(--site-backdrop);
    backdrop-filter: blur(var(--filter-blur));
  }
}
</style>

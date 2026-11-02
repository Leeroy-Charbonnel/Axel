<script setup lang="ts">
import { computed, watchEffect } from "vue"
import { useRoute } from "vue-router"
import ToastHost from "./components/ToastHost.vue"
import ConfirmDialog from "./components/ConfirmDialog.vue"
import { useLanguage } from "./composables/useLanguage"
import SideNav      from "./components/portfolio/SideNav.vue"
import SiteFooter   from "./components/portfolio/SiteFooter.vue"
import EditBar      from "./components/admin/EditBar.vue"
import Inspector    from "./components/admin/Inspector.vue"
import MediaLibraryDialog from "./components/admin/media/MediaLibraryDialog.vue"
import "./components/admin/admin.css"
import LightboxCarousel from "./components/portfolio/LightboxCarousel.vue"

//Dark only: there is no theme toggle, and useTheme() is not called so no theme
//row is seeded into the settings table.

const { lang, t } = useLanguage()
const route = useRoute()

//the auth and admin screens render on the bare background, without the site chrome
const chromeFreeRoutes = ["/login", "/settings", "/forgot-password", "/reset-password"]
const withChrome = computed(() => !chromeFreeRoutes.includes(route.path) && !route.path.startsWith("/edit-3d/"))

//the document follows the reading language; the home page owns its title,
//other pages set their own
watchEffect(() => {
  document.documentElement.lang = lang.value
  //until the strings arrive t() answers the key: keep the server's title meanwhile
  const title = t("siteTitle")
  if (route.path === "/" && title !== "siteTitle") document.title = title
})
</script>

<template>
  <div class="vsui-app portfolio-app" :class="{ 'portfolio-app--chrome': withChrome }">
    <SideNav v-if="withChrome" />

    <main class="portfolio-app__main">
      <RouterView />
      <SiteFooter v-if="withChrome" />
    </main>

    <div class="grain-overlay"></div>

    <LightboxCarousel />

    <EditBar />
    <Inspector />
    <MediaLibraryDialog />

    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
/*a flex column at full height, so the grain (inset: 0) reaches the bottom of the page*/
.portfolio-app {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/*main stays in the root stacking context so media inside it can sit above the
grain (see .grain-overlay in style.css); a column, so the footer keeps the
bottom of a short page*/
.portfolio-app__main {
  position: relative;
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}

/*the rail floats over the page on desktop; the top bar takes its height below*/
@media (max-width: 1024px) {
  .portfolio-app--chrome .portfolio-app__main { padding-top: var(--site-topbar-height); }
}
</style>

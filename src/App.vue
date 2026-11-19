<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watchEffect } from "vue"
import { useRoute } from "vue-router"
import ToastHost from "./components/ToastHost.vue"
import ConfirmDialog from "./components/ConfirmDialog.vue"
import { useAdmin } from "./composables/useAdmin"
import { useLanguage } from "./composables/useLanguage"
import SideNav      from "./components/portfolio/SideNav.vue"
import SiteFooter   from "./components/portfolio/SiteFooter.vue"
import "./components/admin/admin.css"
import LightboxCarousel from "./components/portfolio/LightboxCarousel.vue"

//THE EDITING INTERFACE is fetched for the admin only: a visitor never downloads it
const EditBar            = defineAsyncComponent(() => import("./components/admin/EditBar.vue"))
const Inspector          = defineAsyncComponent(() => import("./components/admin/Inspector.vue"))
const MediaLibraryDialog = defineAsyncComponent(() => import("./components/admin/media/MediaLibraryDialog.vue"))
const { isAdmin } = useAdmin()

//Dark only: there is no light / dark toggle. The site colours come from the
//site theme (useTheme), applied for every visitor.

const { lang, t } = useLanguage()
const route = useRoute()

//the auth and admin screens render on the bare background, without the site chrome
const chromeFreeRoutes = ["/login", "/settings", "/forgot-password", "/reset-password"]
const withChrome = computed(() => !chromeFreeRoutes.includes(route.path) && !route.path.startsWith("/edit-3d/"))

//The skip link moves the focus past the rail
const mainEl = ref<HTMLElement | null>(null)

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
    <a
      v-if="withChrome"
      href="#main"
      class="site-button site-button--primary skip-link"
      @click.prevent="mainEl?.focus()"
    >{{ t("skipToMain") }}</a>
    <SideNav v-if="withChrome" />

    <main id="main" ref="mainEl" tabindex="-1" class="portfolio-app__main">
      <!--the home page stays alive behind the other pages: coming back to it is instant-->
      <RouterView v-slot="{ Component }">
        <KeepAlive include="HomePage">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
      <SiteFooter v-if="withChrome" />
    </main>

    <div class="grain-overlay"></div>

    <LightboxCarousel />

    <template v-if="isAdmin">
      <EditBar />
      <Inspector />
      <MediaLibraryDialog />
    </template>

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

/*SKIP LINK - above the top edge until focused*/
.skip-link {
  position: fixed;
  top: var(--spacing-xs);
  left: var(--spacing-xs);
  z-index: calc(var(--site-z-chrome) + 1);
  transform: translateY(calc(-100% - var(--spacing-xs)));
}

.skip-link:focus { transform: none; }

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
@media (max-width: 768px) {
  .portfolio-app--chrome .portfolio-app__main { padding-top: var(--site-topbar-height); }
}
</style>

import { createRouter, createWebHistory } from "vue-router"
import HomePage              from "../pages/HomePage.vue"
import { authClient, type SessionUser } from "../lib/authClient"

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  //back and forward return where the reader was; a new page opens at its top
  //(previous / next project reuse the same component, so this is not automatic).
  //Both at once: only a jump to a section of the page glides there.
  scrollBehavior: (to, _from, saved) => {
    if (saved) return { ...saved, behavior: "instant" }
    return to.hash ? { el: to.hash } : { top: 0, behavior: "instant" }
  },
  routes: [
    //Portfolio public landing page - single-page scroll layout
    { path: "/",                component: HomePage },

    //ADMIN ONLY. The API already refuses every write from a non-admin; the flag
    //stops the screen from drawing at all, which the previous guard did not do:
    //no route carried a meta flag, so it returned true on its second line every
    //time and these pages opened for anyone who typed the address.
    { path: "/settings",        component: () => import("../pages/SettingsPage.vue"), meta: { requiresAdmin: true } },

    //Every token, field and block rendered with sample content, for the admin
    { path: "/styleguide",      component: () => import("../pages/StyleguidePage.vue"), meta: { requiresAdmin: true } },

    //Three.js model editor - per-model edit page. model_3d rows use uuid
    //primary keys since the uuid migration, so the param accepts hex+dashes
    //(the old \d+ constraint silently 404'd every model after the migration).
    { path: "/edit-3d/:id([0-9a-fA-F-]+)", component: () => import("../pages/ModelEditorPage.vue"), meta: { requiresAdmin: true } },

    //Project detail page - serves BOTH the public read-only render and
    //the bento-grid editor. Flipping useEditor().editMode swaps the page
    //between view and edit modes (no separate /edit-detail route).
    { path: "/project/:id(\\d+)", component: () => import("../pages/ProjectDetailPage.vue") },

    //Legacy /edit-detail/:id from before the merge - redirect any
    //existing bookmarks to the unified /project/:id route.
    { path: "/edit-detail/:id(\\d+)", redirect: (to) => `/project/${to.params.id}` },

    //Auth pages, now in this repo: the template is copied, never linked.
    //Nothing in the interface links to /login - it is reached by typing it.
    { path: "/login",           component: () => import("../pages/LoginPage.vue") },
    { path: "/forgot-password", component: () => import("../pages/ForgotPasswordPage.vue") },
    { path: "/reset-password",  component: () => import("../pages/ResetPasswordPage.vue") },

    //anything else: a real page saying so, with the site around it
    { path: "/:pathMatch(.*)*", component: () => import("../pages/NotFoundPage.vue") },
  ],
})

//AUTH GUARD
//This site has one account and it is the admin, so there is a single question to
//ask: is the visitor that account? No auth mode to read, no pending state, no
//banned state - a role other than "admin" can do nothing here, and the boot
//deletes those accounts anyway.
//
//"/" and "/project/:id" stay public: the detail page serves the read-only render
//to everyone and only turns into an editor when useEditor().editMode is on, which
//needs the session the API checks on every write.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  const { data: session } = await authClient.getSession()
  //back to the portfolio rather than to /login: someone who guessed an editor
  //address is not someone to hand a sign-in form to
  if (!session?.user) return "/"

  return (session.user as SessionUser).role === "admin" ? true : "/"
})

export default router

import { createApp } from "vue"
import "@fontsource-variable/montserrat"
//Structural variables first, so style.css below can override them
import "./tokens.css"
import "./auth-card.css"
import "./style.css"
import App from "./App.vue"
import router from "./router/index"
import { authClient } from "./lib/authClient"
import { startProjectPrefetch } from "./lib/project-prefetch"

const DEV_LOGIN_URL = "/api/dev/login"
const DEV_LOGIN_RELOAD_KEY = "dev-auto-login-reload"

//The address asked for, before a guard redirects a signed-out visitor
const startUrl = location.href
createApp(App).use(router).mount("#app")
startProjectPrefetch()

async function isSignedIn(): Promise<boolean> {
  const { data, error } = await authClient.getSession()
  if (error) throw new Error(`getSession ${error.status}: ${error.message}`)
  return Boolean(data?.user)
}

//Read and clear the mark left by the dev login reload
function takeReloadMark(): boolean {
  try {
    const marked = sessionStorage.getItem(DEV_LOGIN_RELOAD_KEY) !== null
    sessionStorage.removeItem(DEV_LOGIN_RELOAD_KEY)
    return marked
  } catch (err) {
    console.error("[dev] auto login: sessionStorage unreadable", err)
    return false
  }
}

function setReloadMark(): boolean {
  try {
    sessionStorage.setItem(DEV_LOGIN_RELOAD_KEY, "1")
    return true
  } catch (err) {
    console.error("[dev] auto login: sessionStorage unwritable, no reload", err)
    return false
  }
}

//DEV ONLY: sign in the admin, then reload once so the mounted app reads the session
async function devAutoLogin() {
  const reloaded = takeReloadMark()
  if (await isSignedIn()) return
  if (reloaded) {
    console.error("[dev] auto login: still signed out after the reload")
    return
  }
  const res = await fetch(DEV_LOGIN_URL, { credentials: "include" })
  if (!res.ok) {
    console.error(`[dev] auto login: ${DEV_LOGIN_URL} answered ${res.status}`)
    return
  }
  if (!(await isSignedIn())) {
    console.error(`[dev] auto login: no session after ${DEV_LOGIN_URL}`)
    return
  }
  if (setReloadMark()) location.replace(startUrl)
}

if (import.meta.env.DEV && import.meta.env.DEV_AUTO_LOGIN === true) {
  devAutoLogin().catch(err => console.error("[dev] auto login failed:", err))
}

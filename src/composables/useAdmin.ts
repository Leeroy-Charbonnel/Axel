import { computed, ref } from "vue"
import { authClient, type SessionUser } from "../lib/authClient"

//SHARED admin state - one session lookup per app load, cached in module scope.
//No localStorage: the session lives in the better-auth cookie. Edit mode is
//not here: it belongs to useEditor.

const session  = ref<SessionUser | null>(null)
const loaded   = ref(false)

let inFlight: Promise<void> | null = null

async function refreshSession() {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const { data } = await authClient.getSession()
      session.value = (data?.user ?? null) as SessionUser | null
    } catch (e) {
      console.warn("[useAdmin] getSession failed:", e)
      session.value = null
    } finally {
      loaded.value = true
      inFlight = null
    }
  })()
  return inFlight
}

if (typeof window !== "undefined") {
  void refreshSession()
}

export function useAdmin() {
  const isAdmin    = computed(() => session.value?.role === "admin")
  const isLoggedIn = computed(() => session.value !== null)

  async function signOut() {
    await authClient.signOut()
    session.value = null
  }

  return {
    session,
    isAdmin,
    isLoggedIn,
    loaded,
    signOut,
    refresh: refreshSession,
  }
}

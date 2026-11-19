import { computed } from "vue"
import { authClient, type SessionUser } from "../lib/authClient"

//SHARED admin state, read from the auth client's own session store: one
//lookup per app load for every reader (useSettings, the auth pages), and the
//store follows a sign-in or a sign-out by itself. No localStorage: the session
//lives in the better-auth cookie. Edit mode is not here: it belongs to useEditor.
const session = authClient.useSession()
const isAdmin = computed(() => (session.value.data?.user as SessionUser | undefined)?.role === "admin")

export function useAdmin() {
  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) throw new Error(`sign out failed (${error.status}): ${error.message}`)
  }

  return { isAdmin, signOut }
}

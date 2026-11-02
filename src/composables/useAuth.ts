import { computed } from "vue"
import { useRouter } from "vue-router"
import { authClient, type SessionUser } from "../lib/authClient"

export function useAuth() {
  const router  = useRouter()
  const session = authClient.useSession()

  const user            = computed(() => session.value.data?.user ?? null)
  const isAuthenticated = computed(() => !!session.value.data?.user)
  const role            = computed(() => (session.value.data?.user as SessionUser | undefined)?.role ?? null)
  const isAdmin         = computed(() => role.value === "admin")

  async function signIn(email: string, password: string) {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) throw new Error(error.message)
  }

  //Both URLs absolute: a relative one resolves against BETTER_AUTH_URL, the API
  //server, which answers "Cannot GET /". A refused Google account comes back to
  //the login page with ?error=<code>.
  async function signInWithGoogle() {
    const origin = window.location.origin
    const { error } = await authClient.signIn.social({
      provider:         "google",
      callbackURL:      `${origin}/`,
      errorCallbackURL: `${origin}/login`,
    })
    if (error) throw new Error(error.message)
  }

  async function signUp(name: string, email: string, password: string) {
    const { error } = await authClient.signUp.email({ name, email, password })
    if (error) throw new Error(error.message)
  }

  async function requestPasswordReset(email: string) {
    const { error } = await (authClient as any).requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    })
    if (error) throw new Error(error.message)
  }

  async function resetPassword(token: string, newPassword: string) {
    const { error } = await (authClient as any).resetPassword({ token, newPassword })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    await authClient.signOut()
    router.push("/login")
  }

  return {
    session, user, isAuthenticated, role, isAdmin,
    signIn, signInWithGoogle, signUp, signOut,
    requestPasswordReset, resetPassword,
  }
}

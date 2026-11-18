import type express from "express"
import { serializeSignedCookie } from "better-call"
import { eq } from "drizzle-orm"
import { auth, ADMIN_ROLE } from "../auth"
import { DATABASE_URL } from "../env"
import { db } from "../db/index"
import * as schema from "../db/schema"

//DEV ONLY: GET /api/dev/login opens a session for the admin, no password
const DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN === "true"
const DEV_DATABASE_SUFFIX = "_dev"
//Socket addresses and host names of this machine
const LOOPBACK = ["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]
//No Sec-Fetch-Site header is a client that is not a browser, like curl
const ALLOWED_FETCH_SITE = "same-origin"

export function isLoopback(value: string): boolean {
  return LOOPBACK.includes(value.trim().replace(/^\[(.*)\]$/, "$1"))
}

export function hostname(host: string): string {
  return URL.parse(`http://${host.trim()}`)?.hostname ?? ""
}

export function list(header: string | undefined): string[] {
  return header ? header.split(",") : []
}

//Every hop and every host name must be this machine: a tunnel or a LAN client fails
export function isLocalRequest(req: express.Request): boolean {
  const fetchSite = req.get("sec-fetch-site")
  const hosts = [req.get("host") ?? "", ...list(req.get("x-forwarded-host"))]
  return isLoopback(req.socket.remoteAddress ?? "")
    && list(req.get("x-forwarded-for")).every(isLoopback)
    && hosts.every(host => isLoopback(hostname(host)))
    && (fetchSite === undefined || fetchSite === ALLOWED_FETCH_SITE)
}

export function assertDevDatabase(url: string = DATABASE_URL) {
  const name = decodeURIComponent(new URL(url).pathname.slice(1))
  if (!name.endsWith(DEV_DATABASE_SUFFIX)) {
    throw new Error(`[dev] DEV_AUTO_LOGIN=true needs the dev database (name ending in "${DEV_DATABASE_SUFFIX}"), DATABASE_URL names "${name}"`)
  }
}

export function mountDevLogin(app: express.Express, isProd: boolean) {
  if (!DEV_AUTO_LOGIN) return
  if (isProd) throw new Error("[dev] DEV_AUTO_LOGIN=true is refused in production: remove it")
  assertDevDatabase()

  app.get("/api/dev/login", async (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ error: "local only" })
      return
    }

    const [admin] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, ADMIN_ROLE))
      .limit(1)
    if (!admin) {
      res.status(404).json({ error: "no admin account" })
      return
    }

    const ctx = await auth.$context
    const session = await ctx.internalAdapter.createSession(admin.id)
    const { name, attributes } = ctx.authCookies.sessionToken
    const cookie = await serializeSignedCookie(name, session.token, ctx.secret, {
      ...attributes,
      maxAge: ctx.sessionConfig.expiresIn,
    })
    res.setHeader("Set-Cookie", cookie)
    res.status(204).end()
  })

  console.log("[dev] auto login on: GET /api/dev/login signs in the admin")
}

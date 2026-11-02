import type express from "express"
import { z } from "zod"
import { fromNodeHeaders } from "better-auth/node"
import { auth, ADMIN_ROLE } from "../auth"

export type SessionUser = typeof auth.$Infer.Session.user

//An error carrying its own status reaches the client with its message; the
//global handler in server.ts answers everything else with a bare 500.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function notFound(): never {
  throw new HttpError(404, "not found")
}

//zod allow-list: unknown keys and wrong types are a 400 with a readable message
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    throw new HttpError(400, issues.join("; "))
  }
  return result.data
}

//a PUT body that names no field is a client bug, not a no-op
export function parsePatch<S extends z.ZodType<Record<string, unknown>>>(schema: S, value: unknown): z.infer<S> {
  const patch = parse(schema, value)
  if (Object.keys(patch).length === 0) throw new HttpError(400, "the body names no field to change")
  return patch
}

export function intParam(req: express.Request, key: string): number {
  const n = Number(req.params[key])
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${key} must be a positive integer`)
  return n
}

export function uuidParam(req: express.Request, key: string): string {
  const value = String(req.params[key])
  if (!z.uuid().safeParse(value).success) throw new HttpError(400, `${key} must be a uuid`)
  return value
}

export async function sessionUser(req: express.Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  return session ? session.user as SessionUser : null
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === ADMIN_ROLE
}

//There is one account on this site and it is the admin. A session that is not
//the admin's can do nothing, and the next boot deletes its account.
export async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await sessionUser(req)
  if (!user) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  if (!isAdmin(user)) {
    res.status(403).json({ error: "admin only" })
    return
  }
  res.locals.user = user
  next()
}

export function adminId(res: express.Response): string {
  return (res.locals.user as SessionUser).id
}

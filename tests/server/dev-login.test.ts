import { describe, expect, mock, test } from "bun:test"
import type express from "express"

//No env, no auth, no database: only the pure checks are under test
mock.module("../../env", () => ({ DATABASE_URL: "postgres://user@localhost:5432/portfolio_dev" }))
mock.module("../../auth", () => ({ auth: {}, ADMIN_ROLE: "admin" }))
mock.module("../../db/index", () => ({ db: {} }))

const { assertDevDatabase, isLocalRequest } = await import("../../server/dev-login")

function request(remoteAddress: string | undefined, headers: Record<string, string>): express.Request {
  const byName = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  return {
    socket: { remoteAddress },
    get: (name: string) => byName.get(name.toLowerCase()),
  } as unknown as express.Request
}

//A browser tab on the Vite dev server, proxied to the API on this machine
function local(headers: Record<string, string> = {}, remoteAddress = "127.0.0.1"): express.Request {
  return request(remoteAddress, { host: "localhost:5173", ...headers })
}

describe("isLocalRequest accepts this machine", () => {
  test("loopback socket addresses", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      expect(isLocalRequest(local({}, address))).toBe(true)
    }
  })

  test("loopback host names, with or without a port", () => {
    for (const host of ["localhost", "localhost:5173", "127.0.0.1", "127.0.0.1:3001", "[::1]", "[::1]:5173"]) {
      expect(isLocalRequest(local({ host }))).toBe(true)
      expect(isLocalRequest(local({ "x-forwarded-host": host }))).toBe(true)
    }
  })

  test("x-forwarded-for where every hop is loopback", () => {
    for (const hops of ["127.0.0.1", "::1", "127.0.0.1, ::1", "::ffff:127.0.0.1,127.0.0.1", "[::1]"]) {
      expect(isLocalRequest(local({ "x-forwarded-for": hops }))).toBe(true)
    }
  })

  test("sec-fetch-site same-origin, or no header at all like curl", () => {
    expect(isLocalRequest(local({ "sec-fetch-site": "same-origin" }))).toBe(true)
    expect(isLocalRequest(local())).toBe(true)
  })
})

describe("isLocalRequest refuses everything else", () => {
  test("a socket that is not loopback", () => {
    for (const address of ["192.168.1.20", "10.0.0.5", "::ffff:192.168.1.20", "2001:db8::1", ""]) {
      expect(isLocalRequest(local({}, address))).toBe(false)
    }
    expect(isLocalRequest(request(undefined, { host: "localhost" }))).toBe(false)
  })

  test("any x-forwarded-for hop that is not loopback, also inside a list", () => {
    for (const hops of ["203.0.113.7", "203.0.113.7, 127.0.0.1", "127.0.0.1, 203.0.113.7", "127.0.0.1,::1,10.0.0.5"]) {
      expect(isLocalRequest(local({ "x-forwarded-for": hops }))).toBe(false)
    }
  })

  test("a host or x-forwarded-host that is not this machine", () => {
    for (const host of ["evil.test", "evil.test:5173", "localhost.evil.test", "127.0.0.1.nip.io", "localhost@evil.test"]) {
      expect(isLocalRequest(local({ host }))).toBe(false)
      expect(isLocalRequest(local({ "x-forwarded-host": host }))).toBe(false)
      expect(isLocalRequest(local({ "x-forwarded-host": `localhost, ${host}` }))).toBe(false)
    }
  })

  test("a page from another site", () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      expect(isLocalRequest(local({ "sec-fetch-site": site }))).toBe(false)
    }
  })

  test("a malformed or missing host", () => {
    for (const host of ["", "local host", "localhost:port", "[::1", "::1"]) {
      expect(isLocalRequest(local({ host }))).toBe(false)
    }
    expect(isLocalRequest(request("127.0.0.1", {}))).toBe(false)
  })
})

describe("assertDevDatabase", () => {
  test("a database name ending in _dev passes", () => {
    for (const url of [
      "postgres://user:pass@localhost:5432/portfolio_dev",
      "postgres://user@db/portfolio_dev?sslmode=disable",
      "postgresql://localhost/_dev",
    ]) {
      expect(() => assertDevDatabase(url)).not.toThrow()
    }
  })

  test("any other name is refused", () => {
    for (const url of [
      "postgres://user:pass@localhost:5432/portfolio",
      "postgres://localhost/portfolio_development",
      "postgres://localhost/portfolio_dev/other",
      "postgres://localhost/portfolio?db=x_dev",
      "postgres://localhost/portfolio#_dev",
      "postgres://localhost/",
    ]) {
      expect(() => assertDevDatabase(url)).toThrow("needs the dev database")
    }
  })

  test("the name is read URL-decoded", () => {
    expect(() => assertDevDatabase("postgres://localhost/portfolio%5Fdev")).not.toThrow()
    expect(() => assertDevDatabase("postgres://localhost/portfolio_dev%20")).toThrow("needs the dev database")
    expect(() => assertDevDatabase("postgres://localhost/portfolio%5Fdevx")).toThrow("needs the dev database")
  })

  test("with no argument it reads DATABASE_URL", () => {
    expect(() => assertDevDatabase()).not.toThrow()
  })
})

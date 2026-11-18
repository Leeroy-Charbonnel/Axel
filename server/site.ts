import express, { type Express, type Request } from "express"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { join } from "path"
import { asc, eq } from "drizzle-orm"
import { PUBLIC_APP_URL } from "../env"
import { db } from "../db/index"
import { mainProject } from "../db/schema"
import { isLang, LANG_COOKIE, LANG_DEFAULT, type Lang } from "../src/lib/lang"
import type { ThemeVars } from "../src/lib/theme-vars"
import { publicPortfolio } from "./portfolio"
import {
  appOnlyPage, escapeHtml, homePage, llmsFullTxt, llmsTxt, notFoundPage, projectPage, robotsTxt, sitemapXml, type Page,
} from "./seo"

//THE BUILT APP, served by Express in production only: in dev Vite serves the
//front end and proxies /api here. Every HTML response carries the page's real
//content (see seo.ts); /assets are content-hashed and cached for a year.

const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url))
const SITE = PUBLIC_APP_URL.replace(/\/$/, "")
const YEAR_S = 60 * 60 * 24 * 365

//routes the SPA draws for the admin, never indexed
const APP_ONLY = [/^\/login$/, /^\/forgot-password$/, /^\/reset-password$/, /^\/settings$/, /^\/edit-3d\/[0-9a-fA-F-]+$/, /^\/edit-detail\/\d+$/]

//the template's markers, checked once at boot: a build that moved them would
//otherwise serve pages without their content and nobody would notice
function loadTemplate(): string {
  const html = readFileSync(join(DIST_DIR, "index.html"), "utf8")
  for (const marker of [/<html lang="[a-z]+"/, /<title>[^<]*<\/title>/, /<meta name="description"[^>]*>/, /<div id="app"><\/div>/]) {
    if (!marker.test(html)) throw new Error(`[site] dist/index.html has no ${marker} - the SEO injection would silently do nothing`)
  }
  return html
}

//Saved theme as an inline style on <html>, there from the first paint
function themeStyle(theme: ThemeVars): string {
  const declarations = Object.entries(theme).map(([name, value]) => `${name}: ${value}`).join("; ")
  return declarations ? ` style="${escapeHtml(declarations)}"` : ""
}

//replacer functions, not strings: page content may hold "$&" and the like
function render(template: string, page: Page, theme: ThemeVars): string {
  return template
    .replace(/<html lang="[a-z]+"/, () => `<html lang="${page.lang}"${themeStyle(theme)}`)
    .replace(/<title>[^<]*<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", () => `    ${page.head}\n  </head>`)
    .replace(`<div id="app"></div>`, () => `<div id="app">${page.body}</div>`)
}

//the visitor's language cookie (written by useLang), French for crawlers
function langOf(req: Request): Lang {
  const held = req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`))?.[1]
  return isLang(held) ? held : LANG_DEFAULT
}

export function mountSite(app: Express): void {
  const template = loadTemplate()

  app.use(express.static(DIST_DIR, {
    index: false,
    setHeaders: (res, path) => {
      if (/[\\/]assets[\\/]/.test(path)) res.setHeader("Cache-Control", `public, max-age=${YEAR_S}, immutable`)
    },
  }))

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(robotsTxt(SITE))
  })

  app.get("/sitemap.xml", async (_req, res) => {
    const projects = await db.select({ id: mainProject.id, updatedAt: mainProject.updatedAt })
      .from(mainProject).where(eq(mainProject.published, true))
      .orderBy(asc(mainProject.sortOrder), asc(mainProject.id))
    const latest = projects.reduce<Date | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null)
    res.type("application/xml").send(sitemapXml(SITE, [
      { path: "/", lastmod: latest },
      ...projects.map((p) => ({ path: `/project/${p.id}`, lastmod: p.updatedAt })),
    ]))
  })

  app.get("/llms.txt", async (_req, res) => {
    res.type("text/markdown").send(llmsTxt(await publicPortfolio(), SITE))
  })

  app.get("/llms-full.txt", async (_req, res) => {
    res.type("text/markdown").send(llmsFullTxt(await publicPortfolio(), SITE))
  })

  app.get("/{*path}", async (req, res) => {
    const data = await publicPortfolio()
    const lang = langOf(req)
    const project = req.path.match(/^\/project\/(\d+)$/)
    const page =
      req.path === "/"                       ? homePage(data, SITE, lang) :
      project                                ? projectPage(data, SITE, lang, Number(project[1])) :
      APP_ONLY.some((r) => r.test(req.path)) ? appOnlyPage(data, lang) :
                                               notFoundPage(data, lang)
    res.status(page.status)
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Vary", "Cookie")
    res.type("html").send(render(template, page, data.theme))
  })
}

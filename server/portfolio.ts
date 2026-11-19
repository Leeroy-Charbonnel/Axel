import { Router, type Request, type Response, type NextFunction } from "express"
import { and, asc, eq, like } from "drizzle-orm"
import { db } from "../db/index"
import {
  settings, user, file as fileTable, software, mainProject, mainProjectSoftware,
  galleryProject, experience, profile, model3d,
} from "../db/schema"
import type {
  DetailBlock, DetailGridSettings, MainProjectDto, PortfolioDto, SoftwareDto,
} from "../src/types/portfolio"
import type { ImageSizes } from "../src/lib/media"
import { describeIssues, isAdmin, sessionUser } from "./http"
import { detailBlock, detailGrid } from "./validation"
import { readTheme } from "./routes/theme"
import { MODEL_THUMB_KIND } from "./thumbs"

//PORTFOLIO - the whole site in one payload, file ids resolved to /media URLs.
//Visitors get published rows only, and the models those rows show, from an
//in-memory memo every write invalidates; the admin gets every row, built
//fresh on each request.

const PUBLIC_MAX_AGE_S = 60

type Block = { id: string; type: string; content: Record<string, unknown> } & Record<string, unknown>

//a model row whose file has been deleted is a broken reference, not an empty
//field: the viewer gets "" either way, the log is what makes it findable
function logMissingFile(modelId: string, fileId: string): string {
  console.error(`[models] model ${modelId} points at file ${fileId}, which has no row`)
  return ""
}

async function buildPortfolio(admin: boolean): Promise<PortfolioDto> {
  const [
    fileRows, softwareRows, projectRows, junctionRows, galleryRows,
    experienceRows, profileRows, prefRows, modelRows, theme,
  ] = await Promise.all([
    db.select({ id: fileTable.id, storedFilename: fileTable.storedFilename, width: fileTable.width, height: fileTable.height, kind: fileTable.kind })
      .from(fileTable),
    db.select().from(software).orderBy(asc(software.sortOrder), asc(software.id)),
    db.select().from(mainProject)
      .where(admin ? undefined : eq(mainProject.published, true))
      .orderBy(asc(mainProject.sortOrder), asc(mainProject.id)),
    db.select().from(mainProjectSoftware).orderBy(asc(mainProjectSoftware.sortOrder)),
    db.select().from(galleryProject)
      .where(admin ? undefined : eq(galleryProject.published, true))
      .orderBy(asc(galleryProject.sortOrder), asc(galleryProject.id)),
    db.select().from(experience)
      .where(admin ? undefined : eq(experience.published, true))
      .orderBy(asc(experience.sortOrder), asc(experience.id)),
    db.select().from(profile).limit(1),
    //the admin's editor3d_* rows: public viewers layer these global wireframe
    //knobs over the values frozen into each model's viewerSettings
    db.select({ key: settings.key, value: settings.value })
      .from(settings)
      .innerJoin(user, eq(user.id, settings.userId))
      .where(and(eq(user.role, "admin"), like(settings.key, "editor3d_%")))
      .orderBy(asc(settings.userId), asc(settings.key)),
    db.select().from(model3d).orderBy(asc(model3d.name), asc(model3d.id)),
    readTheme(),
  ])

  const urlById = new Map(fileRows.map((f) => [f.id, `/media/${f.storedFilename}`]))
  const sizeByUrl = new Map(fileRows.flatMap((f) =>
    f.width && f.height ? [[`/media/${f.storedFilename}`, [f.width, f.height] as [number, number]]] : []))
  //every URL the payload hands out, so `images` carries the sizes of those only
  const used = new Set<string>()
  const track = <T extends string | null>(url: T): T => {
    if (url) used.add(url)
    return url
  }
  const urlOf = (id: string | null | undefined): string | null => track(id ? urlById.get(id) ?? null : null)
  //the model pictures the admin's browser rendered, as opposed to an image picked by hand
  const renders = new Set(fileRows.filter((f) => f.kind === MODEL_THUMB_KIND).map((f) => f.id))

  const softwareDtos: SoftwareDto[] = softwareRows.map((s) => ({
    id: s.id, key: s.key, url: s.url, logoFileId: s.logoFileId, logoUrl: urlOf(s.logoFileId),
  }))
  const softwareById = new Map(softwareDtos.map((s) => [s.id, s]))

  //A stored block that does not match its schema (written by hand, or before
  //the schema existed) is logged on every build. Visitors never get it; the
  //admin does, so the editor shows it and its save says what is wrong.
  function checkedBlocks(projectId: number, blocks: unknown[]): Block[] {
    return blocks.flatMap((b) => {
      const result = detailBlock.safeParse(b)
      if (result.success) return [b as Block]
      console.error(`[portfolio] project ${projectId}, block ${(b as { id?: unknown }).id}: ${describeIssues(result.error)}`)
      return admin ? [b as Block] : []
    })
  }

  //A stored grid that does not match its schema is logged and left out: the page gets the default grid
  function checkedGrid(projectId: number, grid: unknown): DetailGridSettings | undefined {
    if (grid === undefined) return undefined
    const result = detailGrid.safeParse(grid)
    if (result.success) return result.data
    console.error(`[portfolio] project ${projectId}, grid: ${describeIssues(result.error)}`)
    return undefined
  }

  //DETAIL PAGE blocks carry file ids; the url next to each one is for rendering
  //and is stripped back to null by the editor on save
  function resolveBlock(b: Block): Block {
    const c = b.content
    if (b.type === "image" || b.type === "video") {
      const fid = (c.fileId as string | null | undefined) ?? null
      return { ...b, content: { ...c, fileId: fid, url: urlOf(fid) } }
    }
    if (b.type === "compare") {
      const before = (c.beforeFileId as string | null | undefined) ?? null
      const after  = (c.afterFileId  as string | null | undefined) ?? null
      return { ...b, content: { ...c, beforeFileId: before, beforeUrl: urlOf(before), afterFileId: after, afterUrl: urlOf(after) } }
    }
    if (b.type === "carousel" || b.type === "marquee" || b.type === "sequence" || b.type === "materials") {
      const items = Array.isArray(c.items) ? c.items as Array<Record<string, unknown>> : []
      return { ...b, content: { ...c, items: items.map((it) => ({ ...it, url: urlOf(it.fileId as string | null | undefined) })) } }
    }
    return b
  }

  const mainProjects: MainProjectDto[] = projectRows.map((p) => ({
    id:                  p.id,
    title:               p.title,
    description:         p.description,
    published:           p.published,
    role:                p.role,
    year:                p.year,
    mainImageUrl:        urlOf(p.mainImageFileId),
    mainWireframeUrl:    urlOf(p.mainWireframeFileId),
    model3dId:           p.model3dId,
    model3dDesktopView:  p.model3dDesktopView,
    model3dMobileView:   p.model3dMobileView,
    thumbnails: p.thumbnails.map((t) => ({
      fileId:          t.fileId,
      wireframeFileId: t.wireframeFileId,
      url:             urlOf(t.fileId),
      wireframeUrl:    urlOf(t.wireframeFileId),
      description:     t.description,
    })),
    detailPage:          {
      blocks: checkedBlocks(p.id, p.detailPage.blocks).map(resolveBlock) as unknown as DetailBlock[],
      grid:   checkedGrid(p.id, p.detailPage.grid),
    },
    stats:               p.stats,
    software: junctionRows
      .filter((j) => j.mainProjectId === p.id)
      .flatMap((j) => softwareById.get(j.softwareId) ?? []),
  }))

  //a visitor gets the models a published project shows, and no other: the
  //rest carry the files and settings of work that is not public
  const shownModels = new Set(mainProjects.flatMap((p) => [
    p.model3dId,
    ...p.detailPage.blocks.flatMap((b) => b.type === "viewer3d" ? [(b.content as { model3dId: string | null }).model3dId] : []),
  ]))
  const visibleModels = admin ? modelRows : modelRows.filter((m) => shownModels.has(m.id))

  const prefs = new Map<string, string>()
  for (const r of prefRows) if (!prefs.has(r.key)) prefs.set(r.key, r.value)

  const profileRow = profileRows[0]

  const portfolio: Omit<PortfolioDto, "images"> = {
    software: softwareDtos,
    models: visibleModels.map((m) => ({
      id:              m.id,
      name:            m.name,
      glbFileId:       m.glbFileId,
      glbUrl:          urlOf(m.glbFileId) ?? logMissingFile(m.id, m.glbFileId),
      glbPhoneUrl:     urlOf(m.phoneGlbFileId),
      thumbnailFileId: m.thumbnailFileId,
      thumbnailUrl:    urlOf(m.thumbnailFileId),
      ...(admin ? { thumbnailRendered: m.thumbnailFileId !== null && renders.has(m.thumbnailFileId) } : {}),
      viewerSettings:  m.viewerSettings,
      views:           m.views,
    })),
    mainProjects,
    galleryProjects: galleryRows.map((g) => ({
      id:        g.id,
      published: g.published,
      title:     g.title,
      link:      g.link,
      imageUrl:  urlOf(g.imageFileId),
      stats:     g.stats,
    })),
    experiences: experienceRows.map((e) => ({
      id:          e.id,
      period:      e.period,
      title:       e.title,
      company:     e.company,
      location:    e.location,
      summary:     e.summary,
      description: e.description,
      published:   e.published,
    })),
    profile: profileRow ? {
      name:         profileRow.name,
      headline:     profileRow.headline,
      pitch:        profileRow.pitch,
      location:     profileRow.location,
      available:    profileRow.available,
      availability: profileRow.availability,
      about:        profileRow.about,
      contact:      profileRow.contact,
      links:        profileRow.links,
      interests:    profileRow.interests,
      avatarUrl:    track(profileRow.avatarUrl),
      cvUrl:        urlOf(profileRow.cvFileId),
    } : null,
    editorPrefs: {
      wireframeModeColor: prefs.get("editor3d_wireframe_mode_color") ?? null,
      wireframeMaterial:  prefs.get("editor3d_wireframe_material")   ?? null,
      wireframeLineWidth: prefs.get("editor3d_wireframe_line_width") ?? null,
    },
    theme,
  }
  const images: ImageSizes = {}
  for (const url of used) {
    const size = sizeByUrl.get(url)
    if (size) images[url] = size
  }
  return { ...portfolio, images }
}

//PUBLIC MEMO, production only. A successful admin write bumps the generation
//when it ends: a build that started earlier, even mid-write, holds an older
//generation and is never served again. In development the dev database is also
//written by scripts (import-renders, seeds) the server never hears about, so
//every request builds afresh.
const MEMOIZE = process.env.NODE_ENV === "production"
let generation = 0
let memo: { generation: number; value: Promise<PortfolioDto> } | null = null

function invalidate(): void {
  generation++
  memo = null
}

export function publicPortfolio(): Promise<PortfolioDto> {
  if (!MEMOIZE) return buildPortfolio(false)
  if (memo && memo.generation === generation) return memo.value
  const value = buildPortfolio(false)
  const entry = { generation, value }
  memo = entry
  //a failed build is not cached; the caller still receives the rejection
  value.catch(() => { if (memo === entry) memo = null })
  return value
}

//Mounted on /api after the auth handler. requireAdmin sets res.locals.user:
//a request without it, or one that failed, wrote nothing.
export function invalidateOnWrite(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.on("finish", () => {
      if (res.locals.user && res.statusCode < 400) invalidate()
    })
  }
  next()
}

export const portfolioRouter = Router()

portfolioRouter.get("/api/portfolio", async (req, res) => {
  //the same URL answers two audiences: a browser must not hand the visitor's
  //cached copy to the admin who signs in afterwards
  res.setHeader("Vary", "Cookie")
  if (isAdmin(await sessionUser(req))) {
    res.setHeader("Cache-Control", "private, no-store")
    res.json(await buildPortfolio(true))
    return
  }
  res.setHeader("Cache-Control", `public, max-age=${PUBLIC_MAX_AGE_S}`)
  res.json(await publicPortfolio())
})

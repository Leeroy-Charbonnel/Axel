import { Router, type Request, type Response, type NextFunction } from "express"
import { and, asc, eq, like } from "drizzle-orm"
import { db } from "../db/index"
import {
  settings, user, file as fileTable, software, mainProject, mainProjectSoftware,
  galleryProject, experience, profile, model3d,
} from "../db/schema"
import type {
  DetailBlock, MainProjectDto, MainProjectLayout, PortfolioDto, SoftwareDto,
} from "../src/types/portfolio"
import { isAdmin, sessionUser } from "./http"

//PORTFOLIO - the whole site in one payload, file ids resolved to /media URLs.
//Visitors get published rows only, from an in-memory memo every write
//invalidates; the admin gets every row, built fresh on each request.

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
    experienceRows, profileRows, prefRows, modelRows,
  ] = await Promise.all([
    db.select({ id: fileTable.id, storedFilename: fileTable.storedFilename }).from(fileTable),
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
  ])

  const urlById = new Map(fileRows.map((f) => [f.id, `/media/${f.storedFilename}`]))
  const urlOf = (id: string | null | undefined): string | null => (id ? urlById.get(id) ?? null : null)

  const softwareDtos: SoftwareDto[] = softwareRows.map((s) => ({
    id: s.id, key: s.key, url: s.url, logoFileId: s.logoFileId, logoUrl: urlOf(s.logoFileId),
  }))
  const softwareById = new Map(softwareDtos.map((s) => [s.id, s]))

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
    if (b.type === "carousel" || b.type === "marquee") {
      const items = Array.isArray(c.items) ? c.items as Array<Record<string, unknown>> : []
      return { ...b, content: { ...c, items: items.map((it) => ({ ...it, url: urlOf(it.fileId as string | null | undefined) })) } }
    }
    return b
  }

  const mainProjects: MainProjectDto[] = projectRows.map((p) => ({
    id:                  p.id,
    modelId:             p.modelId,
    layout:              p.layout as MainProjectLayout,
    title:               p.title,
    description:         p.description,
    published:           p.published,
    role:                p.role,
    year:                p.year,
    mainImageUrl:        urlOf(p.mainImageFileId),
    mainWireframeUrl:    urlOf(p.mainWireframeFileId),
    videoUrl:            urlOf(p.videoFileId),
    model3dId:           p.model3dId,
    model3dDesktopView:  p.model3dDesktopView,
    model3dMobileView:   p.model3dMobileView,
    glbFileId:           p.glbFileId,
    glbUrl:              urlOf(p.glbFileId),
    viewerSettings:      p.viewerSettings,
    thumbnails: p.thumbnails.map((t) => ({
      fileId:          t.fileId,
      wireframeFileId: t.wireframeFileId,
      url:             urlOf(t.fileId),
      wireframeUrl:    urlOf(t.wireframeFileId),
      description:     t.description,
    })),
    wireframeParameters: p.wireframeParameters,
    detailPage:          { blocks: (p.detailPage.blocks as Block[]).map(resolveBlock) as unknown as DetailBlock[] },
    stats:               p.stats,
    software: junctionRows
      .filter((j) => j.mainProjectId === p.id)
      .flatMap((j) => softwareById.get(j.softwareId) ?? []),
  }))

  const prefs = new Map<string, string>()
  for (const r of prefRows) if (!prefs.has(r.key)) prefs.set(r.key, r.value)

  const profileRow = profileRows[0]

  return {
    software: softwareDtos,
    models: modelRows.map((m) => ({
      id:              m.id,
      name:            m.name,
      glbFileId:       m.glbFileId,
      glbUrl:          urlOf(m.glbFileId) ?? logMissingFile(m.id, m.glbFileId),
      thumbnailFileId: m.thumbnailFileId,
      thumbnailUrl:    urlOf(m.thumbnailFileId),
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
      avatarUrl:    profileRow.avatarUrl,
      cvUrl:        urlOf(profileRow.cvFileId),
    } : null,
    editorPrefs: {
      wireframeLineColor: prefs.get("editor3d_wireframe_line_color") ?? null,
      wireframeModeColor: prefs.get("editor3d_wireframe_mode_color") ?? null,
      wireframeMaterial:  prefs.get("editor3d_wireframe_material")   ?? null,
      wireframeLineWidth: prefs.get("editor3d_wireframe_line_width") ?? null,
    },
  }
}

//PUBLIC MEMO. A write bumps the generation when it starts and when it ends,
//so a build that read the database mid-write is never kept.
let generation = 0
let memo: { generation: number; value: Promise<PortfolioDto> } | null = null

function invalidate(): void {
  generation++
  memo = null
}

export function publicPortfolio(): Promise<PortfolioDto> {
  if (memo && memo.generation === generation) return memo.value
  const value = buildPortfolio(false)
  const entry = { generation, value }
  memo = entry
  //a failed build is not cached; the caller still receives the rejection
  value.catch(() => { if (memo === entry) memo = null })
  return value
}

//mounted on /api after the auth handler: every non-GET request is a write
export function invalidateOnWrite(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    invalidate()
    res.on("finish", invalidate)
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

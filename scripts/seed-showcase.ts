#!/usr/bin/env bun
//SEED THE SHOWCASE PAGES - unpublished main projects (only the admin sees
//them) whose detail pages use every block type in varied layouts, built from
//files already in the database: nothing is uploaded.
//
//IDEMPOTENT: every row whose French title starts with "Showcase" is deleted
//and written again; no other row is touched. DATABASE_URL only, never the
//production database.
//
//Usage: bun scripts/seed-showcase.ts

import { asc, inArray, like, sql } from "drizzle-orm"
import { db } from "../db/index"
import { file, galleryProject, mainProject, mainProjectSoftware, model3d, software } from "../db/schema"
import { mainProjectPatch } from "../server/validation"
import { SHOWCASE_PREFIX, showcaseProjects, type ShowcaseMedia } from "../src/lib/showcase-content"

const SOFTWARE_KEYS = ["Blender", "Substance", "Photoshop"]

function refuseProduction() {
  const dev = process.env.DATABASE_URL
  if (!dev) throw new Error("DATABASE_URL is not set")
  if (process.env.PROD_DATABASE_URL && dev === process.env.PROD_DATABASE_URL) {
    throw new Error("DATABASE_URL is the production database: refusing to seed showcase rows there")
  }
}

//images already shown on the site first: they are finished renders
async function loadMedia(): Promise<ShowcaseMedia> {
  const projects = await db.select({ main: mainProject.mainImageFileId, thumbs: mainProject.thumbnails }).from(mainProject)
  const gallery  = await db.select({ id: galleryProject.imageFileId }).from(galleryProject)
  const shown = new Set<string>()
  for (const p of projects) {
    if (p.main) shown.add(p.main)
    for (const t of p.thumbs) if (t.fileId) shown.add(t.fileId)
  }
  for (const g of gallery) if (g.id) shown.add(g.id)

  const files = await db.select({ id: file.id, mime: file.mimeType, name: file.originalFilename }).from(file).orderBy(asc(file.createdAt))
  const isImage = (f: typeof files[number]) => f.mime.startsWith("image/") && !/\.(hdr|exr|hdri)$/i.test(f.name) && f.mime !== "image/x-exr"
  const images = files.filter(isImage).sort((a, b) => Number(shown.has(b.id)) - Number(shown.has(a.id)))
  const videos = files.filter((f) => f.mime.startsWith("video/"))

  const models = (await db.select({ id: model3d.id, name: model3d.name, views: model3d.views }).from(model3d))
    .filter((m) => m.views.length > 0)
    .map((m) => ({ id: m.id, name: m.name, view: m.views[0]!.name }))

  return {
    images: images.map((f) => ({ id: f.id, url: null })),
    videos: videos.map((f) => ({ id: f.id, url: null })),
    models,
  }
}

async function main() {
  refuseProduction()
  const media = await loadMedia()
  console.log(`media: ${media.images.length} image(s), ${media.videos.length} video(s), ${media.models.length} model(s) with views`)

  const projects = showcaseProjects(media)
  //the same allow-list the API applies to a detail page save
  for (const p of projects) mainProjectPatch.parse({ detailPage: { blocks: p.blocks } })

  const tools = await db.select({ id: software.id }).from(software).where(inArray(software.key, SOFTWARE_KEYS))

  await db.transaction(async (tx) => {
    const removed = await tx.delete(mainProject)
      .where(like(sql`${mainProject.title}->>'fr'`, `${SHOWCASE_PREFIX}%`))
      .returning({ id: mainProject.id })
    console.log(`removed ${removed.length} previous showcase row(s)`)

    const [order] = await tx.execute<{ next: number }>(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${mainProject}`)
    for (const [i, p] of projects.entries()) {
      const [row] = await tx.insert(mainProject).values({
        title:               p.title,
        description:         p.description,
        role:                p.role,
        year:                p.year,
        published:           false,
        stats:               p.stats,
        detailPage:          { blocks: p.blocks as never },
        sortOrder:           Number(order!.next) + i,
      }).returning({ id: mainProject.id })
      if (tools.length) {
        await tx.insert(mainProjectSoftware).values(tools.map((s, k) => ({ mainProjectId: row!.id, softwareId: s.id, sortOrder: k })))
      }
      const types = [...new Set(p.blocks.map((b) => b.type))].join(", ")
      console.log(`created #${row!.id} "${p.title.fr}": ${p.blocks.length} blocks (${types}), phone layout ${p.blocks.every((b) => b.mobileY !== undefined) ? "authored" : "automatic"}`)
    }
  })
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

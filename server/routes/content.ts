import { Router } from "express"
import { eq, sql } from "drizzle-orm"
import { db } from "../../db/index"
import {
  file as fileTable, software, mainProject, mainProjectSoftware, galleryProject, experience, profile,
} from "../../db/schema"
import { HttpError, adminId, intParam, notFound, parse, parsePatch, requireAdmin } from "../http"
import {
  experiencePatch, galleryProjectPatch, mainProjectPatch, orderBody, profilePatch,
  projectSoftwareBody, softwareCreate, softwarePatch,
} from "../validation"
import { receiveMedia, recordUpload } from "../uploads"
import { fileRefCount } from "./files"

//PORTFOLIO MUTATIONS, all admin only. PUT takes a partial body checked
//against an allow-list; POST creates a row with placeholders the admin fills
//in inline; DELETE removes the row, files stay.

type Ordered = typeof mainProject | typeof galleryProject | typeof experience

async function nextSortOrder(table: Ordered | typeof software): Promise<number> {
  const [row] = await db.execute<{ next: number }>(sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table}`)
  return Number(row!.next)
}

//body { ids } lists every row of the table once, in the new order
async function reorder(table: Ordered, ids: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: number }>(sql`SELECT id FROM ${table} FOR UPDATE`)
    const known = new Set(rows.map((r) => r.id))
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new HttpError(400, `ids must list each of the ${known.size} rows exactly once`)
    }
    if (ids.length === 0) return
    const cases = sql.join(ids.map((id, i) => sql`WHEN ${id} THEN ${i}`), sql` `)
    await tx.execute(sql`UPDATE ${table} SET sort_order = (CASE id ${cases} END)::int`)
  })
}

export const contentRouter = Router()

//MAIN PROJECT
contentRouter.post("/api/main-project", requireAdmin, async (_req, res) => {
  const [row] = await db.insert(mainProject).values({
    title:               { en: "New project", fr: "Nouveau projet" },
    description:         { en: "Project description", fr: "Description du projet" },
    stats:               { vertices: 0, edges: 0, faces: 0, triangles: 0 },
    sortOrder:           await nextSortOrder(mainProject),
    //Hidden until the editor saves it
    published: false,
  }).returning()
  res.json(row)
})

//declared before /:id so "order" is not read as an id
contentRouter.put("/api/main-project/order", requireAdmin, async (req, res) => {
  await reorder(mainProject, parse(orderBody, req.body).ids)
  res.status(204).end()
})

contentRouter.put("/api/main-project/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const patch = parsePatch(mainProjectPatch, req.body)
  const [row] = await db.update(mainProject)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mainProject.id, id))
    .returning()
  if (!row) notFound()
  res.json(row)
})

contentRouter.delete("/api/main-project/:id", requireAdmin, async (req, res) => {
  await db.delete(mainProject).where(eq(mainProject.id, intParam(req, "id")))
  res.json({ ok: true })
})

//replaces the project's software list, in the given order
contentRouter.put("/api/main-project/:id/software", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const { softwareIds } = parse(projectSoftwareBody, req.body)
  await db.transaction(async (tx) => {
    await tx.delete(mainProjectSoftware).where(eq(mainProjectSoftware.mainProjectId, id))
    if (softwareIds.length === 0) return
    await tx.insert(mainProjectSoftware).values(
      softwareIds.map((softwareId, i) => ({ mainProjectId: id, softwareId, sortOrder: i })),
    )
  })
  res.json({ ok: true })
})

//GALLERY PROJECT
contentRouter.post("/api/gallery-project", requireAdmin, async (_req, res) => {
  const [row] = await db.insert(galleryProject).values({
    title:     { en: "New gallery item", fr: "Nouvel élément" },
    link:      "",
    stats:     { vertices: 0, edges: 0, faces: 0, triangles: 0 },
    sortOrder: await nextSortOrder(galleryProject),
    //Hidden until the editor saves it
    published: false,
  }).returning()
  res.json(row)
})

contentRouter.put("/api/gallery-project/order", requireAdmin, async (req, res) => {
  await reorder(galleryProject, parse(orderBody, req.body).ids)
  res.status(204).end()
})

contentRouter.put("/api/gallery-project/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const [row] = await db.update(galleryProject)
    .set(parsePatch(galleryProjectPatch, req.body))
    .where(eq(galleryProject.id, id))
    .returning()
  if (!row) notFound()
  res.json(row)
})

contentRouter.delete("/api/gallery-project/:id", requireAdmin, async (req, res) => {
  await db.delete(galleryProject).where(eq(galleryProject.id, intParam(req, "id")))
  res.json({ ok: true })
})

//EXPERIENCE
contentRouter.post("/api/experience", requireAdmin, async (_req, res) => {
  const [row] = await db.insert(experience).values({
    period:      { en: "YYYY-YYYY", fr: "AAAA-AAAA" },
    title:       { en: "Role", fr: "Poste" },
    company:     "Company",
    location:    "City",
    summary:     { en: "", fr: "" },
    description: { en: [], fr: [] },
    sortOrder:   await nextSortOrder(experience),
    //Hidden until the editor saves it
    published: false,
  }).returning()
  res.json(row)
})

contentRouter.put("/api/experience/order", requireAdmin, async (req, res) => {
  await reorder(experience, parse(orderBody, req.body).ids)
  res.status(204).end()
})

contentRouter.put("/api/experience/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const [row] = await db.update(experience)
    .set(parsePatch(experiencePatch, req.body))
    .where(eq(experience.id, id))
    .returning()
  if (!row) notFound()
  res.json(row)
})

contentRouter.delete("/api/experience/:id", requireAdmin, async (req, res) => {
  await db.delete(experience).where(eq(experience.id, intParam(req, "id")))
  res.json({ ok: true })
})

//SOFTWARE
//multipart: the logo file plus the key and url fields, one round-trip. A
//refused field or a taken key rolls the stored logo back.
contentRouter.post("/api/software", requireAdmin, async (req, res) => {
  const logo = await receiveMedia("logo", req, res)
  let created: typeof software.$inferSelect | undefined
  await recordUpload(logo, adminId(res), async (tx, fileRow) => {
    const { key, url } = parse(softwareCreate, req.body)
    const [taken] = await tx.select({ id: software.id }).from(software).where(eq(software.key, key))
    if (taken) throw new HttpError(409, `software "${key}" already exists`)
    ;[created] = await tx.insert(software).values({
      key,
      url,
      logoFileId: fileRow.id,
      sortOrder:  await nextSortOrder(software),
    }).returning()
  })
  res.json(created)
})

contentRouter.put("/api/software/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const [row] = await db.update(software)
    .set(parsePatch(softwarePatch, req.body))
    .where(eq(software.id, id))
    .returning()
  if (!row) notFound()
  res.json(row)
})

//Deleting a software also deletes its logo's file row once nothing else
//references it; the bytes stay. Junction rows cascade.
contentRouter.delete("/api/software/:id", requireAdmin, async (req, res) => {
  const id = intParam(req, "id")
  const [row] = await db.delete(software).where(eq(software.id, id)).returning({ logoFileId: software.logoFileId })
  if (row && await fileRefCount(row.logoFileId) === 0) {
    await db.delete(fileTable).where(eq(fileTable.id, row.logoFileId))
  }
  res.json({ ok: true })
})

//PROFILE - a single row, created by the first PUT
contentRouter.put("/api/profile", requireAdmin, async (req, res) => {
  const patch = parsePatch(profilePatch, req.body)
  const [existing] = await db.select({ id: profile.id }).from(profile).limit(1)
  if (!existing) {
    const [row] = await db.insert(profile).values({
      about:     { en: "", fr: "" },
      contact:   { phone: "", email: "" },
      interests: { games: [], art: [] },
      ...patch,
    }).returning()
    res.json(row)
    return
  }
  const [row] = await db.update(profile).set(patch).where(eq(profile.id, existing.id)).returning()
  res.json(row)
})

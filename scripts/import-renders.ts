#!/usr/bin/env bun
//IMPORT RENDER FOLDERS AS REAL PROJECTS - each folder under the given root
//holds a manifest.json and its files (see the render session's contract):
//- with a model.glb it becomes a main project: model_3d row (optimized like an
//  upload), main image, wireframe, thumbnails, and a case-study page;
//- with a card.jpg it becomes a gallery card.
//
//IDEMPOTENT: a file already imported (same "<slug>/<name>" original name) is
//reused, a project or card with the same French title is updated in place.
//--retire unpublishes every other main project and gallery card. DATABASE_URL
//only, never the production database.
//
//Usage: bun scripts/import-renders.ts <root> [--retire]

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { basename, extname, join } from "node:path"
import { and, eq, notInArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getBounds, NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { MeshoptDecoder } from "meshoptimizer"
import { db } from "../db/index"
import { file, galleryProject, mainProject, mainProjectSoftware, model3d, software, user } from "../db/schema"
import { galleryProjectPatch, mainProjectPatch } from "../server/validation"
import { measureImage, STORAGE_DIR } from "../server/uploads"
import { optimizeModel } from "../server/model-optimize"
import { caseStudyBlocks } from "../src/lib/case-study"
import { CAMERA_FOV } from "../src/three/autoSetup"

const VIEW = "Default"

const MIME: Record<string, { mime: string; kind: string; dir: string }> = {
  ".jpg":  { mime: "image/jpeg",        kind: "image", dir: "images" },
  ".jpeg": { mime: "image/jpeg",        kind: "image", dir: "images" },
  ".png":  { mime: "image/png",         kind: "image", dir: "images" },
  ".webp": { mime: "image/webp",        kind: "image", dir: "images" },
  ".gif":  { mime: "image/gif",         kind: "image", dir: "images" },
  ".mp4":  { mime: "video/mp4",         kind: "video", dir: "images" },
  ".glb":  { mime: "model/gltf-binary", kind: "other", dir: "models" },
}

const bilingual = z.strictObject({ fr: z.string().min(1), en: z.string().min(1) })
const stats = z.object({
  vertices:  z.int().nonnegative(),
  edges:     z.int().nonnegative(),
  faces:     z.int().nonnegative().optional(),
  triangles: z.int().nonnegative().optional(),
})
const vec3 = z.tuple([z.number(), z.number(), z.number()])
type Vec3 = [number, number, number]

const mainManifest = z.object({
  slug:        z.string().min(1),
  title:       bilingual,
  description: bilingual,
  role:        bilingual,
  year:        z.coerce.string(),
  software:    z.array(z.string()),
  stats,
  //the camera of main.jpg, in the GLB frame, fov vertical in degrees
  camera:      z.object({ position: vec3, target: vec3, fov: z.number().positive() }),
})
const galleryManifest = z.object({ title: bilingual, stats })

function refuseProduction() {
  const dev = process.env.DATABASE_URL
  if (!dev) throw new Error("DATABASE_URL is not set")
  if (process.env.PROD_DATABASE_URL && dev === process.env.PROD_DATABASE_URL) {
    throw new Error("DATABASE_URL is the production database: refusing to import there")
  }
}

async function adminId(): Promise<string> {
  const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.role, "admin"))
  if (!admin) throw new Error("no admin account: the files need an uploader")
  return admin.id
}

//the file row for one file of a folder, created on first import
async function storeFile(dir: string, slug: string, name: string, uploader: string): Promise<string> {
  const original = `${slug}/${name}`
  const [known] = await db.select({ id: file.id }).from(file).where(eq(file.originalFilename, original))
  if (known) return known.id

  const type = MIME[extname(name).toLowerCase()]
  if (!type) throw new Error(`${original}: extension not imported`)
  const id = randomUUID()
  const stored = `${type.dir}/${id}${extname(name).toLowerCase()}`
  mkdirSync(join(STORAGE_DIR, type.dir), { recursive: true })
  copyFileSync(join(dir, name), join(STORAGE_DIR, stored))
  const size = type.kind === "image" ? await measureImage(join(STORAGE_DIR, stored)) : { width: null, height: null }
  await db.insert(file).values({
    id, originalFilename: original, storedFilename: stored, mimeType: type.mime,
    sizeBytes: statSync(join(dir, name)).size, ...size, kind: type.kind, uploadedBy: uploader,
  })
  return id
}

//THE RENDER CAMERA AS THE MODEL'S VIEW. The viewer stands the model on the
//ground, centred on the vertical axis (modelViewer.ts), so the camera moves by
//the same offset. Its distance is scaled to the viewer's field of view, so the
//model fills the frame as it fills main.jpg.
async function viewerView(glbPath: string, camera: { position: Vec3; target: Vec3; fov: number }): Promise<{ position: Vec3; target: Vec3 }> {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder })
  const { min, max } = getBounds((await io.read(glbPath)).getRoot().getDefaultScene()!)
  const offset: Vec3 = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
  const target = camera.target.map((v, i) => v - offset[i]!) as Vec3
  const scale = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((CAMERA_FOV * Math.PI) / 360)
  const position = camera.position.map((v, i) => target[i]! + (v - offset[i]! - target[i]!) * scale) as Vec3
  return { position, target }
}

//the folder's details, sorted by name
function detailNames(dir: string): string[] {
  return readdirSync(dir).filter((n) => /^detail-\d+\.(jpe?g|png|webp)$/i.test(n)).sort()
}

async function importMain(dir: string, uploader: string): Promise<number> {
  const m = mainManifest.parse(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")))
  const put = (name: string) => storeFile(dir, m.slug, name, uploader)
  const has = (name: string) => existsSync(join(dir, name))

  const glbId = await put("model.glb")
  const mainId = await put("main.jpg")
  const wireId = await put("main-wire.jpg")
  const detailIds = await Promise.all(detailNames(dir).map(put))
  const videoId = has("turntable.mp4") ? await put("turntable.mp4") : null
  const gifId = has("turntable.gif") ? await put("turntable.gif") : null

  //MODEL - one per GLB, optimized once
  const view = await viewerView(join(dir, "model.glb"), m.camera)
  const views = [{ name: VIEW, position: view.position, target: view.target, wireframe: false }]
  let [model] = await db.select().from(model3d).where(eq(model3d.sourceGlbFileId, glbId))
  if (!model) [model] = await db.select().from(model3d).where(eq(model3d.glbFileId, glbId))
  if (model) {
    await db.update(model3d).set({ name: m.title.en, views, updatedAt: new Date() }).where(eq(model3d.id, model.id))
  } else {
    [model] = await db.insert(model3d).values({ name: m.title.en, glbFileId: glbId, views }).returning()
  }
  if (!model!.sourceGlbFileId) {
    const { report } = await optimizeModel(model!)
    console.log(`  ${m.slug}: GLB ${(report.bytesBefore / 1048576).toFixed(1)} MB -> ${(report.bytesAfter / 1048576).toFixed(1)} MB`)
  }

  const thumbnails = [...detailIds, ...(gifId ? [gifId] : [])].map((fileId) => ({ fileId, wireframeFileId: null, description: m.title }))
  const values = mainProjectPatch.required().parse({
    title: m.title, description: m.description, published: true, role: m.role, year: m.year,
    mainImageFileId: mainId, mainWireframeFileId: wireId,
    model3dId: model!.id, model3dDesktopView: VIEW, model3dMobileView: VIEW,
    thumbnails,
    detailPage: { blocks: caseStudyBlocks({
      modelId: model!.id, view: VIEW, mainId, wireId, detailIds, videoId,
    }) },
    stats: m.stats,
  })

  const [existing] = await db.select({ id: mainProject.id }).from(mainProject).where(sql`${mainProject.title}->>'fr' = ${m.title.fr}`)
  const id = existing
    ? (await db.update(mainProject).set({ ...values, updatedAt: new Date() }).where(eq(mainProject.id, existing.id)).returning({ id: mainProject.id }))[0]!.id
    : (await db.insert(mainProject).values(values).returning({ id: mainProject.id }))[0]!.id

  //SOFTWARE - the keys the site knows; an unknown one is reported, not created
  const tools = m.software.length ? await db.select({ id: software.id, key: software.key }).from(software) : []
  const picked = m.software.map((key) => {
    const tool = tools.find((t) => t.key.toLowerCase() === key.toLowerCase())
    if (!tool) console.warn(`  ${m.slug}: software "${key}" has no row in the software table, left out`)
    return tool
  }).filter((t) => t !== undefined)
  await db.delete(mainProjectSoftware).where(eq(mainProjectSoftware.mainProjectId, id))
  if (picked.length) await db.insert(mainProjectSoftware).values(picked.map((t, i) => ({ mainProjectId: id, softwareId: t.id, sortOrder: i })))
  return id
}

async function importGallery(dir: string, uploader: string): Promise<number> {
  const g = galleryManifest.parse(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")))
  const imageFileId = await storeFile(dir, basename(dir), "card.jpg", uploader)
  const values = galleryProjectPatch.required().parse({ title: g.title, link: "", imageFileId, stats: g.stats, published: true })
  const [existing] = await db.select({ id: galleryProject.id }).from(galleryProject).where(sql`${galleryProject.title}->>'fr' = ${g.title.fr}`)
  if (existing) {
    await db.update(galleryProject).set(values).where(eq(galleryProject.id, existing.id))
    return existing.id
  }
  return (await db.insert(galleryProject).values(values).returning({ id: galleryProject.id }))[0]!.id
}

async function main() {
  refuseProduction()
  const root = process.argv[2]
  if (!root) throw new Error("usage: bun scripts/import-renders.ts <root> [--retire]")
  const retire = process.argv.includes("--retire")
  const uploader = await adminId()

  const mainIds: number[] = []
  const galleryIds: number[] = []
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name)
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, "manifest.json"))) continue
    if (existsSync(join(dir, "model.glb"))) {
      mainIds.push(await importMain(dir, uploader))
      console.log(`main project ${name} -> #${mainIds.at(-1)}`)
    } else if (existsSync(join(dir, "card.jpg"))) {
      galleryIds.push(await importGallery(dir, uploader))
      console.log(`gallery card ${name} -> #${galleryIds.at(-1)}`)
    } else {
      console.warn(`${name}: neither model.glb nor card.jpg, skipped`)
    }
  }

  //ORDER - the imported rows first, in folder order
  for (const [i, id] of mainIds.entries()) await db.update(mainProject).set({ sortOrder: i }).where(eq(mainProject.id, id))
  for (const [i, id] of galleryIds.entries()) await db.update(galleryProject).set({ sortOrder: i }).where(eq(galleryProject.id, id))

  if (retire) {
    if (mainIds.length) {
      const r = await db.update(mainProject).set({ published: false, sortOrder: mainIds.length })
        .where(and(notInArray(mainProject.id, mainIds), eq(mainProject.published, true))).returning({ id: mainProject.id })
      console.log(`unpublished ${r.length} other main project(s)`)
    }
    if (galleryIds.length) {
      const r = await db.update(galleryProject).set({ published: false, sortOrder: galleryIds.length })
        .where(and(notInArray(galleryProject.id, galleryIds), eq(galleryProject.published, true))).returning({ id: galleryProject.id })
      console.log(`unpublished ${r.length} other gallery card(s)`)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

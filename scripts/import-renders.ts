#!/usr/bin/env bun
//IMPORT RENDER FOLDERS AS REAL PROJECTS - each folder under the given root
//holds a manifest.json and its files (see the render session's contract):
//- the folders named in --main, in that order, become main projects: model_3d
//  row (optimized like an upload), main image, wireframe, thumbnails, and a
//  case-study page;
//- every other folder with a card.jpg becomes a gallery card, by name.
//
//IDEMPOTENT: a file already imported (same "<slug>/<name>" original name and
//same size) is reused, a re-rendered one is stored anew, a project or card with the same French title is updated in place.
//--retire unpublishes every other main project and gallery card.
//DATABASE_URL only, never the production database.
//
//Usage: bun scripts/import-renders.ts <root> --main=a,b,c [--retire]

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
import { CASE_STUDY_VIEWS, caseStudyBlocks, type CaseStudyStep, type CaseStudyView, type ModelShape } from "../src/lib/case-study"
import { sheetBlocks, type SheetImage } from "../src/lib/project-sheet"
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
const processStep = z.object({
  section: bilingual.optional(),
  image:   z.string().min(1).optional(),
  video:   z.string().min(1).optional(),
  //width / height of a video; an image is measured
  aspect:  z.number().positive().optional(),
  title:   bilingual,
  text:    bilingual,
}).refine((s) => Boolean(s.image) !== Boolean(s.video), "a step has an image or a video")
  .refine((s) => !s.video || s.aspect !== undefined, "a video step gives its aspect")
const processManifest = z.object({
  intro: bilingual,
  steps: z.array(processStep),
  outro: bilingual,
  evolution: z.array(z.object({ image: z.string().min(1), label: bilingual })).optional(),
})

//THE TECHNICAL PLAN of a project, sheet/sheet.json: every path is inside sheet/
const labelled = z.object({ image: z.string().min(1), label: bilingual })
const sheetManifest = z.object({
  intro:     bilingual.optional(),
  plans:     z.object({ image: z.string().min(1) }),
  blocking:  z.object({ images: z.array(labelled), video: z.string().min(1).optional(), text: bilingual.optional() }).optional(),
  exploded:  z.object({ image: z.string().min(1), legend: z.array(bilingual), text: bilingual.optional() }).optional(),
  shaders:   z.array(z.object({ title: bilingual, steps: z.array(labelled) })).default([]),
  materials: z.array(z.object({
    image: z.string().min(1),
    name:  bilingual,
    rows:  z.array(z.object({ label: bilingual, value: z.coerce.string() })),
  })).default([]),
  maps:      z.array(labelled).default([]),
  uv:        z.string().min(1).optional(),
  uvTextured: z.string().min(1).optional(),
  process:   z.array(labelled).default([]),
  specs:     z.array(z.object({ label: bilingual, value: bilingual })).default([]),
  outro:     bilingual.optional(),
})

//height over the larger footprint side above which an object is tall, and the
//reverse for wide
const TALL_RATIO = 1.4
//a view closer to vertical than this share of its distance is nudged forward by the second
const VERTICAL_EPSILON = 1e-4
const VERTICAL_NUDGE = 1e-3
const WIDE_RATIO = 1.6

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
  const bytes = statSync(join(dir, name)).size
  const [known] = await db.select({ id: file.id }).from(file)
    .where(and(eq(file.originalFilename, original), eq(file.sizeBytes, bytes)))
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
    sizeBytes: bytes, ...size, kind: type.kind, uploadedBy: uploader,
  })
  return id
}

//THE RENDER CAMERA AS THE MODEL'S VIEW. The viewer stands the model on the
//ground, centred on the vertical axis (modelViewer.ts), so the camera moves by
//the same offset. Its distance is scaled to the viewer's field of view, so the
//model fills the frame as it fills main.jpg.
async function glbBounds(glbPath: string): Promise<{ min: Vec3; max: Vec3 }> {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder })
  const { min, max } = getBounds((await io.read(glbPath)).getRoot().getDefaultScene()!)
  return { min: min as Vec3, max: max as Vec3 }
}

//TALL, WIDE OR COMPACT - the silhouette the case-study page is laid out for
function shapeOf({ min, max }: { min: Vec3; max: Vec3 }): ModelShape {
  const height = max[1] - min[1]
  const width = Math.max(max[0] - min[0], max[2] - min[2])
  if (height > width * TALL_RATIO) return "tall"
  if (width > height * WIDE_RATIO) return "wide"
  return "compact"
}

function viewerView({ min, max }: { min: Vec3; max: Vec3 }, camera: { position: Vec3; target: Vec3; fov: number }): { position: Vec3; target: Vec3 } {
  const offset: Vec3 = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
  const target = camera.target.map((v, i) => v - offset[i]!) as Vec3
  const scale = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((CAMERA_FOV * Math.PI) / 360)
  const position = camera.position.map((v, i) => target[i]! + (v - offset[i]! - target[i]!) * scale) as Vec3
  //a camera straight above or below the model leaves its roll undefined: a
  //step toward the front keeps the model's x axis level on screen
  const distance = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])
  if (Math.hypot(position[0] - target[0], position[2] - target[2]) < distance * VERTICAL_EPSILON) {
    position[2] = target[2] + distance * VERTICAL_NUDGE
  }
  return { position, target }
}

async function imageAspect(path: string): Promise<number> {
  const { width, height } = await measureImage(path)
  return width / height
}

//the folder's details, sorted by name
function detailNames(dir: string): string[] {
  return readdirSync(dir).filter((n) => /^detail-\d+\.(jpe?g|png|webp)$/i.test(n)).sort()
}

async function importMain(dir: string, uploader: string, startRight: boolean): Promise<number> {
  const m = mainManifest.parse(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")))
  const put = (name: string) => storeFile(dir, m.slug, name, uploader)
  const has = (name: string) => existsSync(join(dir, name))

  const glbId = await put("model.glb")
  const mainId = await put("main.jpg")
  const wireId = await put("main-wire.jpg")
  const details = detailNames(dir)
  const detailIds = await Promise.all(details.map(put))
  //detail-01-wire.jpg is the wireframe of detail-01.jpg, when the folder has it
  const wireName = (name: string) => name.replace(/(\.[a-z]+)$/i, "-wire$1")
  const detailWireIds = await Promise.all(details.map((n) => (has(wireName(n)) ? put(wireName(n)) : null)))
  const videoId = has("turntable.mp4") ? await put("turntable.mp4") : null
  //the making-of, when the folder has one: process/process.json and its images
  const story = has("process/process.json")
    ? processManifest.parse(JSON.parse(readFileSync(join(dir, "process", "process.json"), "utf8")))
    : null
  const steps: CaseStudyStep[] = []
  for (const s of story?.steps ?? []) {
    const media = s.image
      ? { kind: "image" as const, fileId: await put(s.image), aspect: await imageAspect(join(dir, s.image)) }
      : { kind: "video" as const, fileId: await put(s.video!), aspect: s.aspect! }
    steps.push({ media, title: s.title, text: s.text, section: s.section })
  }
  const evolution: { fileId: string; label: { fr: string; en: string } }[] = []
  for (const e of story?.evolution ?? []) evolution.push({ fileId: await put(e.image), label: e.label })
  //the viewport views and extras: vp-clay.jpg, screen.gif...
  const shots: Partial<Record<CaseStudyView, string>> = {}
  for (const name of CASE_STUDY_VIEWS) {
    const file = [".jpg", ".png", ".gif"].map((ext) => name + ext).find(has)
    if (file) shots[name] = await put(file)
  }

  //MODEL - one per GLB, optimized once
  const bounds = await glbBounds(join(dir, "model.glb"))
  const view = viewerView(bounds, m.camera)
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

  //the home card shows the first three, the project's page every one
  const thumbnails = detailIds.map((fileId, i) => ({ fileId, wireframeFileId: detailWireIds[i] ?? null, description: m.title }))
  //the technical plan when the folder has one, else the making-of
  const sheet = has("sheet/sheet.json")
    ? await importSheet(sheetManifest.parse(JSON.parse(readFileSync(join(dir, "sheet", "sheet.json"), "utf8"))), (name) => put(`sheet/${name}`), model!.id)
    : null
  const values = mainProjectPatch.required().parse({
    title: m.title, description: m.description, published: true, role: m.role, year: m.year,
    mainImageFileId: mainId, mainWireframeFileId: wireId,
    model3dId: model!.id, model3dDesktopView: VIEW, model3dMobileView: VIEW,
    thumbnails,
    detailPage: { blocks: sheet ?? caseStudyBlocks({
      modelId: model!.id, view: VIEW, shape: shapeOf(bounds), mainId, wireId, detailIds, videoId, views: shots,
      intro: story?.intro ?? null, steps, outro: story?.outro ?? null, startRight, evolution,
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

//the files of sheet/sheet.json stored, and the page they lay out
async function importSheet(s: z.infer<typeof sheetManifest>, put: (name: string) => Promise<string>, modelId: string) {
  const images = async (list: z.infer<typeof labelled>[]): Promise<SheetImage[]> => {
    const out: SheetImage[] = []
    for (const i of list) out.push({ fileId: await put(i.image), caption: i.label })
    return out
  }
  const shaders = []
  for (const shader of s.shaders) shaders.push({ title: shader.title, steps: await images(shader.steps) })
  const materials = []
  for (const mat of s.materials) materials.push({ fileId: await put(mat.image), name: mat.name, rows: mat.rows })
  return sheetBlocks({
    modelId, view: VIEW,
    intro:    s.intro ?? null,
    plansId:  await put(s.plans.image),
    blocking: s.blocking
      ? { levels: await images(s.blocking.images), videoId: s.blocking.video ? await put(s.blocking.video) : null, text: s.blocking.text ?? null }
      : null,
    exploded: s.exploded ? { fileId: await put(s.exploded.image), legend: s.exploded.legend, text: s.exploded.text ?? null } : null,
    shaders,
    materials,
    maps:     await images(s.maps),
    uvId:     s.uv ? await put(s.uv) : null,
    uvTexturedId: s.uvTextured ? await put(s.uvTextured) : null,
    process:  await images(s.process),
    specs:    s.specs,
    outro:    s.outro ?? null,
  })
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
  const mains = process.argv.find((a) => a.startsWith("--main="))?.slice("--main=".length).split(",")
  if (!root || !mains) throw new Error("usage: bun scripts/import-renders.ts <root> --main=a,b,c [--retire]")
  const retire = process.argv.includes("--retire")
  const uploader = await adminId()

  const mainIds: number[] = []
  for (const name of mains) {
    const dir = join(root, name)
    if (!existsSync(join(dir, "manifest.json")) || !existsSync(join(dir, "model.glb"))) {
      throw new Error(`${name}: a main project folder needs manifest.json and model.glb`)
    }
    mainIds.push(await importMain(dir, uploader, mainIds.length % 2 === 1))
    console.log(`main project ${name} -> #${mainIds.at(-1)}`)
  }
  const galleryIds: number[] = []
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name)
    if (mains.includes(name) || !statSync(dir).isDirectory()) continue
    if (!existsSync(join(dir, "manifest.json")) || !existsSync(join(dir, "card.jpg"))) {
      console.warn(`${name}: no manifest.json and card.jpg, skipped`)
      continue
    }
    galleryIds.push(await importGallery(dir, uploader))
    console.log(`gallery card ${name} -> #${galleryIds.at(-1)}`)
  }

  //ORDER - the imported rows first, in the order above
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

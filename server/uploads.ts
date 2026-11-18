import type express from "express"
import multer from "multer"
import { join, extname } from "path"
import { mkdirSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { db } from "../db/index"
import { file as fileTable } from "../db/schema"
import { HttpError } from "./http"
import { deleteObject, writeObject } from "./storage"

//UPLOADS. Every file is stored under {folder}/{subdir}/{uuid}{ext} in the
//storage bucket (server/storage.ts), a name generated here and never the
//client's, and is served under /media. The folder is projects/{id} for a
//file of one main project, shared for the rest. multer writes the upload to
//a temp file first: it is measured there, sent to the bucket, then removed.
const UPLOAD_TMP_DIR = join(tmpdir(), "portfolio-uploads")
mkdirSync(UPLOAD_TMP_DIR, { recursive: true })


//200 MB - a .glb can be chunky
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

//No .svg and no .html: both carry script, and /media serves this directory
//on the site's own origin. The extension comes from the client and cannot be
//trusted alone: both it and the declared type have to be on the list.
const MEDIA_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif",
  ".mp4", ".webm",
  ".glb", ".gltf",
  ".hdr", ".exr", ".hdri",
  ".pdf",
])
//a .glb arrives as application/octet-stream or model/gltf-binary depending on
//the browser, and an .hdr has no registered type at all
const MEDIA_MIME_PREFIXES = ["image/", "video/", "model/", "application/octet-stream", "application/pdf"]

function subdirFor(filename: string): string {
  if (/\.(glb|gltf)$/i.test(filename))     return "models"
  if (/\.(hdr|exr|hdri)$/i.test(filename)) return "hdri"
  if (/\.pdf$/i.test(filename))            return "docs"
  return "images"
}

export function folderFor(mainProjectId: number | null): string {
  return mainProjectId === null ? "shared" : `projects/${mainProjectId}`
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TMP_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
  },
})

function filter(extensions: Set<string>, mimePrefixes: string[]): multer.Options["fileFilter"] {
  return (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    if (!extensions.has(ext)) {
      cb(new HttpError(400, `extension not allowed: ${ext || "(none)"}`))
      return
    }
    if (!mimePrefixes.some((prefix) => file.mimetype.startsWith(prefix))) {
      cb(new HttpError(400, `content type not allowed: ${file.mimetype}`))
      return
    }
    cb(null, true)
  }
}

const mediaUpload = multer({
  storage,
  limits:     { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: filter(MEDIA_EXTENSIONS, MEDIA_MIME_PREFIXES),
})

//multer as a promise, so an async route handler awaits it and Express 5
//forwards any rejection to the error handler
function receive(handler: express.RequestHandler, req: express.Request, res: express.Response): Promise<Express.Multer.File> {
  return new Promise((resolve, reject) => {
    handler(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) reject(new HttpError(400, err.message))
      else if (err) reject(err)
      else if (!req.file) reject(new HttpError(400, "no file uploaded"))
      else resolve(req.file)
    })
  })
}

export const receiveMedia = (field: string, req: express.Request, res: express.Response) =>
  receive(mediaUpload.single(field), req, res)

//the stills a browser draws, measured on the way in: width and height as
//displayed, EXIF rotation applied. An .exr is image/* to the upload but not
//something an <img> shows.
const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"])

export function isRaster(path: string): boolean {
  return RASTER_EXTENSIONS.has(extname(path).toLowerCase())
}

export async function measureImage(input: string | Buffer): Promise<{ width: number; height: number }> {
  const { autoOrient } = await sharp(input).metadata()
  return { width: autoOrient.width, height: autoOrient.height }
}

async function rasterSize(path: string): Promise<{ width: number | null; height: number | null }> {
  if (!isRaster(path)) return { width: null, height: null }
  try {
    return await measureImage(path)
  } catch (e) {
    throw new HttpError(400, `not a readable image: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function kindOf(mimeType: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/"))   return "image"
  if (mimeType.startsWith("video/"))   return "video"
  if (mimeType === "application/pdf") return "document"
  return "other"
}

export type FileRow = typeof fileTable.$inferSelect
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

//Measures the received file, sends it to the bucket, then writes its row and
//runs `link` (the row that points at it) when given. Either failing removes
//the bytes and the row: nothing referenced them yet. The temp file always goes.
export async function recordUpload(
  file: Express.Multer.File,
  uploadedBy: string,
  link?: (tx: Tx, row: FileRow) => Promise<void>,
  mainProjectId: number | null = null,
): Promise<FileRow & { url: string }> {
  const stored = `${folderFor(mainProjectId)}/${subdirFor(file.originalname)}/${file.filename}`
  let sent = false
  try {
    const size = await rasterSize(file.path)
    await writeObject(stored, Bun.file(file.path))
    sent = true
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(fileTable).values({
        //the uuid in the stored name is the row id
        id:               file.filename.split(".")[0]!,
        originalFilename: file.originalname,
        storedFilename:   stored,
        mimeType:         file.mimetype,
        sizeBytes:        file.size,
        ...size,
        kind:             kindOf(file.mimetype),
        uploadedBy,
        mainProjectId,
      }).returning()
      if (link) await link(tx, row!)
      return { ...row!, url: `/media/${row!.storedFilename}` }
    })
  } catch (e) {
    if (sent) {
      try {
        await deleteObject(stored)
      } catch (deleteErr) {
        console.error(`[files] rollback delete failed for ${stored}:`, deleteErr)
      }
    }
    throw e
  } finally {
    unlinkSync(file.path)
  }
}

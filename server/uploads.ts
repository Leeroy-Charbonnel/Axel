import type express from "express"
import multer from "multer"
import { join, extname, relative } from "path"
import { mkdirSync, readdirSync, unlinkSync } from "fs"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"
import { db } from "../db/index"
import { file as fileTable } from "../db/schema"
import { HttpError } from "./http"

//UPLOADS. Every file lands at storage/files/{subdir}/{uuid}{ext}, a name
//generated here and never the client's, and is served under /media.
//Files are never deleted from disk: a row can leave the `file` table, the
//bytes stay. The one unlink is the rollback of an upload whose row could not
//be written, so no row ever pointed at those bytes.
export const STORAGE_DIR = fileURLToPath(new URL("../storage/files", import.meta.url))


//mkdir failing on the volume must not take the boot down: uploads then fail
//one by one and the rest of the site is served
try {
  mkdirSync(STORAGE_DIR, { recursive: true })
  console.log(`[boot] storage ready at ${STORAGE_DIR}, ${readdirSync(STORAGE_DIR).length} entry(ies)`)
} catch (e) {
  console.error(`[boot] storage mkdir FAILED at ${STORAGE_DIR} - every upload will fail:`, e)
}


//200 MB - a .glb can be chunky
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
const MAX_CV_BYTES     = 20 * 1024 * 1024

//No .svg and no .html: both carry script, and /media serves this directory
//on the site's own origin. The extension comes from the client and cannot be
//trusted alone: both it and the declared type have to be on the list.
const MEDIA_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif",
  ".mp4", ".webm",
  ".glb", ".gltf",
  ".hdr", ".exr", ".hdri",
])
//a .glb arrives as application/octet-stream or model/gltf-binary depending on
//the browser, and an .hdr has no registered type at all
const MEDIA_MIME_PREFIXES = ["image/", "video/", "model/", "application/octet-stream"]

function subdirFor(filename: string): string {
  if (/\.(glb|gltf)$/i.test(filename))     return "models"
  if (/\.(hdr|exr|hdri)$/i.test(filename)) return "hdri"
  if (/\.pdf$/i.test(filename))            return "docs"
  return "images"
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const dir = join(STORAGE_DIR, subdirFor(file.originalname))
    mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
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

//PDF only here, for the profile CV: nowhere else accepts it
const cvUpload = multer({
  storage,
  limits:     { fileSize: MAX_CV_BYTES },
  fileFilter: filter(new Set([".pdf"]), ["application/pdf"]),
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

export const receiveCv = (req: express.Request, res: express.Response) =>
  receive(cvUpload.single("file"), req, res)

function kindOf(mimeType: string): "image" | "video" | "document" | "other" {
  if (mimeType.startsWith("image/"))   return "image"
  if (mimeType.startsWith("video/"))   return "video"
  if (mimeType === "application/pdf") return "document"
  return "other"
}

export type FileRow = typeof fileTable.$inferSelect
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

//Writes the row for a received file, then runs `link` (the row that points
//at it) when given. Either failing removes the bytes and the row: nothing
//referenced them yet.
export async function recordUpload(
  file: Express.Multer.File,
  uploadedBy: string,
  link?: (tx: Tx, row: FileRow) => Promise<void>,
): Promise<FileRow & { url: string }> {
  const stored = relative(STORAGE_DIR, join(file.destination, file.filename)).split("\\").join("/")
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(fileTable).values({
        //the uuid in the stored name is the row id
        id:               file.filename.split(".")[0]!,
        originalFilename: file.originalname,
        storedFilename:   stored,
        mimeType:         file.mimetype,
        sizeBytes:        file.size,
        kind:             kindOf(file.mimetype),
        uploadedBy,
      }).returning()
      if (link) await link(tx, row!)
      return { ...row!, url: `/media/${row!.storedFilename}` }
    })
  } catch (e) {
    try {
      unlinkSync(join(STORAGE_DIR, stored))
    } catch (unlinkErr) {
      console.error(`[files] rollback unlink failed for ${stored}:`, unlinkErr)
    }
    throw e
  }
}

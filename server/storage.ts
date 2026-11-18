import type express from "express"
import { extname } from "path"
import { Readable } from "stream"
import { S3Client } from "bun"
import { STORAGE_ACCESS_KEY, STORAGE_BUCKET, STORAGE_ENDPOINT, STORAGE_SECRET_KEY } from "../env"

//FILE STORAGE. Every uploaded file lives in an S3 bucket on the server: one
//volume, one folder per environment (prod/, dev/), the same layout in both:
//images/, models/, hdri/, docs/, and .cache/ for the resized copies.
//The service is rclone serve s3 in the compose stack. Nothing is kept on the
//disk of the machine running the app.

const client = new S3Client({
  endpoint:        STORAGE_ENDPOINT,
  bucket:          STORAGE_BUCKET,
  accessKeyId:     STORAGE_ACCESS_KEY,
  secretAccessKey: STORAGE_SECRET_KEY,
})

export interface StoredObject { key: string; size: number }

function isMissing(e: unknown): boolean {
  return (e as { code?: string })?.code === "NoSuchKey"
}

export async function readObject(key: string): Promise<Buffer> {
  return Buffer.from(await client.file(key).arrayBuffer())
}

//a handle on the object, read as it is written elsewhere (a copy streams through)
export function objectFile(key: string): Blob {
  return client.file(key)
}

export async function writeObject(key: string, data: Buffer | Uint8Array | Blob): Promise<void> {
  await client.write(key, data)
}

export async function objectExists(key: string): Promise<boolean> {
  return client.exists(key)
}

//deleting a key that is already gone is not an error
export async function deleteObject(key: string): Promise<void> {
  await client.delete(key)
}

//every object under the prefix, all pages
export async function listObjects(prefix = ""): Promise<StoredObject[]> {
  const out: StoredObject[] = []
  let token: string | undefined
  do {
    const page = await client.list({ prefix, continuationToken: token, maxKeys: 1000 })
    for (const o of page.contents ?? []) out.push({ key: o.key, size: o.size ?? 0 })
    token = page.isTruncated ? page.nextContinuationToken : undefined
  } while (token)
  return out
}

//"bytes=a-b", "bytes=a-" or "bytes=-n": one range, or null when the header
//asks for something this server does not answer (several ranges, bad syntax)
function parseRange(header: string, size: number): { start: number; end: number } | null | "unsatisfiable" {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === "" && m[2] === "")) return null
  let start: number
  let end: number
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return "unsatisfiable"
  return { start, end }
}

//Sends one object: type from the extension, ETag and 304, one byte range
//(a video seeks with it), long cache headers since a stored name never changes.
//Returns false, with nothing sent, when the key does not exist.
export async function sendObject(req: express.Request, res: express.Response, key: string, maxAgeSeconds: number): Promise<boolean> {
  const file = client.file(key)
  let stat: Awaited<ReturnType<typeof file.stat>>
  try {
    stat = await file.stat()
  } catch (e) {
    if (isMissing(e)) return false
    throw e
  }

  res.type(extname(key))
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSeconds}, immutable`)
  res.setHeader("Accept-Ranges", "bytes")
  res.setHeader("Last-Modified", stat.lastModified.toUTCString())
  if (stat.etag) res.setHeader("ETag", stat.etag)

  if (stat.etag && req.headers["if-none-match"] === stat.etag) {
    res.status(304).end()
    return true
  }

  const range = req.headers.range ? parseRange(req.headers.range, stat.size) : null
  if (range === "unsatisfiable") {
    res.setHeader("Content-Range", `bytes */${stat.size}`)
    res.status(416).end()
    return true
  }

  const body = range ? file.slice(range.start, range.end + 1) : file
  if (range) {
    res.status(206)
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`)
    res.setHeader("Content-Length", String(range.end - range.start + 1))
  } else {
    res.status(200)
    res.setHeader("Content-Length", String(stat.size))
  }
  if (req.method === "HEAD") {
    res.end()
    return true
  }

  const stream = Readable.fromWeb(body.stream() as Parameters<typeof Readable.fromWeb>[0])
  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject)
    //sent, or the visitor left: either way stop pulling bytes
    res.on("close", () => {
      stream.destroy()
      resolve()
    })
    stream.pipe(res)
  })
  return true
}

//one call at boot, so a wrong endpoint or key shows in the log at once
export async function checkStorage(): Promise<string> {
  await client.list({ maxKeys: 1 })
  return `storage ready: bucket "${STORAGE_BUCKET}" at ${STORAGE_ENDPOINT}`
}

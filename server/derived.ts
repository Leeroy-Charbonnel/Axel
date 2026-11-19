import { IMAGE_FORMATS, IMAGE_WIDTHS, THUMB_SIDE, type ImageFormat } from "../src/lib/media"

//THE NAMES OF THE OBJECTS IN THE BUCKET. A stored file is
//{folder}/{subdir}/{uuid}{ext}, named by uploads.ts, one row each. The objects
//derived from it have no row and all live under .cache:
//  .cache/{format}/{width}/{stored}.{format}   a resized copy of an image (images.ts)
//  .cache/thumb/{side}/{stored}.webp           the thumbnail of anything else (thumbs.ts)
//They are deleted and moved with their file, and the sweep takes the ones
//whose file is gone: every new shape must be read by sourceOf.

//One stored file and nothing else: no "..", no .cache. A name without folder
//is a file not yet moved by file-projects.ts.
export const STORED_KEY = /^(?:(?:projects\/\d+|shared)\/)?(?:images|models|hdri|docs)\/[0-9a-f-]{36}\.[a-z0-9]+$/

export const CACHE_PREFIX = ".cache/"
export const THUMB_PREFIX = `${CACHE_PREFIX}thumb/${THUMB_SIDE}/`
export const THUMB_EXT = ".webp"

const DERIVED_KEY = /^\.cache\/[a-z]+\/\d+\/(.+)\.[a-z]+$/

export function cacheKey(stored: string, format: ImageFormat, width: number): string {
  return `${CACHE_PREFIX}${format}/${width}/${stored}.${format}`
}

export function thumbKey(stored: string): string {
  return `${THUMB_PREFIX}${stored}${THUMB_EXT}`
}

//version: a thumbnail can be made again under the same name
export function thumbUrl(stored: string, version: number): string {
  return `/media/thumb/${THUMB_SIDE}/${stored}?v=${version}`
}

//every derived object one stored file can have
export function derivativeKeys(stored: string): string[] {
  return [...IMAGE_FORMATS.flatMap((f) => IMAGE_WIDTHS.map((w) => cacheKey(stored, f, w))), thumbKey(stored)]
}

//the stored file an object belongs to: itself, or the source of a derived object
export function sourceOf(key: string): string {
  return DERIVED_KEY.exec(key)?.[1] ?? key
}

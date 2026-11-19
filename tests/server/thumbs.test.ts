import { describe, expect, test } from "bun:test"
import sharp from "sharp"
import { CACHE_PREFIX, derivativeKeys, sourceOf, STORED_KEY, thumbKey, thumbUrl } from "../../server/derived"
import { encodePicture } from "../../server/picture"
import { THUMB_SIDE } from "../../src/lib/media"

const MODEL = "projects/13/models/132ebf37-4b85-4b6c-97b2-643954cb64d3.glb"
const IMAGE = "shared/images/1b686a52-125a-45f4-ba27-079c0e8f3b32.jpg"

function picture(width: number, height: number) {
  return sharp({ create: { width, height, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } } })
}

describe("the objects derived from a stored file", () => {
  test("all live under .cache and name their file, so the sweep and the totals find them", () => {
    for (const stored of [MODEL, IMAGE]) {
      const keys = derivativeKeys(stored)
      expect(keys).toContainEqual(thumbKey(stored))
      for (const key of keys) {
        expect(key.startsWith(CACHE_PREFIX)).toBe(true)
        expect(sourceOf(key)).toBe(stored)
      }
    }
  })

  test("a stored file is its own source", () => {
    expect(sourceOf(MODEL)).toBe(MODEL)
  })

  test("a thumbnail is never reached as a stored file", () => {
    expect(STORED_KEY.test(MODEL)).toBe(true)
    expect(STORED_KEY.test(thumbKey(MODEL))).toBe(false)
  })

  test("its URL carries the stored name and a version", () => {
    expect(thumbUrl(MODEL, 42)).toBe(`/media/thumb/${THUMB_SIDE}/${MODEL}?v=42`)
  })
})

describe("a picture received from the admin's browser", () => {
  test("is stored as a WebP no larger than asked, its shape and its transparency kept", async () => {
    const out = await encodePicture(await picture(1200, 600).png().toBuffer(), THUMB_SIDE)
    expect([out.width, out.height]).toEqual([THUMB_SIDE, THUMB_SIDE / 2])
    const meta = await sharp(out.data).metadata()
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", THUMB_SIDE, THUMB_SIDE / 2, true])
  })

  test("is never enlarged", async () => {
    const out = await encodePicture(await picture(120, 90).webp().toBuffer(), THUMB_SIDE)
    expect([out.width, out.height]).toEqual([120, 90])
  })

  test("is refused when it is not a picture", async () => {
    let status = 0
    try {
      await encodePicture(Buffer.from("<html><script>alert(1)</script></html>"), THUMB_SIDE)
    } catch (e) {
      status = (e as { status: number }).status
    }
    expect(status).toBe(400)
  })

  test("is refused in a format a canvas does not write", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`)
    for (const bytes of [svg, await picture(10, 10).gif().toBuffer()]) {
      let reason = ""
      try {
        await encodePicture(bytes, THUMB_SIDE)
      } catch (e) {
        reason = (e as Error).message
      }
      expect(reason.includes("not accepted")).toBe(true)
    }
  })
})

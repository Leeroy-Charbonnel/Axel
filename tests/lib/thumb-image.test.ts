import { describe, expect, test } from "bun:test"
import { coverCrop, frameToPixels, isBlank } from "../../src/lib/thumb-image"

describe("the part of a source that fills a frame", () => {
  test("a wide source loses its sides", () => {
    expect(coverCrop(1920, 1080, 1)).toEqual({ x: 420, y: 0, width: 1080, height: 1080 })
  })

  test("a tall source loses its top and bottom", () => {
    expect(coverCrop(400, 800, 1)).toEqual({ x: 0, y: 200, width: 400, height: 400 })
  })

  test("a source of the frame's shape is kept whole", () => {
    expect(coverCrop(960, 540, 16 / 9)).toEqual({ x: 0, y: 0, width: 960, height: 540 })
  })
})

describe("a WebGL frame turned into a picture", () => {
  //two pixels wide, two rows: the frame's first row is the bottom of the picture
  const frame = new Uint8Array([
    100, 50, 0, 200,    0, 0, 0, 0,
    252, 212, 174, 133, 10, 20, 30, 255,
  ])
  const out = [...frameToPixels(frame, 2, 2)]

  test("has its top row first", () => {
    expect(out.slice(4, 8)).toEqual([10, 20, 30, 255])
  })

  test("a pixel brighter than its alpha keeps its colour and turns more opaque", () => {
    expect(out.slice(0, 4)).toEqual([255, 215, 176, 252])
  })

  test("a half-clear pixel gets its own colour back, a clear one stays clear", () => {
    expect(out.slice(8, 12)).toEqual([128, 64, 0, 200])
    expect(out.slice(12, 16)).toEqual([0, 0, 0, 0])
  })
})

describe("a picture with nothing drawn", () => {
  test("is one whose every pixel is clear", () => {
    expect(isBlank(new Uint8ClampedArray(16))).toBe(true)
  })

  test("is not one with a single pixel drawn, even black", () => {
    const pixels = new Uint8ClampedArray(16)
    pixels[7] = 255
    expect(isBlank(pixels)).toBe(false)
  })
})

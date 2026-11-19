import { describe, expect, test } from "bun:test"
import { DataUtils } from "three"
import { equirectPreview, type EquirectSource } from "../../src/three/equirectPreview"

const WIDTH = 64
const HEIGHT = 32
const SIDE = 16
const SKY = [0.2, 0.4, 1.6]
const GROUND = [0.5, 0.3, 0.1]

//an outdoor map: sky over the horizon, ground under it, rows in the asked order
function outdoor(topFirst: boolean, channels = 4): Float32Array {
  const data = new Float32Array(WIDTH * HEIGHT * channels)
  for (let row = 0; row < HEIGHT; row++) {
    const fromTop = topFirst ? row : HEIGHT - 1 - row
    const colour = fromTop < HEIGHT / 2 ? SKY : GROUND
    for (let x = 0; x < WIDTH; x++) {
      const at = (row * WIDTH + x) * channels
      for (let c = 0; c < channels; c++) data[at + c] = c < 3 ? colour[c]! : 1
    }
  }
  return data
}

const source = (data: EquirectSource["data"], topFirst: boolean): EquirectSource => ({ data, width: WIDTH, height: HEIGHT, topFirst })
const pixel = (out: Uint8ClampedArray, x: number, y: number) => [...out.slice((y * SIDE + x) * 4, (y * SIDE + x) * 4 + 4)]

describe("the picture of an environment map", () => {
  test("shows the sky up and the ground down, fully opaque", () => {
    const out = equirectPreview(source(outdoor(true), true), SIDE)
    expect(out).toHaveLength(SIDE * SIDE * 4)
    const [skyR, , skyB, skyA] = pixel(out, SIDE / 2, 0)
    const [groundR, , groundB, groundA] = pixel(out, SIDE / 2, SIDE - 1)
    expect(skyB!).toBeGreaterThan(skyR!)
    expect(groundR!).toBeGreaterThan(groundB!)
    expect(skyA).toBe(255)
    expect(groundA).toBe(255)
  })

  test("is the same whichever way the file stores its rows", () => {
    const topFirst = equirectPreview(source(outdoor(true), true), SIDE)
    const bottomFirst = equirectPreview(source(outdoor(false), false), SIDE)
    expect([...bottomFirst]).toEqual([...topFirst])
  })

  test("is the same from half floats, and without an alpha channel", () => {
    const floats = outdoor(true)
    const reference = equirectPreview(source(floats, true), SIDE)
    const halves = Uint16Array.from(floats, (v) => DataUtils.toHalfFloat(v))
    const fromHalves = equirectPreview(source(halves, true), SIDE)
    //a half float holds about three digits: one step of a byte at most
    for (let i = 0; i < reference.length; i++) expect(Math.abs(fromHalves[i]! - reference[i]!)).toBeLessThanOrEqual(1)
    expect([...equirectPreview(source(outdoor(true, 3), true), SIDE)]).toEqual([...reference])
  })

  test("is exposed on the map's own brightness: neither black nor burnt, whatever the unit of its values", () => {
    const reference = equirectPreview(source(outdoor(true), true), SIDE)
    const sky = pixel(reference, SIDE / 2, 0)[2]!
    expect(sky).toBeGreaterThan(60)
    expect(sky).toBeLessThan(250)
    for (const scale of [0.001, 5000]) {
      const out = equirectPreview(source(outdoor(true).map((v, i) => (i % 4 === 3 ? 1 : v * scale)), true), SIDE)
      for (let i = 0; i < reference.length; i++) expect(Math.abs(out[i]! - reference[i]!)).toBeLessThanOrEqual(1)
    }
  })

  test("a black ground does not burn the sky, and a black map stays black", () => {
    const data = outdoor(true)
    for (let i = 0; i < data.length; i += 4) if (data[i] === GROUND[0]) data.fill(0, i, i + 3)
    const out = equirectPreview(source(data, true), SIDE)
    expect(pixel(out, SIDE / 2, 0)[2]!).toBeLessThan(250)
    expect(pixel(out, SIDE / 2, SIDE - 1).slice(0, 3)).toEqual([0, 0, 0])
    const black = equirectPreview(source(new Float32Array(WIDTH * HEIGHT * 4), true), SIDE)
    expect(pixel(black, 2, 2)).toEqual([0, 0, 0, 255])
  })

  test("a broken pixel does not spread", () => {
    const data = outdoor(true)
    data[0] = NaN
    data[4] = Infinity
    data[8] = -3
    const out = equirectPreview(source(data, true), SIDE)
    const reference = equirectPreview(source(outdoor(true), true), SIDE)
    expect(pixel(out, SIDE / 2, SIDE / 2)).toEqual(pixel(reference, SIDE / 2, SIDE / 2))
  })

  test("a map with one channel is drawn in grey", () => {
    const grey = new Float32Array(WIDTH * HEIGHT).fill(0.4)
    const [r, g, b] = pixel(equirectPreview(source(grey, true), SIDE), 3, 3)
    expect(g).toBe(r)
    expect(b).toBe(r)
  })

  test("data that fits no pixel layout is refused", () => {
    expect(() => equirectPreview(source(new Float32Array(WIDTH * HEIGHT * 5), true), SIDE)).toThrow("5 channels")
  })
})

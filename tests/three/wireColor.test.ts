import { describe, expect, test } from "bun:test"
import { withLightType } from "../../src/components/model-editor/autoSettings"
import type { AutoSetup } from "../../src/three/autoSetup"
import { rigShape } from "../../src/three/lights"
import type { SharedLight } from "../../src/three/types"
import { hslTripletToCss, isSiteBackground } from "../../src/three/wireColor"

const light = (over: Partial<SharedLight>): SharedLight => ({
  id: "a", type: "directional", x: 1, y: 2, z: 3, tx: 0, ty: 0, tz: 0,
  normalIntensity: 1, normalColor: "#ffffff", wfIntensity: 1, wfColor: "#ffffff", ...over,
})

describe("wire colours", () => {
  test("an HSL triplet becomes a colour three can read", () => {
    expect(hslTripletToCss("0 0% 0%")).toBe("hsl(0, 0%, 0%)")
    expect(hslTripletToCss(" 210.5 40% 8.2% ")).toBe("hsl(210.5, 40%, 8.2%)")
  })

  test("anything else is refused", () => {
    expect(() => hslTripletToCss("")).toThrow()
    expect(() => hslTripletToCss("#000000")).toThrow()
  })

  test("only the keyword follows the site background", () => {
    expect(isSiteBackground("background")).toBe(true)
    expect(isSiteBackground("#000000")).toBe(false)
    expect(isSiteBackground(undefined)).toBe(false)
  })
})

describe("light rig shape", () => {
  test("a moved or recoloured light keeps the shape", () => {
    expect(rigShape([light({ x: 9, normalColor: "#ff0000", normalIntensity: 3 })])).toBe(rigShape([light({})]))
  })

  test("type, shadow, on/off and the list change it", () => {
    const base = rigShape([light({})])
    expect(rigShape([light({ type: "point" })])).not.toBe(base)
    expect(rigShape([light({ castShadow: false })])).not.toBe(base)
    expect(rigShape([light({ enabled: false })])).not.toBe(base)
    expect(rigShape([light({}), light({ id: "b" })])).not.toBe(base)
  })
})

describe("light type", () => {
  const setup = { bounds: { center: [1, 2, 3], radius: 2 } } as unknown as AutoSetup

  test("a bulb turned into a sun aims at the model centre, where it stood", () => {
    const sun = withLightType(light({ type: "point", range: 4, tx: undefined, ty: undefined, tz: undefined }), "directional", setup)
    expect([sun.type, sun.x, sun.y, sun.z, sun.tx, sun.ty, sun.tz]).toEqual(["directional", 1, 2, 3, 1, 2, 3])
    expect(sun.range).toBeUndefined()
  })

  test("a sun turned into a bulb loses its target", () => {
    const bulb = withLightType(light({}), "point", setup)
    expect([bulb.type, bulb.range]).toEqual(["point", 0])
    expect(bulb.tx).toBeUndefined()
  })
})

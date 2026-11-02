import { describe, expect, test } from "bun:test"
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three"
import { computeAutoSetup } from "../../src/three/autoSetup"
import {
  applyAutoSetup,
  autoValues,
  lightOrbit,
  matchPreset,
  newLight,
  placeLight,
  presetLights,
  sweepExtent,
} from "../../src/components/model-editor/autoSettings"
import type { ViewerSettings } from "../../src/three/types"
import type { Model3dView } from "../../src/types/portfolio"

//a 4 x 1 x 2 box resting on the ground, centred on the vertical axis
function setup() {
  const root = new Group()
  const mesh = new Mesh(new BoxGeometry(4, 1, 2), new MeshStandardMaterial())
  mesh.position.set(0, 0.5, 0)
  root.add(mesh)
  root.updateMatrixWorld(true)
  return computeAutoSetup(root)
}

const NAMES = { desktop: "Desktop", phone: "Phone" }

describe("applyAutoSetup", () => {
  test("writes both screen views as bookmarks and defaults", () => {
    const s = setup()
    const { settings, views, summary } = applyAutoSetup({}, [], s, { resetMaterials: false, names: NAMES })
    expect(views.map((v) => v.name)).toEqual(["Desktop", "Phone"])
    expect(views[0]!.position).toEqual(s.views.desktop.position)
    expect(views[1]!.aspect).toBeLessThan(1)
    expect(settings.defaultViews?.desktop?.name).toBe("Desktop")
    expect(settings.defaultViews?.phone?.pos).toEqual(s.views.phone.position)
    expect(summary.views).toEqual(["Desktop", "Phone"])
  })

  test("keeps the names of existing defaults and updates their bookmark", () => {
    const s = setup()
    const before: Model3dView[] = [{ name: "Hero", position: [9, 9, 9], target: [0, 0, 0], wireframe: true }]
    const prior: ViewerSettings = { defaultViews: { desktop: { name: "Hero", pos: [9, 9, 9], target: [0, 0, 0] } } }
    const { settings, views } = applyAutoSetup(prior, before, s, { resetMaterials: false, names: NAMES })
    expect(views.map((v) => v.name)).toEqual(["Hero", "Phone"])
    expect(views[0]!.position).toEqual(s.views.desktop.position)
    expect(settings.defaultViews?.desktop?.name).toBe("Hero")
  })

  test("hands the stage and sweep back to auto, sets the studio rig", () => {
    const s = setup()
    const prior: ViewerSettings = {
      stage: { orbitMin: 2 },
      wireframeMode: { sweepAxis: [0, 0, 1], sweepStart: 3, overlayOn: false },
      lights: [],
    }
    const { settings } = applyAutoSetup(prior, [], s, { resetMaterials: false, names: NAMES })
    expect(settings.stage).toBeUndefined()
    expect(settings.wireframeMode).toEqual({ overlayOn: false })
    expect(settings.lights).toEqual(presetLights(s, "studio"))
  })

  test("resets material overrides only when asked", () => {
    const s = setup()
    const mat = { name: "m", color: "#ff0000", emissive: "#000000", emissiveEnabled: false, emissiveIntensity: 1, metalness: 0, roughness: 1, envMapIntensity: 1, specularIntensity: 1 }
    const kept = applyAutoSetup({ materials: [mat] }, [], s, { resetMaterials: false, names: NAMES })
    expect(kept.settings.materials).toHaveLength(1)
    const reset = applyAutoSetup({ materials: [mat] }, [], s, { resetMaterials: true, names: NAMES })
    expect(reset.settings.materials).toBeUndefined()
    expect(reset.summary.materialsReset).toBe(1)
  })
})

describe("presets", () => {
  test("each preset is recognised, a tweak is not", () => {
    const s = setup()
    expect(matchPreset(presetLights(s, "soft"), s)).toBe("soft")
    expect(matchPreset(presetLights(s, "contrast"), s)).toBe("contrast")
    const tweaked = presetLights(s, "studio").map((l, i) => (i === 0 ? { ...l, normalIntensity: 9 } : l))
    expect(matchPreset(tweaked, s)).toBeNull()
  })

  test("a preset read back from jsonb, keys reordered, is still recognised", () => {
    const s = setup()
    const reordered = presetLights(s, "soft").map((l) => Object.fromEntries(Object.entries(l).reverse()) as typeof l)
    expect(matchPreset(reordered, s)).toBe("soft")
  })

  test("auto orbit limits are in model radii", () => {
    const s = setup()
    const auto = autoValues(s)
    expect(auto.stage.orbitMin * s.bounds.radius).toBeCloseTo(s.orbit.minDistance, 2)
    expect(auto.stage.orbitMax * s.bounds.radius).toBeCloseTo(s.orbit.maxDistance, 2)
  })
})

describe("light orbit", () => {
  test("placing a light at an orbit reads back the same orbit", () => {
    const s = setup()
    const light = placeLight(newLight("directional", s, "l1"), { azimuth: -60, elevation: 25, distance: 2.5 }, s)
    const orbit = lightOrbit(light, s)
    expect(orbit.azimuth).toBeCloseTo(-60, 5)
    expect(orbit.elevation).toBeCloseTo(25, 5)
    expect(orbit.distance).toBeCloseTo(2.5, 5)
    expect([light.tx, light.ty, light.tz]).toEqual(s.bounds.center)
  })

  test("a new light sits relative to the model, not at a fixed spot", () => {
    const s = setup()
    const light = newLight("point", s, "p")
    expect(lightOrbit(light, s).distance).toBeCloseTo(1.5, 5)
  })
})

describe("sweepExtent", () => {
  test("projects the box on the axis, either way round", () => {
    const s = setup()
    expect(sweepExtent([1, 0, 0], s)).toEqual({ min: -2, max: 2 })
    const down = sweepExtent([0, -1, 0], s)
    expect(down.min).toBeCloseTo(-1, 6)
    expect(down.max).toBeCloseTo(0, 6)
  })
})

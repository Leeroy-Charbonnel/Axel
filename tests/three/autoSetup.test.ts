import { describe, expect, test } from "bun:test"
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from "three"
import { Box3 } from "three"
import { computeAutoSetup, CAMERA_FOV, DESKTOP_ASPECT, fitViewToAspect, PHONE_ASPECT } from "../../src/three/autoSetup"
import { computeEdgeSegments } from "../../src/three/edgeSegments"

//a 4 x 1 x 2 box whose centre sits at (10, 0.5, -3)
function boxModel(): Group {
  const root = new Group()
  const mesh = new Mesh(new BoxGeometry(4, 1, 2), new MeshStandardMaterial())
  mesh.position.set(10, 0.5, -3)
  root.add(mesh)
  root.updateMatrixWorld(true)
  return root
}

function cornersInsideFrustum(view: { position: number[]; target: number[] }, aspect: number): boolean {
  const cam = new PerspectiveCamera(CAMERA_FOV, aspect, 0.01, 1000)
  cam.position.set(view.position[0]!, view.position[1]!, view.position[2]!)
  cam.lookAt(view.target[0]!, view.target[1]!, view.target[2]!)
  cam.updateMatrixWorld(true)
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(i & 1 ? 12 : 8, i & 2 ? 1 : 0, i & 4 ? -2 : -4).project(cam)
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z > 1) return false
  }
  return true
}

describe("computeAutoSetup", () => {
  test("bounds of an offset box", () => {
    const s = computeAutoSetup(boxModel())
    expect(s.bounds.box.min).toEqual([8, 0, -4])
    expect(s.bounds.box.max).toEqual([12, 1, -2])
    expect(s.bounds.center).toEqual([10, 0.5, -3])
    expect(s.bounds.size).toEqual([4, 1, 2])
    expect(s.bounds.radius).toBeCloseTo(Math.sqrt(16 + 1 + 4) / 2, 6)
    expect(s.bounds.sphere.center).toEqual(s.bounds.center)
  })

  test("views aim at the centre and keep every corner on screen", () => {
    const s = computeAutoSetup(boxModel())
    expect(s.views.desktop.target).toEqual([10, 0.5, -3])
    expect(s.views.phone.target).toEqual([10, 0.5, -3])
    expect(cornersInsideFrustum(s.views.desktop, DESKTOP_ASPECT)).toBe(true)
    expect(cornersInsideFrustum(s.views.phone, PHONE_ASPECT)).toBe(true)
    //a narrow frame has to step back further for the same model
    const center = new Vector3(10, 0.5, -3)
    const dDesk  = new Vector3(...s.views.desktop.position).distanceTo(center)
    const dPhone = new Vector3(...s.views.phone.position).distanceTo(center)
    expect(dPhone).toBeGreaterThan(dDesk)
    //3/4 view: above the model, off the front axis
    expect(s.views.desktop.position[1]).toBeGreaterThan(0.5)
    expect(s.views.desktop.position[0]).not.toBeCloseTo(10, 3)
  })

  test("orbit, clip and ground follow the model size", () => {
    const s = computeAutoSetup(boxModel())
    const r = s.bounds.radius
    expect(s.orbit.minDistance).toBeLessThan(r)
    expect(s.orbit.maxDistance).toBeGreaterThan(new Vector3(...s.views.phone.position).distanceTo(new Vector3(10, 0.5, -3)))
    expect(s.clip.near).toBeGreaterThan(0)
    expect(s.clip.near).toBeLessThan(s.orbit.minDistance)
    expect(s.clip.far).toBeGreaterThan(s.orbit.maxDistance)
    expect(s.ground.y).toBe(0)
    expect(s.ground.size).toBeGreaterThan(4)
  })

  test("three-point rig scaled to the model, only the key casts", () => {
    const small = computeAutoSetup(boxModel())
    const big = boxModel()
    big.scale.setScalar(10)
    big.updateMatrixWorld(true)
    const large = computeAutoSetup(big)
    expect(small.lights.map((l) => l.id)).toEqual(["auto-key", "auto-fill", "auto-rim"])
    expect(small.lights.filter((l) => l.castShadow).map((l) => l.id)).toEqual(["auto-key"])
    const dist = (s: typeof small) => {
      const l = s.lights[0]!
      return new Vector3(l.x, l.y, l.z).distanceTo(new Vector3(...s.bounds.center))
    }
    expect(dist(large)).toBeCloseTo(dist(small) * 10, 4)
    expect(small.shadow.right).toBeGreaterThan(small.bounds.radius)
    expect(small.shadow.far).toBeGreaterThan(small.shadow.near)
  })

  test("sweep runs along the longest side over the whole box", () => {
    const s = computeAutoSetup(boxModel())
    expect(s.sweep.axis).toEqual([1, 0, 0])
    expect(s.sweep.start).toBe(8)
    expect(s.sweep.end).toBe(12)
    expect(s.sweep.durationMs).toBe(1000)
  })

  test("sweep duration grows with the triangle count and is capped", () => {
    const dense = new Group()
    //2 x 128 x 128 segments per face pair: 6 faces * 2 * 128 * 128 = 196608 triangles
    dense.add(new Mesh(new BoxGeometry(1, 3, 1, 128, 128, 128), new MeshStandardMaterial()))
    const s = computeAutoSetup(dense)
    expect(s.sweep.axis).toEqual([0, 1, 0])
    expect(s.stats.triangles).toBe(196608)
    expect(s.sweep.durationMs).toBeGreaterThan(1000)
    expect(s.sweep.durationMs).toBeLessThanOrEqual(3000)
  })

  test("stats of a simple box", () => {
    const s = computeAutoSetup(boxModel())
    expect(s.stats).toEqual({
      triangles: 12,
      vertices: 24,
      meshes: 1,
      materials: { MeshStandardMaterial: 1 },
      hasUV: true,
      textures: 0,
      maxTextureSize: 0,
      vertexColors: false,
      animations: 0,
      skinned: false,
      morphTargets: false,
    })
    expect(s.warnings).toEqual([])
  })

  test("stats and warnings of a demanding model", () => {
    const root = new Group()
    const big = new DataTexture(new Uint8Array(4096 * 2 * 4), 4096, 2)
    const textured = new MeshStandardMaterial({ map: big, normalMap: big })
    const noUv = new BufferGeometry()
    noUv.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    noUv.setAttribute("color", new BufferAttribute(new Float32Array(9), 3))
    noUv.morphAttributes.position = [new BufferAttribute(new Float32Array(9), 3)]
    const a = new Mesh(noUv, textured)
    a.name = "Bare"
    const b = new Mesh(new BoxGeometry(), new MeshLambertMaterial({ name: "Old" }))
    const c = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: "Glass", transmission: 1 }))
    const d = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const inst = new InstancedMesh(new BoxGeometry(), textured, 5)
    root.add(a, b, c, d, inst)
    const s = computeAutoSetup(root, { animations: [] })
    expect(s.stats.meshes).toBe(5)
    expect(s.stats.triangles).toBe(1 + 12 * 3 + 12 * 5)
    expect(s.stats.materials).toEqual({
      MeshStandardMaterial: 1, MeshLambertMaterial: 1, MeshPhysicalMaterial: 1, MeshBasicMaterial: 1,
    })
    expect(s.stats.textures).toBe(1)
    expect(s.stats.maxTextureSize).toBe(4096)
    expect(s.stats.hasUV).toBe(false)
    expect(s.stats.vertexColors).toBe(true)
    expect(s.stats.morphTargets).toBe(true)
    expect(s.warnings).toContainEqual({ code: "unsupportedMaterial", material: "Old", type: "MeshLambertMaterial" })
    expect(s.warnings).toContainEqual({ code: "transmission", material: "Glass" })
    expect(s.warnings).toContainEqual({ code: "oversizedTextures", count: 1, limit: 2048, largest: 4096 })
    expect(s.warnings).toContainEqual({ code: "texturesWithoutUV", meshes: ["Bare"] })
  })

  test("leaves the scene graph untouched", () => {
    const root = boxModel()
    const before = root.children[0]!.matrixWorld.clone()
    computeAutoSetup(root)
    expect(root.children[0]!.matrixWorld.equals(before)).toBe(true)
    expect(root.children.length).toBe(1)
  })

  test("refuses a model with no mesh", () => {
    expect(() => computeAutoSetup(new Group())).toThrow("the model contains no mesh")
  })
})

describe("fitViewToAspect", () => {
  const box = new Box3(new Vector3(8, 0, -4), new Vector3(12, 1, -2))
  const authored = computeAutoSetup(boxModel()).views.desktop

  test("leaves a view alone at the authored aspect or wider", () => {
    expect(fitViewToAspect(authored, box, DESKTOP_ASPECT)).toBe(authored)
    expect(fitViewToAspect(authored, box, 2.4)).toBe(authored)
  })

  test("steps back along the same angle in a narrow frame, model fully visible", () => {
    const fitted = fitViewToAspect(authored, box, PHONE_ASPECT)
    expect(fitted.target).toEqual(authored.target)
    const t = new Vector3(...authored.target)
    const a = new Vector3(...authored.position).sub(t)
    const f = new Vector3(...fitted.position).sub(t)
    expect(f.length()).toBeGreaterThan(a.length())
    expect(f.clone().normalize().dot(a.clone().normalize())).toBeCloseTo(1, 6)
    expect(cornersInsideFrustum(fitted, PHONE_ASPECT)).toBe(true)
  })

  test("a close-up keeps its width instead of zooming out to the whole model", () => {
    const t = new Vector3(...authored.target)
    const close = { position: t.clone().add(new Vector3(0.3, 0.2, 0.3)).toArray() as [number, number, number], target: authored.target }
    const fitted = fitViewToAspect(close, box, PHONE_ASPECT)
    const ratio = new Vector3(...fitted.position).distanceTo(t) / new Vector3(...close.position).distanceTo(t)
    expect(ratio).toBeCloseTo(DESKTOP_ASPECT / PHONE_ASPECT, 6)
  })
})

describe("computeEdgeSegments", () => {
  const quad = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])

  test("drops the diagonal shared by a consecutive triangle pair", () => {
    const segments = computeEdgeSegments(quad, new Uint16Array([0, 1, 2, 0, 2, 3]))
    expect(segments.length / 6).toBe(4)
    const hasDiagonal = [...Array(segments.length / 6).keys()].some((i) => {
      const s = segments.subarray(6 * i, 6 * i + 6)
      return (s[0] === 0 && s[1] === 0 && s[3] === 1 && s[4] === 1) || (s[0] === 1 && s[1] === 1 && s[3] === 0 && s[4] === 0)
    })
    expect(hasDiagonal).toBe(false)
  })

  test("keeps every edge of a lone triangle and of unpaired triangles", () => {
    expect(computeEdgeSegments(quad, new Uint32Array([0, 1, 2])).length / 6).toBe(3)
    //the pair shares only one vertex: no diagonal
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 2, 1, 0])
    expect(computeEdgeSegments(pos, new Uint32Array([0, 1, 2, 2, 4, 5])).length / 6).toBe(6)
  })

  test("shared edges are drawn once", () => {
    //two quads side by side, sharing the edge 1-2
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0, 2, 1, 0])
    const segments = computeEdgeSegments(pos, new Uint32Array([0, 1, 2, 0, 2, 3, 1, 4, 5, 1, 5, 2]))
    expect(segments.length / 6).toBe(7)
  })

  test("non-indexed geometry", () => {
    expect(computeEdgeSegments(new Float32Array(9), null).length / 6).toBe(3)
  })
})

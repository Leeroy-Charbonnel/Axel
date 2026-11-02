import { describe, expect, test } from "bun:test"
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments } from "three"
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js"
import { WireframeSweep } from "../../src/three/wireframe"

describe("the file's own edges", () => {
  test("are drawn as the wireframe, de-quantized, beside their source", () => {
    //a square's four edges, stored as normalized int16 like an optimized file
    const geometry = new BufferGeometry()
    const max = 32767
    geometry.setAttribute("position", new BufferAttribute(new Int16Array([
      0, 0, 0, max, 0, 0,
      max, 0, 0, max, max, 0,
      max, max, 0, 0, max, 0,
      0, max, 0, 0, 0, 0,
    ]), 3, true))
    const source = new LineSegments(geometry, new LineBasicMaterial())
    source.scale.set(2, 2, 2)
    const parent = new Group()
    parent.add(source)

    const sweep = new WireframeSweep({
      materials: new Set(),
      meshes: [],
      authoredEdges: [source],
      setLightMix: () => {},
      onEntered: () => {},
      onLeft: () => {},
      onLeaving: () => {},
      requestRender: () => {},
      glowColor: "#00ffff",
    })
    sweep.enter(false)

    const overlay = parent.children.find((c) => c !== source) as LineSegments2
    expect(overlay === undefined).toBe(false)
    expect(overlay.visible).toBe(true)
    expect(overlay.scale.x).toBe(2)
    const start = overlay.geometry.getAttribute("instanceStart")
    expect(start.count).toBe(4)
    expect(start.getX(1)).toBeCloseTo(1, 4)
    expect(start.getY(2)).toBeCloseTo(1, 4)
    sweep.dispose()
  })
})

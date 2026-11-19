import { describe, expect, test } from "bun:test"
import { PerspectiveCamera, Scene, Vector3 } from "three"
import { LightGizmo, type LightGizmoState } from "../../src/components/model-editor/lightGizmo"
import type { ViewerCore } from "../../src/three/core"
import type { SharedLight } from "../../src/three/types"

//no WebGL and no DOM here: the canvas is a stand-in 800 by 600 box, the
//camera, the scene and the gizmo are the real code

function fakeCore() {
  const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  const canvas = {
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  }
  const scene = new Scene()
  const core = { camera, scene, renderer: { domElement: canvas }, controls: { enabled: true }, requestRender: () => {} }
  return { core: core as unknown as ViewerCore, scene, camera }
}

const sun: SharedLight = {
  id: "sun", type: "directional", x: 2, y: 1, z: 0, tx: -2, ty: -1, tz: 0,
  normalIntensity: 1, normalColor: "#ffffff", wfIntensity: 1, wfColor: "#ffffff",
}
const bulb: SharedLight = { ...sun, id: "bulb", type: "point", x: 0, y: 2, z: 0 }

const state = (over: Partial<LightGizmoState>): LightGizmoState => ({
  lights: [sun, bulb], selected: null, look: "normal", accent: "#00ffff", ...over,
})

//where a world point lands on the stand-in canvas
function onScreen(camera: PerspectiveCamera, x: number, y: number, z: number): [number, number] {
  const v = new Vector3(x, y, z).project(camera)
  return [(v.x + 1) / 2 * 800, (1 - v.y) / 2 * 600]
}

describe("LightGizmo", () => {
  test("a click on a handle picks that light, or the target of a sun", () => {
    const { core, scene, camera } = fakeCore()
    const gizmo = new LightGizmo(core, 1, { onMove: () => {}, onDragging: () => {} })
    gizmo.setVisible(true)
    gizmo.sync(state({}))
    scene.updateMatrixWorld(true)
    expect(gizmo.pick(...onScreen(camera, 2, 1, 0))).toEqual({ id: "sun", part: "position" })
    expect(gizmo.pick(...onScreen(camera, -2, -1, 0))).toEqual({ id: "sun", part: "target" })
    expect(gizmo.pick(...onScreen(camera, 0, 2, 0))).toEqual({ id: "bulb", part: "position" })
    expect(gizmo.pick(...onScreen(camera, 3, -2, 0))).toBeNull()
  })

  test("hidden handles are not picked", () => {
    const { core, scene, camera } = fakeCore()
    const gizmo = new LightGizmo(core, 1, { onMove: () => {}, onDragging: () => {} })
    gizmo.sync(state({}))
    scene.updateMatrixWorld(true)
    expect(gizmo.pick(...onScreen(camera, 2, 1, 0))).toBeNull()
  })

  test("the arrows sit on the selected light, or on its target", () => {
    const { core, scene } = fakeCore()
    const gizmo = new LightGizmo(core, 1, { onMove: () => {}, onDragging: () => {} })
    gizmo.setVisible(true)
    const arrows = () => scene.getObjectsByProperty("isTransformControlsRoot", true)[0] as unknown as { controls: { object?: { position: Vector3 }; enabled: boolean } }
    gizmo.sync(state({ selected: { id: "sun", part: "position" } }))
    expect(arrows().controls.object!.position.toArray()).toEqual([2, 1, 0])
    gizmo.sync(state({ selected: { id: "sun", part: "target" } }))
    expect(arrows().controls.object!.position.toArray()).toEqual([-2, -1, 0])
    //a bulb has no target, a removed light has no arrows
    gizmo.sync(state({ selected: { id: "bulb", part: "target" } }))
    expect(arrows().controls.object).toBeUndefined()
    gizmo.sync(state({ selected: { id: "gone", part: "position" } }))
    expect(arrows().controls.object).toBeUndefined()
  })

  test("dispose leaves nothing in the scene", () => {
    const { core, scene } = fakeCore()
    const gizmo = new LightGizmo(core, 1, { onMove: () => {}, onDragging: () => {} })
    gizmo.sync(state({ selected: { id: "sun", part: "position" } }))
    gizmo.dispose()
    expect(scene.children.length).toBe(0)
  })
})

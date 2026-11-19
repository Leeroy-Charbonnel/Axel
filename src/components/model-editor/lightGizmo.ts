import {
  BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D, OctahedronGeometry, Raycaster,
  SphereGeometry, Vector2, Vector3,
} from "three"
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"
import type { ViewerCore } from "../../three/core"
import type { SharedLight, Vec3 } from "../../three/types"

//THE LIGHTS IN THE VIEWPORT, editor only. Every light is a handle the admin
//can click; a sun-like light also shows its target and the line between them.
//The selected handle carries the move arrows (three's TransformControls), and
//each drag frame is handed back as a new position.

//the light itself, or the point a directional light aims at
export type LightPart = "position" | "target"

export interface LightPick {
  id:   string
  part: LightPart
}

export interface LightGizmoHooks {
  onMove(pick: LightPick, position: Vec3): void
  //a drag started or ended
  onDragging(dragging: boolean): void
}

export interface LightGizmoState {
  lights:   SharedLight[]
  selected: LightPick | null
  //the colour each handle shows: the look being edited
  look:     "normal" | "wireframe"
  //CSS colour of the selected handle's ring
  accent:   string
}

//handle sizes, in model radii
const HANDLE_SIZE   = 0.045
const TARGET_SIZE   = 0.03
const RING_SCALE    = 1.6
//drawn over the model, the arrows over the handles
const HANDLE_ORDER  = 1000
const OFF_OPACITY   = 0.3
const LINE_OPACITY  = 0.6
const ARROWS_SIZE   = 0.8

const positionOf = (l: SharedLight): Vec3 => [l.x, l.y, l.z]
const targetOf   = (l: SharedLight): Vec3 => [l.tx ?? 0, l.ty ?? 0, l.tz ?? 0]

export class LightGizmo {
  private readonly core: ViewerCore
  private readonly hooks: LightGizmoHooks
  private readonly root = new Group()
  private readonly handles = new Group()
  //what the arrows move; the handles follow through the document
  private readonly proxy = new Object3D()
  private readonly arrows: TransformControls
  private readonly arrowsHelper: Object3D
  private readonly lightGeometry: SphereGeometry
  private readonly targetGeometry: OctahedronGeometry
  private readonly ringGeometry: SphereGeometry
  private readonly picks = new Map<Object3D, LightPick>()
  private selected: LightPick | null = null
  private orbitWasEnabled = true

  constructor(core: ViewerCore, modelRadius: number, hooks: LightGizmoHooks) {
    this.core = core
    this.hooks = hooks
    this.lightGeometry  = new SphereGeometry(modelRadius * HANDLE_SIZE, 16, 12)
    this.targetGeometry = new OctahedronGeometry(modelRadius * TARGET_SIZE)
    this.ringGeometry   = new SphereGeometry(modelRadius * HANDLE_SIZE * RING_SCALE, 12, 8)

    this.arrows = new TransformControls(core.camera, core.renderer.domElement)
    this.arrows.setMode("translate")
    this.arrows.setSize(ARROWS_SIZE)
    this.arrows.addEventListener("change", core.requestRender)
    this.arrows.addEventListener("dragging-changed", (e) => this.onDragging(e.value === true))
    this.arrows.addEventListener("objectChange", () => {
      if (this.selected) this.hooks.onMove(this.selected, [this.proxy.position.x, this.proxy.position.y, this.proxy.position.z])
    })
    this.arrowsHelper = this.arrows.getHelper()

    this.root.add(this.handles, this.proxy, this.arrowsHelper)
    this.root.visible = false
    core.scene.add(this.root)
  }

  get dragging(): boolean {
    return this.arrows.dragging
  }

  //the pointer is on an arrow: a click there is not a pick
  get overArrows(): boolean {
    return this.arrows.axis !== null
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible
    this.arrows.enabled = visible && this.selected !== null
    this.core.requestRender()
  }

  //Draws the lights as they are in the document.
  sync(state: LightGizmoState): void {
    this.clearHandles()
    for (const light of state.lights) {
      const off = light.enabled === false
      const color = state.look === "normal" ? light.normalColor : light.wfColor
      const on = state.selected?.id === light.id
      const position = positionOf(light)
      this.addHandle(this.lightGeometry, position, color, off, { id: light.id, part: "position" }, on && state.selected!.part === "position" ? state.accent : null)
      if (light.type !== "directional") continue
      const target = targetOf(light)
      this.addHandle(this.targetGeometry, target, color, off, { id: light.id, part: "target" }, on && state.selected!.part === "target" ? state.accent : null)
      const line = new Line(
        new BufferGeometry().setFromPoints([new Vector3(...position), new Vector3(...target)]),
        new LineBasicMaterial({ color, transparent: true, opacity: off ? OFF_OPACITY : LINE_OPACITY, depthTest: false }),
      )
      line.renderOrder = HANDLE_ORDER
      this.handles.add(line)
    }
    this.select(state)
    this.core.requestRender()
  }

  //the handle under a pointer position, null over anything else
  pick(clientX: number, clientY: number): LightPick | null {
    if (!this.root.visible) return null
    const rect = this.core.renderer.domElement.getBoundingClientRect()
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new Raycaster()
    ray.setFromCamera(ndc, this.core.camera)
    const hit = ray.intersectObjects([...this.picks.keys()], false)[0]
    return hit ? this.picks.get(hit.object)! : null
  }

  dispose(): void {
    this.clearHandles()
    this.arrows.detach()
    this.arrows.dispose()
    this.root.removeFromParent()
    this.lightGeometry.dispose()
    this.targetGeometry.dispose()
    this.ringGeometry.dispose()
  }

  private select(state: LightGizmoState): void {
    const light = state.selected ? state.lights.find((l) => l.id === state.selected!.id) : undefined
    //a target only exists on a directional light
    const pick = light && (state.selected!.part === "position" || light.type === "directional") ? state.selected : null
    this.selected = pick
    if (!light || !pick) {
      this.arrows.detach()
      this.arrows.enabled = false
      return
    }
    //mid-drag the arrows lead: the document already holds this position
    if (!this.arrows.dragging) this.proxy.position.set(...(pick.part === "position" ? positionOf(light) : targetOf(light)))
    if (this.arrows.object !== this.proxy) this.arrows.attach(this.proxy)
    this.arrows.enabled = this.root.visible
  }

  private addHandle(geometry: BufferGeometry, position: Vec3, color: string, off: boolean, pick: LightPick, ring: string | null): void {
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ color, transparent: true, opacity: off ? OFF_OPACITY : 1, depthTest: false }))
    mesh.position.set(...position)
    mesh.renderOrder = HANDLE_ORDER
    this.handles.add(mesh)
    this.picks.set(mesh, pick)
    if (!ring) return
    const halo = new Mesh(this.ringGeometry, new MeshBasicMaterial({ color: ring, wireframe: true, transparent: true, depthTest: false }))
    halo.position.set(...position)
    halo.renderOrder = HANDLE_ORDER
    this.handles.add(halo)
  }

  //the shared handle geometries stay; lines own theirs
  private clearHandles(): void {
    for (const child of [...this.handles.children]) {
      const drawn = child as Mesh | Line
      if (drawn instanceof Line) drawn.geometry.dispose()
      ;(drawn.material as MeshBasicMaterial | LineBasicMaterial).dispose()
      this.handles.remove(child)
    }
    this.picks.clear()
  }

  //the camera stays still while a light is dragged
  private onDragging(dragging: boolean): void {
    const controls = this.core.controls
    if (dragging) {
      this.orbitWasEnabled = controls.enabled
      controls.enabled = false
    } else {
      controls.enabled = this.orbitWasEnabled
    }
    this.hooks.onDragging(dragging)
  }
}

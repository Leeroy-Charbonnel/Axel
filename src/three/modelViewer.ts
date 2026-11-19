import {
  AnimationMixer,
  Box3,
  type LineSegments,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Raycaster,
  Spherical,
  type Texture,
  Vector2,
  Vector3,
} from "three"
import { VIEWER_DEFAULTS } from "../lib/viewer-defaults"
import { createFloorGlow, placeFloorGlow } from "./floorGlow"
import { type AutoSetup, type CameraView, computeAutoSetup, fitCameraView, fitViewToAspect } from "./autoSetup"
import { createViewerCore, type ViewerCore } from "./core"
import { disposeObject } from "./dispose"
import { EnvironmentManager, type EnvironmentSpec } from "./environment"
import { LightRig, rigShape } from "./lights"
import { nextStep } from "./loadQueue"
import { type ProgressFn, loadGltf } from "./loaders"
import {
  applyMaterialState,
  createClayMaterial,
  createSweepMaterial,
  type CustomEmissiveMaterial,
  pushSweepUniforms,
  readMaterialState,
  type SweepBasicMaterial,
  type SweepMaterial,
} from "./materials"
import type { EnvironmentSettings, MaterialState, StartView, Vec3, ViewerMode, ViewerSettings } from "./types"
import { isSiteBackground, onSiteThemeChange, resolveWireColor } from "./wireColor"
import { WireframeSweep } from "./wireframe"

//THE PUBLIC VIEWER'S SCENE LOGIC, framework free: load a GLB, apply the saved
//settings, frame it, and switch between render, wireframe and clay. The Vue
//component owns the states around it (poster, progress, errors, toolbar).
//The admin editor drives the same class, so it renders what visitors see.

const INTRO_MS = 2800
const INTRO_RADIUS_SCALE = 2.5
const INTRO_AZIMUTH_OFFSET = Math.PI / 4
const INTRO_POLAR_OFFSET = 0.2
const INTRO_MIN_POLAR = 0.05
const RESET_MS = 700
const AUTO_ROTATE_SPEED = 0.6
//room to orbit beyond a frame fitted on the lights
const REACH_MARGIN = 1.5
//the studio environment under clay, dimmer than a lit render so the grey reads as grey
const CLAY_ENV_INTENSITY = 0.5

//a label point on the canvas, in CSS pixels from its top left corner
export interface LabelPoint {
  x:       number
  y:       number
  //false behind the camera
  visible: boolean
}

export interface ModelViewerOptions {
  canvas:        HTMLCanvasElement
  maxPixelRatio: number
  //a phone or a tablet: never the heaviest render quality
  touch:         boolean
  //no intro flight, no auto-rotate, no sweep animation, no looping animation
  reducedMotion: boolean
  autoRotate:    boolean
  //CSS colour of the wireframe lines along the sweep front
  glowColor:     string
}

interface Flight {
  from:     Spherical
  to:       Spherical
  target:   Vector3
  start:    number
  duration: number
}

//one material of the model as the editor lists it: matched by name, or by
//glTF index when it has none
export interface MaterialSlot {
  name:     string
  index:    number | undefined
  defaults: MaterialState
}

type MaterialKey = { name: string; index: number | undefined }
type EmissivePick = CustomEmissiveMaterial | SweepBasicMaterial

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const envSpec = (m: EnvironmentSettings | undefined): EnvironmentSpec => ({
  url:        m?.hdrUrl,
  intensity:  m?.hdrIntensity ?? 1,
  rotation:   m?.hdrRotation ?? 0,
  background: m?.hdrBackground ?? false,
})
const CLAY_ENV: EnvironmentSpec = { url: null, intensity: CLAY_ENV_INTENSITY, rotation: 0, background: false }
const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z]

export class ModelViewer {
  readonly core: ViewerCore
  private readonly env: EnvironmentManager
  private readonly floorGlow: Mesh
  private readonly abort = new AbortController()
  private settings: ViewerSettings = {}
  private setup: AutoSetup | null = null
  private model: Object3D | null = null
  private meshes: Mesh[] = []
  private readonly materials = new Set<SweepMaterial>()
  private readonly materialKeys = new Map<SweepMaterial, MaterialKey>()
  //values as loaded, restored when an override goes away
  private readonly materialDefaults = new Map<SweepMaterial, MaterialState>()
  //the shared normal copies of each mesh, and the emissive copies of the picked ones
  private readonly normalOf = new Map<Mesh, SweepMaterial | SweepMaterial[]>()
  private readonly picked = new Map<Mesh, EmissivePick[]>()
  private pickKey = ""
  private lightKey = ""
  private lightShape = ""
  //editor: how far the camera may back away to see the lights, 0 on the site
  private reach = 0
  //stops the watch on the site theme, kept while a colour follows it
  private stopThemeWatch: (() => void) | null = null
  private rig: LightRig | null = null
  private lightMix = 0
  private sweep: WireframeSweep | null = null
  private mode: ViewerMode = "render"
  private clay: MeshStandardMaterial | null = null
  private readonly clayBackup = new Map<Mesh, Material | Material[]>()
  private mixer: AnimationMixer | null = null
  private flight: Flight | null = null
  private introPending = false
  private disposed = false
  private compiling: Promise<unknown> | null = null
  //settles once the last environment asked for is on the scene
  private envReady: Promise<void> = Promise.resolve()
  //the label points in the scene, once the model is set on the ground
  private labelPoints: Vector3[] = []
  private labelListener: ((points: LabelPoint[]) => void) | null = null
  private readonly opts: ModelViewerOptions
  private glowColor: string

  //Throws when WebGL is unavailable.
  constructor(opts: ModelViewerOptions) {
    this.opts = opts
    this.glowColor = opts.glowColor
    this.core = createViewerCore(opts.canvas, { maxPixelRatio: opts.maxPixelRatio, touch: opts.touch })
    //a lower quality level: smaller shadow maps, coarser texture filtering
    this.core.onQualityChange(() => {
      if (!this.setup) return
      this.lightKey = ""
      this.buildLights(this.mode === "clay")
      this.applyAnisotropy()
    })
    this.env  = new EnvironmentManager(this.core.scene, this.core.renderer, this.core.requestRender)
    this.floorGlow = createFloorGlow()
    this.core.scene.add(this.floorGlow)
    this.core.addFrameCallback((dt, now) => this.frame(dt, now))
    this.core.onResize((w, h) => this.sweep?.setResolution(w, h))
    //after the frame: the marks follow the camera as drawn, not one frame late
    this.core.onRendered(() => this.emitLabels())
    this.core.controls.addEventListener("start", () => {
      this.core.controls.autoRotate = false
    })
  }

  get autoSetup(): AutoSetup | null {
    return this.setup
  }

  //unique by name, in the order the model lists them
  get materialSlots(): MaterialSlot[] {
    const slots = new Map<string, MaterialSlot>()
    for (const [mat, key] of this.materialKeys) {
      if (!key.name && key.index === undefined) continue
      const id = key.name ? `n:${key.name}` : `i:${key.index}`
      if (!slots.has(id)) slots.set(id, { name: key.name, index: key.index, defaults: this.materialDefaults.get(mat)! })
    }
    return [...slots.values()]
  }

  get meshNames(): string[] {
    return [...new Set(this.meshes.map((m) => m.name).filter(Boolean))]
  }

  //Rejects with the reason when the model cannot be shown. mode: the one the
  //viewer opens in, so its first frame is prepared for it.
  async load(url: string, settings: ViewerSettings, onProgress: ProgressFn, mode: ViewerMode = "render"): Promise<void> {
    this.settings = settings
    //the environment downloads alongside the model
    this.setEnvironment(envSpec(settings.normalMode))
    const gltf = await loadGltf(url, this.core.renderer, this.abort.signal, onProgress)
    const root = gltf.scene
    if (this.disposed) {
      disposeObject(root)
      return
    }
    this.model = root
    //BLENDER'S OWN EDGES - line objects in the file (loose edges exported next
    //to each mesh) are the wireframe, drawn instead of edges rebuilt from
    //triangles; hidden here, the sweep draws them in wireframe mode
    const authoredEdges: LineSegments[] = []
    root.traverse((obj) => { if ((obj as LineSegments).isLineSegments) authoredEdges.push(obj as LineSegments) })
    for (const line of authoredEdges) line.visible = false
    //in the scene from here on, so the scene disposal frees it whatever happens next
    root.visible = false
    this.core.scene.add(root)

    //ON THE GROUND, centred on the vertical axis
    root.updateMatrixWorld(true)
    const raw = new Box3().setFromObject(root)
    const c = raw.getCenter(new Vector3())
    root.position.x -= c.x
    root.position.z -= c.z
    root.position.y -= raw.min.y
    root.updateMatrixWorld(true)
    //the label points move with the model
    this.labelPoints = (settings.labels ?? []).map((p) => new Vector3(...p).add(root.position))

    const setup = computeAutoSetup(root, { animations: gltf.animations })
    this.setup = setup
    for (const w of setup.warnings) console.warn(`[three] ${url}: ${w.code}`, w)

    //MATERIALS - one sweep copy per source material; the emissive picks get
    //their own copy of it
    const copies = new Map<Material, SweepMaterial>()
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.meshes.push(mesh)
      const convert = (source: Material): SweepMaterial => {
        const shared = copies.get(source)
        if (shared) return shared
        const copy = createSweepMaterial(source, null)
        copies.set(source, copy)
        this.materials.add(copy)
        this.materialKeys.set(copy, { name: source.name, index: gltf.parser.associations.get(source)?.materials })
        this.materialDefaults.set(copy, readMaterialState(copy))
        return copy
      }
      const normal = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
      this.normalOf.set(mesh, normal)
      mesh.material = normal
    })
    //the copies hold the textures now; only the source programs go
    for (const s of copies.keys()) s.dispose()
    this.applyAnisotropy()
    this.core.setModelRadius(setup.bounds.radius)

    this.applyEmissivePicks()
    this.applyMaterialOverrides()
    this.buildLights(false)

    this.applyStage()

    const cam = this.core.camera
    cam.near = setup.clip.near
    cam.far  = setup.clip.far
    cam.updateProjectionMatrix()

    this.sweep = new WireframeSweep({
      materials: this.materials,
      meshes:    this.meshes,
      authoredEdges,
      setLightMix: (t) => {
        this.lightMix = t
        this.rig?.setModeMix(t)
      },
      onEntered: () => this.setEnvironment(envSpec(this.settings.wireframeMode)),
      onLeaving: () => this.setEnvironment(envSpec(this.settings.normalMode)),
      //the ambient occlusion pass would take the lines for surfaces: back once they are gone
      onLeft: () => this.core.setAmbientOcclusionAllowed(this.mode === "render"),
      requestRender: this.core.requestRender,
      glowColor: this.glowColor,
    })
    const size = this.core.renderer.getSize(new Vector2())
    this.sweep.setResolution(size.x, size.y)
    this.sweep.setExcluded(new Set(this.picked.keys()))
    this.configureSweep()

    if (gltf.animations.length > 0) {
      this.mixer = new AnimationMixer(root)
      this.mixer.clipAction(gltf.animations[0]!).play()
      this.mixer.update(0)
    }

    root.visible = true
    this.setMode(mode, false)
    await this.envReady
    await nextStep()
    if (this.disposed) return
    //compile off the first frame where the driver allows it
    this.compiling = this.core.compile([...this.materials].filter((m) => "transmission" in m && m.transmission > 0), nextStep)
    try {
      await this.compiling
    } finally {
      this.compiling = null
    }
    if (this.disposed) return

    this.placeCamera()
    //THE FIRST FRAME, prepared before the viewer is on screen, one step per
    //task: each texture goes to the GPU alone, then the frame is drawn in parts
    for (const texture of this.textures()) {
      await nextStep()
      if (this.disposed) return
      this.core.renderer.initTexture(texture)
    }
    await nextStep()
    if (this.disposed) return
    await this.core.warmUp(nextStep)
  }

  //Live edits from the admin. The camera stays where the visitor put it.
  applySettings(settings: ViewerSettings): void {
    this.settings = settings
    if (!this.model || !this.setup) return
    this.applyEmissivePicks()
    this.applyMaterialOverrides()
    this.configureSweep()
    this.sweep?.resync()
    this.applyLighting()
    this.applyStage()
    this.applyOrbitLimits(this.restPose())
    this.core.requestRender()
  }

  //Ignored until the model is loaded: load() takes the mode a viewer opens in.
  //animate false: shown at once, no sweep
  setMode(mode: ViewerMode, animate = !this.opts.reducedMotion): void {
    if (!this.sweep || mode === this.mode) return
    const previous = this.mode
    this.mode = mode
    if (previous === "clay") {
      this.setClay(false)
      this.applyLighting()
    }
    //ambient occlusion suits the lit render only; leaving the wireframe, onLeft brings it back
    if (mode !== "render") this.core.setAmbientOcclusionAllowed(false)
    else if (previous === "clay") this.core.setAmbientOcclusionAllowed(true)
    if (mode === "wireframe") this.sweep.enter(animate)
    else if (previous === "wireframe") this.sweep.leave(animate && mode === "render")
    if (mode === "clay") {
      this.setClay(true)
      this.applyLighting()
    }
    this.core.requestRender()
  }

  //Plays the intro flight once, if the model is parked waiting for it.
  playIntro(): void {
    if (!this.introPending) return
    this.introPending = false
    const rest = this.restPose()
    const target = new Vector3(...rest.target)
    const to = new Spherical().setFromVector3(new Vector3(...rest.position).sub(target))
    const from = new Spherical().setFromVector3(this.core.camera.position.clone().sub(target))
    this.fly(from, to, target, INTRO_MS)
  }

  resetView(): void {
    this.flyTo(this.restPose())
  }

  flyTo(view: CameraView): void {
    this.introPending = false
    const target = new Vector3(...view.target)
    if (this.opts.reducedMotion) {
      this.flight = null
      this.snapCamera(view)
      return
    }
    const cam = this.core.camera
    const from = new Spherical().setFromVector3(cam.position.clone().sub(this.core.controls.target))
    const to = new Spherical().setFromVector3(new Vector3(...view.position).sub(target))
    //turn the short way round
    const turn = to.theta - from.theta
    from.theta += Math.round(turn / (2 * Math.PI)) * 2 * Math.PI
    this.fly(from, to, target, RESET_MS)
  }

  //CSS colour of the wireframe lines along the sweep front
  setGlowColor(color: string): void {
    this.glowColor = color
    this.sweep?.setGlowColor(color)
  }

  setActive(active: boolean): void {
    this.core.setActive(active)
  }

  dispose(loseContext: boolean): void {
    this.disposed = true
    this.abort.abort()
    //three's compile poll reads the materials' programs: freeing them under it
    //throws inside the poll, where nobody catches it
    const compiling = this.compiling ?? this.env.compiling
    if (compiling) {
      const release = () => this.release(loseContext)
      compiling.then(release, release)
      return
    }
    this.release(loseContext)
  }

  private release(loseContext: boolean): void {
    this.stopThemeWatch?.()
    this.sweep?.dispose()
    this.rig?.dispose()
    this.env.dispose()
    this.mixer?.stopAllAction()
    //clay swaps out the originals: put them back so the scene disposal reaches them
    this.setClay(false)
    this.clay?.dispose()
    //picked meshes get their normal copies back so the scene disposal frees their textures
    for (const [mesh, list] of this.picked) {
      for (const m of list) m.dispose()
      mesh.material = this.normalOf.get(mesh)!
    }
    this.core.dispose(loseContext)
  }

  //EDITOR ACCESS

  cameraView(): CameraView {
    return { position: tuple(this.core.camera.position), target: tuple(this.core.controls.target) }
  }

  //no flight: the editor puts the camera where it was asked, at once
  setCameraView(view: CameraView): void {
    this.introPending = false
    this.flight = null
    this.snapCamera(view)
  }

  //the automatic framing for the current frame
  autoView(): CameraView {
    return fitCameraView(this.box(), this.core.camera.aspect)
  }

  //a saved view as this frame shows it
  fitView(view: StartView): CameraView {
    return fitViewToAspect({ position: view.pos, target: view.target }, this.box(), this.core.camera.aspect, undefined, view.aspect)
  }

  //Flies back until the model and these points (its lights) are all in the
  //frame, and lets the camera orbit from that far.
  frameWith(points: Vec3[]): void {
    const box = this.box()
    for (const p of points) box.expandByPoint(new Vector3(...p))
    const view = fitCameraView(box, this.core.camera.aspect)
    this.reach = new Vector3(...view.position).distanceTo(new Vector3(...view.target)) * REACH_MARGIN
    this.applyOrbitLimits(this.restPose())
    this.flyTo(view)
  }

  //the mesh under a pointer position, null over the background
  meshAt(clientX: number, clientY: number): Mesh | null {
    const rect = this.core.renderer.domElement.getBoundingClientRect()
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new Raycaster()
    ray.setFromCamera(ndc, this.core.camera)
    const hit = ray.intersectObjects(this.meshes, false).find((h) => h.object.visible)
    return hit ? hit.object as Mesh : null
  }

  //CAMERA

  private box(): Box3 {
    const b = this.setup!.bounds.box
    return new Box3(new Vector3(...b.min), new Vector3(...b.max))
  }

  //the project's view, else the default view of this kind of screen, else the auto framing
  private restPose(): CameraView {
    const aspect = this.core.camera.aspect
    const defaults = this.settings.defaultViews
    const sv = this.settings.startView ?? (aspect < 1 ? defaults?.phone : defaults?.desktop)
    return sv ? this.fitView(sv) : fitCameraView(this.box(), aspect)
  }

  //the saved limits, widened so the rest pose stays reachable
  private applyOrbitLimits(rest: CameraView): void {
    const controls = this.core.controls
    const setup = this.setup!
    const radius = setup.bounds.radius
    const stage = this.settings.stage
    const min = stage?.orbitMin !== undefined ? stage.orbitMin * radius : setup.orbit.minDistance
    const max = stage?.orbitMax !== undefined ? stage.orbitMax * radius : setup.orbit.maxDistance
    const distance = new Vector3(...rest.position).distanceTo(new Vector3(...rest.target))
    controls.minDistance = Math.min(min, distance)
    controls.maxDistance = Math.max(max, distance, this.reach)
    const cam = this.core.camera
    cam.far = Math.max(setup.clip.far, controls.maxDistance + radius * 4)
    cam.updateProjectionMatrix()
  }

  //sharp textures at grazing angles (wood grain on a side), as much as the level and the GPU allow
  private applyAnisotropy(): void {
    const level = Math.min(this.core.quality.anisotropy, this.core.renderer.capabilities.getMaxAnisotropy())
    for (const texture of this.textures()) {
      if (texture.anisotropy === level) continue
      texture.anisotropy = level
      texture.needsUpdate = true
    }
    this.core.requestRender()
  }

  //every texture of the model, once
  private textures(): Set<Texture> {
    const found = new Set<Texture>()
    for (const mat of this.materials) {
      for (const value of Object.values(mat)) {
        const texture = value as Texture | null
        if (texture?.isTexture) found.add(texture)
      }
    }
    return found
  }

  private setEnvironment(spec: EnvironmentSpec): void {
    this.envReady = this.env.set(spec)
  }

  //the label points on screen, after every frame drawn
  onLabels(listener: (points: LabelPoint[]) => void): void {
    this.labelListener = listener
    this.core.requestRender()
  }

  private emitLabels(): void {
    if (!this.labelListener || !this.labelPoints.length) return
    const canvas = this.core.renderer.domElement
    const w = canvas.clientWidth, h = canvas.clientHeight
    const v = new Vector3()
    this.labelListener(this.labelPoints.map((p) => {
      v.copy(p).project(this.core.camera)
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 }
    }))
  }

  private applyStage(): void {
    const stage = this.settings.stage
    this.floorGlow.visible = stage?.ground ?? true
    if (this.setup) {
      const { center, radius } = this.setup.bounds
      placeFloorGlow(this.floorGlow, center, radius, this.setup.ground.y - (stage?.lift ?? 0) * radius)
    }
  }

  private placeCamera(): void {
    const rest = this.restPose()
    const controls = this.core.controls
    this.applyOrbitLimits(rest)
    const cam = this.core.camera
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED
    if (this.opts.reducedMotion) {
      this.snapCamera(rest)
      return
    }
    //parked at the start of the intro until playIntro()
    const target = new Vector3(...rest.target)
    const to = new Spherical().setFromVector3(new Vector3(...rest.position).sub(target))
    const parked = this.parkedSpherical(to)
    cam.position.copy(target).add(new Vector3().setFromSpherical(parked))
    cam.lookAt(target)
    controls.target.copy(target)
    controls.enabled = false
    this.introPending = true
  }

  private parkedSpherical(rest: Spherical): Spherical {
    return new Spherical(
      rest.radius * INTRO_RADIUS_SCALE,
      Math.max(INTRO_MIN_POLAR, rest.phi - INTRO_POLAR_OFFSET),
      rest.theta + INTRO_AZIMUTH_OFFSET,
    )
  }

  private snapCamera(view: CameraView): void {
    const controls = this.core.controls
    this.core.camera.position.set(...view.position)
    controls.target.set(...view.target)
    controls.enabled = true
    controls.autoRotate = this.opts.autoRotate && !this.opts.reducedMotion
    controls.update()
    this.core.requestRender()
  }

  private fly(from: Spherical, to: Spherical, target: Vector3, duration: number): void {
    this.core.controls.enabled = false
    this.core.controls.target.copy(target)
    this.flight = { from, to, target, start: performance.now(), duration }
    this.core.requestRender()
  }

  private frame(dt: number, now: number): boolean {
    let busy = false
    if (this.flight) {
      const f = this.flight
      const t = Math.min(1, (now - f.start) / f.duration)
      const k = ease(t)
      const s = new Spherical(
        f.from.radius + (f.to.radius - f.from.radius) * k,
        f.from.phi    + (f.to.phi    - f.from.phi)    * k,
        f.from.theta  + (f.to.theta  - f.from.theta)  * k,
      )
      const cam = this.core.camera
      cam.position.copy(f.target).add(new Vector3().setFromSpherical(s))
      cam.lookAt(f.target)
      busy = true
      if (t >= 1) {
        this.flight = null
        const controls = this.core.controls
        controls.enabled = true
        controls.autoRotate = this.opts.autoRotate && !this.opts.reducedMotion
        controls.update()
      }
    }
    if (this.sweep?.update(now)) busy = true
    if (this.mixer && !this.opts.reducedMotion) {
      this.mixer.update(dt)
      busy = true
    }
    return busy
  }

  //SETTINGS

  private applyMaterialOverrides(): void {
    const specs = this.settings.materials ?? []
    const byName  = new Map<string, MaterialState>()
    const byIndex = new Map<number, MaterialState>()
    for (const s of specs) {
      if (s.name) byName.set(s.name, s)
      else if (s.index !== undefined) byIndex.set(s.index, s)
    }
    for (const [mat, key] of this.materialKeys) {
      const spec = key.name ? byName.get(key.name) : key.index !== undefined ? byIndex.get(key.index) : undefined
      applyMaterialState(mat, spec ?? this.materialDefaults.get(mat)!)
    }
  }

  //A picked mesh swaps its normal copies for emissive copies of them, which
  //share their key and defaults; unpicking puts the normal copies back.
  private applyEmissivePicks(): void {
    const specs = this.settings.wireframeMode?.emissiveMeshes ?? []
    const key = JSON.stringify(specs)
    if (key === this.pickKey) return
    this.pickKey = key
    const boost = new Map<string, number>()
    for (const e of specs) if (e.name) boost.set(e.name, e.intensity)
    for (const mesh of this.meshes) {
      const b = boost.get(mesh.name)
      const current = this.picked.get(mesh)
      const normal = this.normalOf.get(mesh)!
      if (b === undefined) {
        if (!current) continue
        for (const m of current) {
          this.materials.delete(m)
          this.materialKeys.delete(m)
          this.materialDefaults.delete(m)
          //the textures belong to the normal copy
          m.dispose()
        }
        this.picked.delete(mesh)
        this.setMeshMaterial(mesh, normal)
        continue
      }
      if (current) {
        for (const m of current) m.setEmissiveBoost(b)
        continue
      }
      const list = (Array.isArray(normal) ? normal : [normal]).map((n) => {
        const copy = createSweepMaterial(n, b) as EmissivePick
        this.materials.add(copy)
        this.materialKeys.set(copy, this.materialKeys.get(n)!)
        this.materialDefaults.set(copy, this.materialDefaults.get(n)!)
        return copy
      })
      this.picked.set(mesh, list)
      this.setMeshMaterial(mesh, Array.isArray(normal) ? list : list[0]!)
    }
    this.sweep?.setExcluded(new Set(this.picked.keys()))
  }

  //under clay the mesh shows the clay material; its own one waits in the backup
  private setMeshMaterial(mesh: Mesh, material: Material | Material[]): void {
    if (this.clayBackup.has(mesh)) this.clayBackup.set(mesh, material)
    else mesh.material = material
  }

  //Clay is a neutral breakdown: the auto rig and the studio environment, the
  //same for every model. Otherwise the saved lights (the auto rig when there
  //are none) and the environment of the current mode.
  private applyLighting(): void {
    const clay = this.mode === "clay"
    this.buildLights(clay)
    this.setEnvironment(clay ? CLAY_ENV : envSpec(this.sweep?.active ? this.settings.wireframeMode : this.settings.normalMode))
  }

  private buildLights(auto: boolean): void {
    const setup = this.setup!
    const saved = this.settings.lights ?? []
    const specs = saved.length > 0 && !auto ? saved : setup.lights
    const key = auto ? "auto" : JSON.stringify(saved)
    //a live edit that did not touch the lights keeps the rig and its shadow maps
    if (this.rig && key === this.lightKey) return
    this.lightKey = key
    const shape = `${this.core.quality.shadowMapSize}:${rigShape(specs)}`
    if (this.rig && shape === this.lightShape) {
      //the same lights with new values: moved in place, nothing rebuilt
      this.rig.update(specs)
    } else {
      if (this.rig) {
        this.core.scene.remove(this.rig.group)
        this.rig.dispose()
      }
      this.rig = new LightRig(specs, this.core.quality.shadowMapSize)
      this.core.scene.add(this.rig.group)
    }
    this.lightShape = shape
    this.rig.fitShadows(new Vector3(...setup.bounds.center), setup.bounds.radius)
    this.rig.setModeMix(this.lightMix)
  }

  private configureSweep(): void {
    const setup = this.setup!
    const wf = this.settings.wireframeMode ?? {}
    const axis = new Vector3(...(wf.sweepAxis ?? setup.sweep.axis))
    if (axis.lengthSq() < 1e-8) axis.set(...setup.sweep.axis)
    axis.normalize()
    const start = wf.sweepStart ?? setup.sweep.start
    const end   = wf.sweepEnd   ?? setup.sweep.end
    const mat = wf.material ?? VIEWER_DEFAULTS.wireframeMaterial
    const surface = wf.surfaceColor ?? VIEWER_DEFAULTS.wireframeSurfaceColor
    const line = wf.lineColor ?? VIEWER_DEFAULTS.wireframeLineColor
    //a surface in the site background is left clear: the page itself shows through
    const clear = isSiteBackground(surface)
    this.watchTheme(isSiteBackground(line))
    this.sweep!.setFrame({ axis, min: start, range: Math.max(1e-4, end - start) })
    pushSweepUniforms(this.materials, {
      emissiveColor:     wf.color ?? VIEWER_DEFAULTS.wireframeModeColor,
      tintColor:         clear ? VIEWER_DEFAULTS.wireframeSurfaceColor : surface,
      metalness:         mat.metalness,
      roughness:         mat.roughness,
      envIntensity:      mat.envMapIntensity,
      specularIntensity: mat.specularIntensity,
      clear,
    })
    this.sweep!.setDuration(wf.sweepDurationMs ?? setup.sweep.durationMs)
    this.sweep!.setStyle({
      on:    wf.overlayOn ?? VIEWER_DEFAULTS.wireframeOverlayOn,
      color: resolveWireColor(line),
      width: wf.overlayLineWidth ?? VIEWER_DEFAULTS.wireframeLineWidth,
    })
  }

  //a colour that follows the site background is read again when the theme changes
  private watchTheme(on: boolean): void {
    if (on === (this.stopThemeWatch !== null)) return
    if (on) {
      this.stopThemeWatch = onSiteThemeChange(() => {
        if (this.sweep) this.configureSweep()
      })
    } else {
      this.stopThemeWatch!()
      this.stopThemeWatch = null
    }
  }

  private setClay(on: boolean): void {
    if (on) {
      this.clay ??= createClayMaterial()
      for (const mesh of this.meshes) {
        this.clayBackup.set(mesh, mesh.material)
        mesh.material = this.clay
      }
    } else {
      for (const [mesh, mat] of this.clayBackup) mesh.material = mat
      this.clayBackup.clear()
    }
  }
}

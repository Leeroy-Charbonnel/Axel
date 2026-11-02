import {
  AnimationMixer,
  Box3,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  ShadowMaterial,
  Spherical,
  Vector2,
  Vector3,
} from "three"
import { VIEWER_DEFAULTS } from "../lib/viewer-defaults"
import { type AutoSetup, type CameraView, computeAutoSetup, fitCameraView, fitViewToAspect } from "./autoSetup"
import { createViewerCore, type ViewerCore } from "./core"
import { disposeObject } from "./dispose"
import { EnvironmentManager } from "./environment"
import { LightRig } from "./lights"
import { type ProgressFn, loadGltf } from "./loaders"
import { applyMaterialState, createClayMaterial, createSweepMaterial, pushSweepUniforms, type SweepMaterial } from "./materials"
import type { MaterialState, ViewerMode, ViewerSettings } from "./types"
import { WireframeSweep } from "./wireframe"

//THE PUBLIC VIEWER'S SCENE LOGIC, framework free: load a GLB, apply the saved
//settings, frame it, and switch between render, wireframe and clay. The Vue
//component owns the states around it (poster, progress, errors, toolbar).

const GROUND_OPACITY = 0.35
const INTRO_MS = 2800
const INTRO_RADIUS_SCALE = 2.5
const INTRO_AZIMUTH_OFFSET = Math.PI / 4
const INTRO_POLAR_OFFSET = 0.2
const INTRO_MIN_POLAR = 0.05
const RESET_MS = 700
const AUTO_ROTATE_SPEED = 0.6
//the studio environment under clay, dimmer than a lit render so the grey reads as grey
const CLAY_ENV_INTENSITY = 0.5

export interface ModelViewerOptions {
  canvas:        HTMLCanvasElement
  maxPixelRatio: number
  //no intro flight, no auto-rotate, no sweep animation, no looping animation
  reducedMotion: boolean
  autoRotate:    boolean
}

interface Flight {
  from:     Spherical
  to:       Spherical
  target:   Vector3
  start:    number
  duration: number
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export class ModelViewer {
  readonly core: ViewerCore
  private readonly env: EnvironmentManager
  private readonly ground: Mesh
  private readonly abort = new AbortController()
  private settings: ViewerSettings = {}
  private setup: AutoSetup | null = null
  private model: Object3D | null = null
  private meshes: Mesh[] = []
  private readonly materials = new Set<SweepMaterial>()
  private readonly materialKeys = new Map<SweepMaterial, { name: string; index: number | undefined }>()
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
  private readonly opts: ModelViewerOptions

  //Throws when WebGL is unavailable.
  constructor(opts: ModelViewerOptions) {
    this.opts = opts
    this.core = createViewerCore(opts.canvas, { maxPixelRatio: opts.maxPixelRatio })
    this.env  = new EnvironmentManager(this.core.scene, this.core.renderer, this.core.requestRender)
    this.ground = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: GROUND_OPACITY }))
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.ground.visible = false
    this.core.scene.add(this.ground)
    this.core.addFrameCallback((dt, now) => this.frame(dt, now))
    this.core.onResize((w, h) => this.sweep?.setResolution(w, h))
    this.core.controls.addEventListener("start", () => {
      this.core.controls.autoRotate = false
    })
  }

  get autoSetup(): AutoSetup | null {
    return this.setup
  }

  //Rejects with the reason when the model cannot be shown.
  async load(url: string, settings: ViewerSettings, onProgress: ProgressFn): Promise<void> {
    this.settings = settings
    //the environment downloads alongside the model
    const envReady = this.env.set(settings.normalMode?.hdrUrl, settings.normalMode?.hdrIntensity ?? 1)
    const gltf = await loadGltf(url, this.core.renderer, this.abort.signal, onProgress)
    const root = gltf.scene
    if (this.disposed) {
      disposeObject(root)
      return
    }
    this.model = root
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

    const setup = computeAutoSetup(root, { animations: gltf.animations })
    this.setup = setup
    for (const w of setup.warnings) console.warn(`[three] ${url}: ${w}`)

    //MATERIALS - one sweep copy per source material, its own copy per emissive pick
    const emissive = new Map<string, number>()
    for (const e of settings.wireframeMode?.emissiveMeshes ?? []) if (e.name) emissive.set(e.name, e.intensity)
    const copies = new Map<Material, SweepMaterial>()
    const sources = new Set<Material>()
    const overlayMeshes: Mesh[] = []
    root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.meshes.push(mesh)
      const boost = emissive.get(mesh.name) ?? null
      if (boost === null) overlayMeshes.push(mesh)
      const convert = (source: Material): SweepMaterial => {
        sources.add(source)
        if (boost === null) {
          const shared = copies.get(source)
          if (shared) return shared
        }
        const copy = createSweepMaterial(source, boost)
        if (boost === null) copies.set(source, copy)
        this.materials.add(copy)
        this.materialKeys.set(copy, { name: source.name, index: gltf.parser.associations.get(source)?.materials })
        return copy
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
    })
    //the copies hold the textures now; only the source programs go
    for (const s of sources) s.dispose()

    this.applyMaterialOverrides()
    this.buildLights(false)

    this.ground.scale.setScalar(setup.ground.size)
    this.ground.position.y = setup.ground.y
    this.ground.visible = true

    const cam = this.core.camera
    cam.near = setup.clip.near
    cam.far  = setup.clip.far
    cam.updateProjectionMatrix()

    this.sweep = new WireframeSweep({
      materials: this.materials,
      overlayMeshes,
      setLightMix: (t) => {
        this.lightMix = t
        this.rig?.setModeMix(t)
      },
      onEntered: () => void this.env.set(this.settings.wireframeMode?.hdrUrl, this.settings.wireframeMode?.hdrIntensity ?? 1),
      onLeaving: () => void this.env.set(this.settings.normalMode?.hdrUrl, this.settings.normalMode?.hdrIntensity ?? 1),
      requestRender: this.core.requestRender,
    })
    const size = this.core.renderer.getSize(new Vector2())
    this.sweep.setResolution(size.x, size.y)
    this.configureSweep()

    if (gltf.animations.length > 0) {
      this.mixer = new AnimationMixer(root)
      this.mixer.clipAction(gltf.animations[0]!).play()
      this.mixer.update(0)
    }

    root.visible = true
    await envReady
    if (this.disposed) return
    //compile off the first frame where the driver allows it
    await this.core.renderer.compileAsync(this.core.scene, this.core.camera)
    if (this.disposed) return

    this.placeCamera()
    this.core.requestRender()
  }

  //Live edits from the admin. The camera stays where the visitor put it.
  applySettings(settings: ViewerSettings): void {
    this.settings = settings
    if (!this.model) return
    this.applyMaterialOverrides()
    this.configureSweep()
    this.applyLighting()
    this.core.requestRender()
  }

  //Ignored until the model is loaded; the caller applies its mode after load().
  setMode(mode: ViewerMode): void {
    if (!this.sweep || mode === this.mode) return
    const animate = !this.opts.reducedMotion
    const previous = this.mode
    this.mode = mode
    if (previous === "clay") {
      this.setClay(false)
      this.applyLighting()
    }
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
    this.introPending = false
    const rest = this.restPose()
    const target = new Vector3(...rest.target)
    if (this.opts.reducedMotion) {
      this.flight = null
      this.snapCamera(rest)
      return
    }
    const cam = this.core.camera
    const from = new Spherical().setFromVector3(cam.position.clone().sub(this.core.controls.target))
    const to = new Spherical().setFromVector3(new Vector3(...rest.position).sub(target))
    //turn the short way round
    const turn = to.theta - from.theta
    from.theta += Math.round(turn / (2 * Math.PI)) * 2 * Math.PI
    this.fly(from, to, target, RESET_MS)
  }

  setActive(active: boolean): void {
    this.core.setActive(active)
  }

  dispose(loseContext: boolean): void {
    this.disposed = true
    this.abort.abort()
    this.sweep?.dispose()
    this.rig?.dispose()
    this.env.dispose()
    this.mixer?.stopAllAction()
    //clay swaps out the originals: put them back so the scene disposal reaches them
    this.setClay(false)
    this.clay?.dispose()
    this.core.dispose(loseContext)
  }

  //CAMERA

  private restPose(): CameraView {
    const setup = this.setup!
    const box = new Box3(new Vector3(...setup.bounds.box.min), new Vector3(...setup.bounds.box.max))
    const aspect = this.core.camera.aspect
    const sv = this.settings.startView
    return sv
      ? fitViewToAspect({ position: sv.pos, target: sv.target }, box, aspect)
      : fitCameraView(box, aspect)
  }

  private placeCamera(): void {
    const rest = this.restPose()
    const controls = this.core.controls
    const setup = this.setup!
    const distance = new Vector3(...rest.position).distanceTo(new Vector3(...rest.target))
    controls.minDistance = Math.min(setup.orbit.minDistance, distance)
    controls.maxDistance = Math.max(setup.orbit.maxDistance, distance * 2.5)
    const cam = this.core.camera
    cam.far = Math.max(cam.far, controls.maxDistance + setup.bounds.radius * 4)
    cam.updateProjectionMatrix()
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
      if (spec) applyMaterialState(mat, spec)
    }
  }

  //Clay is a neutral breakdown: the auto rig and the studio environment, the
  //same for every model. Otherwise the saved lights (the auto rig when there
  //are none) and the environment of the current mode.
  private applyLighting(): void {
    const clay = this.mode === "clay"
    this.buildLights(clay)
    if (clay) {
      void this.env.set(null, CLAY_ENV_INTENSITY)
      return
    }
    const m = this.sweep?.active ? this.settings.wireframeMode : this.settings.normalMode
    void this.env.set(m?.hdrUrl, m?.hdrIntensity ?? 1)
  }

  private buildLights(auto: boolean): void {
    const setup = this.setup!
    if (this.rig) {
      this.core.scene.remove(this.rig.group)
      this.rig.dispose()
    }
    const saved = this.settings.lights ?? []
    this.rig = new LightRig(saved.length > 0 && !auto ? saved : setup.lights)
    this.rig.fitShadows(new Vector3(...setup.bounds.center), setup.bounds.radius)
    this.rig.setModeMix(this.lightMix)
    this.core.scene.add(this.rig.group)
  }

  private configureSweep(): void {
    const setup = this.setup!
    const wf = this.settings.wireframeMode ?? {}
    const axis = new Vector3(...(wf.sweepAxis ?? setup.sweep.axis))
    if (axis.lengthSq() < 1e-8) axis.set(...setup.sweep.axis)
    axis.normalize()
    const start = wf.sweepStart ?? setup.sweep.start
    const end   = wf.sweepEnd   ?? setup.sweep.end
    const mat = wf.material
    pushSweepUniforms(this.materials, {
      axis,
      min:   start,
      range: Math.max(1e-4, end - start),
      emissiveColor: wf.color ?? VIEWER_DEFAULTS.wireframeModeColor,
      ...(mat ? {
        tintColor:         mat.color,
        metalness:         mat.metalness,
        roughness:         mat.roughness,
        envIntensity:      mat.envMapIntensity,
        specularIntensity: mat.specularIntensity,
      } : {}),
    })
    this.sweep!.setDuration(wf.sweepDurationMs ?? setup.sweep.durationMs)
    this.sweep!.setStyle({
      on:    wf.overlayOn ?? VIEWER_DEFAULTS.wireframeOverlayOn,
      color: wf.overlayColor ?? VIEWER_DEFAULTS.wireframeLineColor,
      width: wf.overlayLineWidth ?? VIEWER_DEFAULTS.wireframeLineWidth,
    })
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

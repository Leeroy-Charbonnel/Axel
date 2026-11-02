import { Color, type Mesh } from "three"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js"
import { pushSweepUniforms, type SweepMaterial } from "./materials"
import { computeEdgesInWorker } from "./wireframeEdges"

//WIREFRAME MODE. Entering: the sweep plane crosses the model (lights blend on
//the same curve), then the edge lines fade in. Leaving: the lines fade out,
//then the sweep runs back. The two never animate together.
//
//The edge geometry is built the first time the lines are needed, in a worker.

const LINE_OPACITY      = 0.9
const OVERLAY_FADE_MS   = 600
const OVERLAY_RENDER_ORDER = 998

interface Tween {
  from:     number
  to:       number
  start:    number
  duration: number
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function tweenValue(tw: Tween, now: number): { value: number; done: boolean } {
  const t = tw.duration > 0 ? Math.min(1, (now - tw.start) / tw.duration) : 1
  return { value: tw.from + (tw.to - tw.from) * ease(t), done: t >= 1 }
}

export interface WireframeHooks {
  materials:     Set<SweepMaterial>
  //every mesh of the model; setExcluded() hides the lines of some
  meshes:        Mesh[]
  //0 normal, 1 wireframe
  setLightMix(t: number): void
  //the sweep has covered the model: switch to the wireframe environment
  onEntered(): void
  //about to sweep back: switch to the normal environment
  onLeaving(): void
  requestRender(): void
}

export interface OverlayStyle {
  on:    boolean
  color: string
  width: number
}

export class WireframeSweep {
  private on = false
  private progress = 0
  private sweep: Tween | null = null
  private fade:  Tween | null = null
  private opacity = 0
  private durationMs = 1500
  private style: OverlayStyle = { on: true, color: "#000000", width: 1 }
  private readonly lineMaterial: LineMaterial
  private overlays: LineSegments2[] | null = null
  //emissive picks glow instead of showing lines
  private excluded = new Set<Mesh>()
  private edges: Promise<void> | null = null
  private disposed = false
  private readonly hooks: WireframeHooks

  constructor(hooks: WireframeHooks) {
    this.hooks = hooks
    this.lineMaterial = new LineMaterial({
      color: new Color(this.style.color).getHex(),
      linewidth: this.style.width,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      worldUnits: false,
    })
  }

  get active(): boolean {
    return this.on
  }

  setDuration(ms: number): void {
    this.durationMs = ms
  }

  setStyle(style: OverlayStyle): void {
    this.style = style
    this.lineMaterial.color.set(style.color)
    this.lineMaterial.linewidth = style.width
    this.syncVisibility()
    //lines switched on while the model already sits in wireframe mode
    if (style.on && this.on && !this.sweep && this.opacity === 0) {
      this.ensureEdges()
      void this.edges!.then(() => {
        if (this.disposed || !this.on || !this.style.on) return
        this.setOpacity(1)
        this.hooks.requestRender()
      })
    }
    this.hooks.requestRender()
  }

  setExcluded(meshes: Set<Mesh>): void {
    this.excluded = meshes
    this.syncVisibility()
    this.hooks.requestRender()
  }

  //pushes the current progress again, to materials created since
  resync(): void {
    this.setProgress(this.progress)
  }

  setResolution(width: number, height: number): void {
    this.lineMaterial.resolution.set(width, height)
  }

  enter(animate: boolean): void {
    if (this.on) return
    this.on = true
    this.fade = null
    if (this.style.on) this.ensureEdges()
    if (animate) {
      this.sweep = { from: this.progress, to: 1, start: performance.now(), duration: this.durationMs * (1 - this.progress) }
    } else {
      this.sweep = null
      this.setProgress(1)
      this.entered(false)
    }
    this.hooks.requestRender()
  }

  leave(animate: boolean): void {
    if (!this.on) return
    this.on = false
    this.hooks.onLeaving()
    if (animate && this.opacity > 0) {
      this.sweep = null
      this.fade = { from: this.opacity, to: 0, start: performance.now(), duration: OVERLAY_FADE_MS * this.opacity }
    } else {
      this.fade = null
      this.setOpacity(0)
      this.startLeaveSweep(animate)
    }
    this.hooks.requestRender()
  }

  //frame callback: true while something is animating
  update(now: number): boolean {
    let busy = false
    if (this.sweep) {
      const { value, done } = tweenValue(this.sweep, now)
      this.setProgress(value)
      busy = true
      if (done) {
        this.sweep = null
        if (this.on) this.entered(true)
      }
    }
    if (this.fade) {
      const { value, done } = tweenValue(this.fade, now)
      this.setOpacity(value)
      busy = true
      if (done) {
        this.fade = null
        if (!this.on) this.startLeaveSweep(true)
      }
    }
    return busy
  }

  private startLeaveSweep(animate: boolean): void {
    if (animate) {
      this.sweep = { from: this.progress, to: 0, start: performance.now(), duration: this.durationMs * this.progress }
    } else {
      this.sweep = null
      this.setProgress(0)
    }
  }

  private entered(animate: boolean): void {
    this.hooks.onEntered()
    if (!this.style.on || !this.edges) return
    this.edges.then(() => {
      if (this.disposed || !this.on || this.sweep) return
      if (animate) this.fade = { from: this.opacity, to: 1, start: performance.now(), duration: OVERLAY_FADE_MS }
      else this.setOpacity(1)
      this.hooks.requestRender()
    })
  }

  private setProgress(v: number): void {
    this.progress = v
    pushSweepUniforms(this.hooks.materials, { progress: v })
    this.hooks.setLightMix(v)
  }

  private setOpacity(v: number): void {
    this.opacity = v
    this.lineMaterial.opacity = LINE_OPACITY * v
    this.syncVisibility()
  }

  private syncVisibility(): void {
    if (!this.overlays) return
    const shown = this.style.on && this.opacity > 0
    for (const o of this.overlays) o.visible = shown && !this.excluded.has(o.parent as Mesh)
  }

  private ensureEdges(): void {
    if (this.edges) return
    const meshes = this.hooks.meshes
    this.edges = computeEdgesInWorker(meshes.map((m) => m.geometry)).then(
      (segments) => {
        if (this.disposed) return
        this.overlays = meshes.map((mesh, i) => {
          const geometry = new LineSegmentsGeometry().setPositions(segments[i]!)
          const line = new LineSegments2(geometry, this.lineMaterial)
          line.renderOrder = OVERLAY_RENDER_ORDER
          line.visible = false
          mesh.add(line)
          return line
        })
        this.syncVisibility()
      },
      (err) => {
        //the model stays usable without its lines; the failure is reported
        console.error("[three] wireframe edges could not be built:", err)
      },
    )
  }

  dispose(): void {
    this.disposed = true
    if (this.overlays) {
      for (const o of this.overlays) {
        o.removeFromParent()
        o.geometry.dispose()
      }
    }
    this.overlays = null
    this.lineMaterial.dispose()
  }
}

import { Color, type LineSegments, type Mesh, Vector3, type WebGLProgramParametersWithUniforms } from "three"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js"
import { pushSweepUniforms, type SweepMaterial, WF_FRONT_GLSL } from "./materials"
import { computeEdgesInWorker } from "./wireframeEdges"

//WIREFRAME MODE. One sweep plane crosses the model: behind it the surface turns
//to the wireframe look and the edge lines appear, together, the lines glowing
//blue along the front (lights blend on the same curve). Leaving runs the same
//sweep back.
//
//The lines are the file's own edges when it carries them (loose edges exported
//from Blender, the exact wireframe); otherwise they are rebuilt from the
//triangles, in a worker, the first time they are needed.

const LINE_OPACITY      = 0.9
const OVERLAY_RENDER_ORDER = 998

//LINE SHADER PATCH - the lines read the same front as the surfaces: a line
//shows once swept, and only the lines glow: bright blue at the front, fading
//over a short trail, none once the sweep has ended
const LINE_VERTEX_COMMON = "#include <common>\nvarying vec3 vWfWorldPos;"
const LINE_VERTEX_POS =
  "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );\n" +
  "vWfWorldPos = (modelMatrix * vec4(position.y < 0.5 ? instanceStart : instanceEnd, 1.0)).xyz;"
const LINE_FRAGMENT_COMMON =
  "#include <common>\nvarying vec3 vWfWorldPos;\n" + WF_FRONT_GLSL +
  "uniform vec3 uWfGlow;\n" +
  "float wfGlow(float d) {\n" +
  "  return exp(-max(d, 0.0) / 0.15) * sin(PI * uWfProgress);\n" +
  "}\n"
const LINE_FRAGMENT_OUT =
  "float wfD = wfFront(vWfWorldPos);\n" +
  "float wfG = clamp(wfGlow(wfD), 0.0, 1.0);\n" +
  "gl_FragColor = vec4( mix(diffuseColor.rgb, uWfGlow * 1.6, wfG), max(alpha, wfG) * step(0.0, wfD) );"

interface Tween {
  from:     number
  to:       number
  start:    number
  duration: number
}

//out, not in-out: the front moves on the click, then settles
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function tweenValue(tw: Tween, now: number): { value: number; done: boolean } {
  const t = tw.duration > 0 ? Math.min(1, (now - tw.start) / tw.duration) : 1
  return { value: tw.from + (tw.to - tw.from) * ease(t), done: t >= 1 }
}

export interface WireframeHooks {
  materials:     Set<SweepMaterial>
  //every mesh of the model; setExcluded() hides the lines of some
  meshes:        Mesh[]
  //the file's own edge lines, hidden; empty when the file has none
  authoredEdges: LineSegments[]
  //0 normal, 1 wireframe
  setLightMix(t: number): void
  //the sweep has covered the model: switch to the wireframe environment
  onEntered(): void
  //about to sweep back: switch to the normal environment
  onLeaving(): void
  //swept back: no line is left on the model
  onLeft(): void
  requestRender(): void
  //the lines' colour along the sweep front
  glowColor: string
}

export interface OverlayStyle {
  on:    boolean
  color: string
  width: number
}

export interface SweepFrame {
  axis:  Vector3
  min:   number
  range: number
}

export class WireframeSweep {
  private on = false
  private progress = 0
  private sweep: Tween | null = null
  private durationMs = 1500
  private style: OverlayStyle = { on: true, color: "#000000", width: 1 }
  private readonly lineMaterial: LineMaterial
  private readonly lineUniforms = {
    uWfProgress: { value: 0 },
    uWfAxis:     { value: new Vector3(1, 0, 0) },
    uWfMin:      { value: 0 },
    uWfRange:    { value: 1 },
    uWfGlow:     { value: new Color() },
  }
  private overlays: LineSegments2[] | null = null
  //emissive picks glow instead of showing lines
  private excluded = new Set<Mesh>()
  private edges: Promise<void> | null = null
  private disposed = false
  private readonly hooks: WireframeHooks

  constructor(hooks: WireframeHooks) {
    this.hooks = hooks
    this.lineUniforms.uWfGlow.value.setStyle(hooks.glowColor)
    this.lineMaterial = new LineMaterial({
      color: new Color(this.style.color).getHex(),
      linewidth: this.style.width,
      transparent: true,
      opacity: LINE_OPACITY,
      depthWrite: false,
      worldUnits: false,
      //smooth edges on the antialiased canvas instead of stair steps
      alphaToCoverage: true,
    })
    this.lineMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, this.lineUniforms)
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", LINE_VERTEX_COMMON)
        .replace("vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );", LINE_VERTEX_POS)
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", LINE_FRAGMENT_COMMON)
        .replace("gl_FragColor = vec4( diffuseColor.rgb, alpha );", LINE_FRAGMENT_OUT)
    }
    this.lineMaterial.customProgramCacheKey = () => "wireframe-sweep-line"
  }

  get active(): boolean {
    return this.on
  }

  setDuration(ms: number): void {
    this.durationMs = ms
  }

  setFrame(frame: SweepFrame): void {
    this.lineUniforms.uWfAxis.value.copy(frame.axis)
    this.lineUniforms.uWfMin.value = frame.min
    this.lineUniforms.uWfRange.value = frame.range
    pushSweepUniforms(this.hooks.materials, frame)
  }

  setStyle(style: OverlayStyle): void {
    this.style = style
    this.lineMaterial.color.set(style.color)
    this.lineMaterial.linewidth = style.width
    //lines switched on while the model already sits in wireframe mode
    if (style.on && this.progress > 0) this.ensureEdges()
    this.syncVisibility()
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
    if (this.style.on) this.ensureEdges()
    this.run(1, animate)
  }

  leave(animate: boolean): void {
    if (!this.on) return
    this.on = false
    this.hooks.onLeaving()
    this.run(0, animate)
  }

  //frame callback: true while something is animating
  update(now: number): boolean {
    if (!this.sweep) return false
    const { value, done } = tweenValue(this.sweep, now)
    this.setProgress(value)
    if (done) {
      this.sweep = null
      if (this.on) this.hooks.onEntered()
      else this.hooks.onLeft()
    }
    return true
  }

  private run(to: number, animate: boolean): void {
    const distance = Math.abs(to - this.progress)
    if (animate && distance > 0) {
      this.sweep = { from: this.progress, to, start: performance.now(), duration: this.durationMs * distance }
    } else {
      this.sweep = null
      this.setProgress(to)
      if (this.on) this.hooks.onEntered()
      else this.hooks.onLeft()
    }
    this.hooks.requestRender()
  }

  private setProgress(v: number): void {
    this.progress = v
    this.lineUniforms.uWfProgress.value = v
    pushSweepUniforms(this.hooks.materials, { progress: v })
    this.hooks.setLightMix(v)
    this.syncVisibility()
  }

  private syncVisibility(): void {
    if (!this.overlays) return
    const shown = this.style.on && this.progress > 0
    for (const o of this.overlays) o.visible = shown && !this.excluded.has(o.parent as Mesh)
  }

  private ensureEdges(): void {
    if (this.edges) return
    if (this.hooks.authoredEdges.length) {
      this.overlays = this.hooks.authoredEdges.map((source) => {
        const flat = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry
        //read through getX: an optimized file stores quantized integers
        const attr = flat.getAttribute("position")
        const positions = new Float32Array(attr.count * 3)
        for (let i = 0; i < attr.count; i++) {
          positions[3 * i] = attr.getX(i)
          positions[3 * i + 1] = attr.getY(i)
          positions[3 * i + 2] = attr.getZ(i)
        }
        const line = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), this.lineMaterial)
        if (flat !== source.geometry) flat.dispose()
        line.position.copy(source.position)
        line.quaternion.copy(source.quaternion)
        line.scale.copy(source.scale)
        line.renderOrder = OVERLAY_RENDER_ORDER
        line.visible = false
        source.parent!.add(line)
        return line
      })
      this.edges = Promise.resolve()
      this.syncVisibility()
      return
    }
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
        this.hooks.requestRender()
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

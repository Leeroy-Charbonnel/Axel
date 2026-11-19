import {
  BackSide, DoubleSide, HalfFloatType, type Material, NeutralToneMapping, PerspectiveCamera, Scene, type Side,
  WebGLRenderer, WebGLRenderTarget,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { CAMERA_FOV } from "./autoSetup"
import { disposeObject, disposeRenderer } from "./dispose"
import { detectQuality, lowerQuality, QUALITY_PROFILES, rememberQuality, type Quality, type QualityProfile } from "./quality"

//RENDERER, SCENE, CAMERA AND CONTROLS, RENDERED ON DEMAND.
//
//Nothing draws unless something asked: a control change, a resize, or a frame
//callback that reports it is still animating. One WebGL context per core.
//Nothing draws at all before warmUp(): the first frame is the heaviest, and
//it is prepared there in steps.
//The quality level (quality.ts) sets the pixel ratio, the shadows and, at the
//top level, ambient occlusion through a post-processing pass, multisampled and
//transparent like the canvas; otherwise the default framebuffer's MSAA. A level
//whose frames come too slowly while something moves drops one step.

//frames measured while busy, and the mean interval above which the level drops
const SLOW_SAMPLE_FRAMES = 40
const SLOW_FRAME_S = 1 / 30
const MSAA_SAMPLES = 4
//ambient occlusion reach, in model radii, and how dark it gets
const AO_RADIUS_SCALE = 0.08
const AO_BLEND = 0.9

//return true while the callback still needs frames (an animation in progress)
export type FrameCallback = (dt: number, now: number) => boolean

//THE LAST PASS on a transparent canvas: the frame holds premultiplied colour
//(blended over a clear background), so tone mapping and the sRGB curve run on
//the straight colour, then the alpha goes back in. Run on the premultiplied
//values, they would brighten every half-transparent pixel (the floor glow).
const READ_FRAME = "gl_FragColor = texture2D( tDiffuse, vUv );"
function premultipliedOutput(): OutputPass {
  const pass = new OutputPass()
  const source = pass.material.fragmentShader
  if (!source.includes(READ_FRAME)) throw new Error("[three] OutputPass shader changed: cannot unpremultiply its input")
  pass.material.fragmentShader = source
    .replace(READ_FRAME, `${READ_FRAME}\ngl_FragColor.rgb /= max( gl_FragColor.a, 0.0001 );`)
    .replace(/\}\s*$/, "gl_FragColor.rgb *= gl_FragColor.a;\n}")
  return pass
}

export interface ViewerCoreOptions {
  //the most the page allows, the quality level may ask for less
  maxPixelRatio: number
  touch:         boolean
}

export interface ViewerCore {
  readonly renderer: WebGLRenderer
  readonly scene:    Scene
  readonly camera:   PerspectiveCamera
  readonly controls: OrbitControls
  readonly quality: QualityProfile
  //the level behind the profile
  readonly level: Quality
  requestRender(): void
  //ambient occlusion only suits the lit render, not the wireframe or clay modes
  setAmbientOcclusionAllowed(allowed: boolean): void
  //the model's radius, for the reach of the ambient occlusion
  setModelRadius(radius: number): void
  //after a drop: the shadows and the textures follow the new level
  onQualityChange(cb: (profile: QualityProfile) => void): void
  addFrameCallback(cb: FrameCallback): () => void
  //after each frame drawn, with the camera as it was drawn
  onRendered(cb: () => void): void
  onResize(cb: (width: number, height: number) => void): void
  //false stops the loop entirely (offscreen, hidden tab)
  setActive(active: boolean): void
  //Starts the scene's shaders compiling off the main thread. Resolves once they
  //can draw. seeThrough: the materials that show the scene behind them.
  //pause() runs between two passes.
  compile(seeThrough: Material[], pause: () => Promise<void>): Promise<void>
  //Draws the first frame in steps, even while inactive: the scene with its
  //shadows, then each post-processing pass. pause() runs between two steps.
  //Frames are drawn on request from then on.
  warmUp(pause: () => Promise<void>): Promise<void>
  //Draws one frame now, outside the loop: a still is taken right after it
  renderNow(): void
  //loseContext: false when the context is already lost and should come back
  dispose(loseContext: boolean): void
}

//Throws when WebGL is unavailable.
export function createViewerCore(canvas: HTMLCanvasElement, opts: ViewerCoreOptions): ViewerCore {
  const host = canvas.parentElement
  if (!host) throw new Error("the canvas has no parent to size it")

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
  renderer.toneMapping         = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled   = true
  renderer.setClearColor(0x000000, 0)
  //the shader check reads each program back at once and stalls the frame: dev only
  renderer.debug.checkShaderErrors = import.meta.env.DEV

  const scene  = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  //QUALITY
  let level: Quality = detectQuality(renderer, opts.touch)
  let profile = QUALITY_PROFILES[level]
  const qualityCallbacks: Array<(p: QualityProfile) => void> = []
  let aoAllowed = true
  let modelRadius = 1
  let composer: EffectComposer | null = null
  let gtao: GTAOPass | null = null
  let slowSum = 0
  let slowCount = 0

  function applyPixelRatio() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio, profile.maxPixelRatio))
  }
  function syncComposer() {
    const want = profile.ambientOcclusion && aoAllowed
    if (want && !composer) {
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: MSAA_SAMPLES })
      composer = new EffectComposer(renderer, target)
      composer.addPass(new RenderPass(scene, camera))
      gtao = new GTAOPass(scene, camera, 1, 1)
      gtao.blendIntensity = AO_BLEND
      gtao.updateGtaoMaterial({ radius: modelRadius * AO_RADIUS_SCALE })
      composer.addPass(gtao)
      composer.addPass(premultipliedOutput())
    } else if (!want && composer) {
      composer.dispose()
      gtao?.dispose()
      composer = null
      gtao = null
    }
  }
  //a level that cannot keep up while something moves gives way to the one below
  function measure(dt: number) {
    if (dt === 0) return
    slowSum += dt
    if (++slowCount < SLOW_SAMPLE_FRAMES) return
    const slow = slowSum / slowCount > SLOW_FRAME_S
    slowSum = 0
    slowCount = 0
    const next = slow ? lowerQuality(level) : null
    if (!next) return
    console.warn(`[three] frames too slow at quality "${level}", dropping to "${next}"`)
    level = next
    rememberQuality(next)
    profile = QUALITY_PROFILES[next]
    applyPixelRatio()
    syncComposer()
    resize()
    for (const cb of qualityCallbacks) cb(profile)
  }
  applyPixelRatio()

  const frameCallbacks = new Set<FrameCallback>()
  const renderedCallbacks: Array<() => void> = []
  const resizeCallbacks: Array<(w: number, h: number) => void> = []
  let rafId: number | null = null
  let active = true
  let warm = false
  let disposed = false
  let last = 0

  function schedule() {
    if (rafId === null && active && warm && !disposed) rafId = requestAnimationFrame(tick)
  }

  function draw(dt: number) {
    if (composer) composer.render(dt)
    else renderer.render(scene, camera)
  }

  function tick(now: number) {
    rafId = null
    //clamped so a resume after a pause does not jump animations forward
    const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    let busy = false
    for (const cb of frameCallbacks) busy = cb(dt, now) || busy
    //true while damping is still settling
    if (controls.enabled && controls.update()) busy = true
    draw(dt)
    for (const cb of renderedCallbacks) cb()
    if (busy) {
      measure(dt)
      schedule()
    }
    else last = 0
  }

  controls.addEventListener("change", schedule)

  function resize() {
    const w = host!.clientWidth
    const h = host!.clientHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    composer?.setPixelRatio(renderer.getPixelRatio())
    composer?.setSize(w, h)
    for (const cb of resizeCallbacks) cb(w, h)
    schedule()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  syncComposer()
  resize()

  return {
    renderer, scene, camera, controls,
    get quality() { return profile },
    get level() { return level },
    requestRender: schedule,
    setAmbientOcclusionAllowed(allowed) {
      aoAllowed = allowed
      syncComposer()
      resize()
    },
    setModelRadius(radius) {
      modelRadius = radius
      gtao?.updateGtaoMaterial({ radius: radius * AO_RADIUS_SCALE })
    },
    onQualityChange(cb) {
      qualityCallbacks.push(cb)
    },
    addFrameCallback(cb) {
      frameCallbacks.add(cb)
      schedule()
      return () => frameCallbacks.delete(cb)
    },
    onRendered(cb) {
      renderedCallbacks.push(cb)
    },
    onResize(cb) {
      resizeCallbacks.push(cb)
    },
    async compile(seeThrough, pause) {
      //A program is built for what it draws into: the canvas, or a buffer. The
      //composer draws into buffers only; a see-through material reads the
      //opaque parts from a buffer three fills first, with the back faces of
      //the two-sided see-through materials. One pass each, a task each: a pass
      //writes the source of every shader it needs.
      const twoSided = seeThrough.filter((m) => m.side === DoubleSide)
      const intoBuffer = composer !== null || seeThrough.length > 0
      const passes: Array<{ buffer: boolean; side: Side }> = []
      if (!composer) passes.push({ buffer: false, side: DoubleSide })
      if (intoBuffer) passes.push({ buffer: true, side: DoubleSide })
      if (intoBuffer && twoSided.length > 0) passes.push({ buffer: true, side: BackSide })
      const buffer = new WebGLRenderTarget(1, 1)
      const jobs: Promise<unknown>[] = []
      for (const [i, pass] of passes.entries()) {
        if (i > 0) await pause()
        for (const m of twoSided) {
          if (m.side === pass.side) continue
          m.side = pass.side
          m.needsUpdate = true
        }
        renderer.setRenderTarget(pass.buffer ? buffer : null)
        jobs.push(renderer.compileAsync(scene, camera))
        renderer.setRenderTarget(null)
      }
      for (const m of twoSided) {
        if (m.side === DoubleSide) continue
        m.side = DoubleSide
        m.needsUpdate = true
      }
      buffer.dispose()
      await Promise.all(jobs)
    },
    async warmUp(pause) {
      const staged = composer
      const later = staged ? staged.passes.slice(1) : []
      for (const pass of later) pass.enabled = false
      //the scene pass alone would draw on the canvas, with other programs
      if (staged) staged.renderToScreen = false
      //the scene with its shadows: a shader that reads a shadow map needs one
      draw(0)
      for (const pass of later) {
        await pause()
        if (disposed) return
        pass.enabled = true
        if (pass === later[later.length - 1]) staged!.renderToScreen = true
        draw(0)
      }
      warm = true
      schedule()
    },
    renderNow() {
      draw(0)
    },
    setActive(value) {
      active = value
      if (value) schedule()
      else if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
        last = 0
      }
    },
    dispose(loseContext) {
      disposed = true
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      frameCallbacks.clear()
      composer?.dispose()
      gtao?.dispose()
      controls.dispose()
      disposeObject(scene)
      disposeRenderer(renderer, loseContext)
    },
  }
}

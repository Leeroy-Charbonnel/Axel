import { NeutralToneMapping, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { CAMERA_FOV } from "./autoSetup"
import { disposeObject, disposeRenderer } from "./dispose"

//RENDERER, SCENE, CAMERA AND CONTROLS, RENDERED ON DEMAND.
//
//Nothing draws unless something asked: a control change, a resize, or a frame
//callback that reports it is still animating. One WebGL context per core,
//antialiased by the default framebuffer's MSAA (no post-processing pass).

//return true while the callback still needs frames (an animation in progress)
export type FrameCallback = (dt: number, now: number) => boolean

export interface ViewerCoreOptions {
  maxPixelRatio: number
}

export interface ViewerCore {
  readonly renderer: WebGLRenderer
  readonly scene:    Scene
  readonly camera:   PerspectiveCamera
  readonly controls: OrbitControls
  requestRender(): void
  addFrameCallback(cb: FrameCallback): () => void
  onResize(cb: (width: number, height: number) => void): void
  //false stops the loop entirely (offscreen, hidden tab)
  setActive(active: boolean): void
  //loseContext: false when the context is already lost and should come back
  dispose(loseContext: boolean): void
}

//Throws when WebGL is unavailable.
export function createViewerCore(canvas: HTMLCanvasElement, opts: ViewerCoreOptions): ViewerCore {
  const host = canvas.parentElement
  if (!host) throw new Error("the canvas has no parent to size it")

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio))
  renderer.toneMapping         = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled   = true
  renderer.shadowMap.type      = PCFShadowMap
  renderer.setClearColor(0x000000, 0)

  const scene  = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  const frameCallbacks = new Set<FrameCallback>()
  const resizeCallbacks: Array<(w: number, h: number) => void> = []
  let rafId: number | null = null
  let active = true
  let disposed = false
  let last = 0

  function schedule() {
    if (rafId === null && active && !disposed) rafId = requestAnimationFrame(tick)
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
    renderer.render(scene, camera)
    if (busy) schedule()
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
    for (const cb of resizeCallbacks) cb(w, h)
    schedule()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  return {
    renderer, scene, camera, controls,
    requestRender: schedule,
    addFrameCallback(cb) {
      frameCallbacks.add(cb)
      schedule()
      return () => frameCallbacks.delete(cb)
    },
    onResize(cb) {
      resizeCallbacks.push(cb)
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
      controls.dispose()
      disposeObject(scene)
      disposeRenderer(renderer, loseContext)
    },
  }
}

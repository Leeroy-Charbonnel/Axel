import { describe, expect, mock, test } from "bun:test"
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector2, Vector3 } from "three"

//no WebGL here: the core, the environment and the loader are stand-ins, the
//rest of the viewer is the real code. The compile stays pending until the
//test settles it, the way a driver compiling in parallel keeps it pending.
let finishCompile: () => void = () => {}
let coreDisposed = 0
mock.module("../../src/three/core", () => ({
  createViewerCore: () => ({
    renderer: {
      compileAsync: () => new Promise<void>((resolve) => { finishCompile = resolve }),
      getSize:      (v: Vector2) => v.set(800, 600),
      capabilities: { getMaxAnisotropy: () => 1 },
    },
    scene:    new Scene(),
    camera:   new PerspectiveCamera(),
    controls: { addEventListener: () => {}, target: new Vector3(), update: () => {} },
    requestRender:    () => {},
    addFrameCallback: () => () => {},
    onResize:         () => {},
    onQualityChange:  () => {},
    onRendered:       () => {},
    quality:          { maxPixelRatio: 1, shadowMapSize: 1024, softShadows: false, ambientOcclusion: false, anisotropy: 1 },
    setModelRadius:   () => {},
    setAmbientOcclusionAllowed: () => {},
    setActive:        () => {},
    dispose:          () => { coreDisposed++ },
  }),
}))
mock.module("../../src/three/environment", () => ({
  EnvironmentManager: class {
    set() { return Promise.resolve() }
    dispose() {}
  },
}))
mock.module("../../src/three/loaders", () => ({
  loadGltf: async () => {
    const scene = new Group()
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()))
    return { scene, animations: [], parser: { associations: new Map() } }
  },
}))

const { ModelViewer } = await import("../../src/three/modelViewer")

describe("ModelViewer dispose during the shader compile", () => {
  test("the renderer is released only once the compile has settled", async () => {
    const viewer = new ModelViewer({ canvas: {} as HTMLCanvasElement, maxPixelRatio: 1, reducedMotion: true, glowColor: "#00ffff" } as ConstructorParameters<typeof ModelViewer>[0])
    const loading = viewer.load("/media/models/x.glb", {} as Parameters<typeof viewer.load>[1], () => {})
    //let load() run up to the pending compile
    for (let i = 0; i < 20; i++) await Promise.resolve()
    viewer.dispose(true)
    expect(coreDisposed).toBe(0)
    finishCompile()
    await loading
    await Promise.resolve()
    expect(coreDisposed).toBe(1)
  })
})

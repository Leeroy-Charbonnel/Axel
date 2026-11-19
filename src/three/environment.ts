import {
  CubeUVReflectionMapping, DataTexture, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, PerspectiveCamera,
  PMREMGenerator, RGBAFormat, type Scene, type Texture, type WebGLRenderer, WebGLRenderTarget,
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js"
import { nextStep } from "./loadQueue"

//DECODED HDR / EXR SOURCES, SHARED BY EVERY VIEWER ON THE PAGE. A WebGL texture
//cannot cross contexts, but the decoded pixels can: each viewer uploads the same
//texture to its own renderer, prefilters it with its own PMREM, then disposes its
//upload. The CPU copy stays here for the page lifetime, so a viewer that loads
//later skips the download and the decode (a site uses two or three maps).
const sources = new Map<string, Promise<Texture>>()

//The EXR loader is fetched only for an .exr file
async function decodeEquirect(url: string): Promise<Texture> {
  if (!/\.exr$/i.test(url)) return new HDRLoader().loadAsync(url)
  const { EXRLoader } = await import("three/examples/jsm/loaders/EXRLoader.js")
  return new EXRLoader().loadAsync(url)
}

//1 as a 16-bit float
const HALF_ONE = 0x3c00

//Some files carry an alpha channel below 1: drawn behind the model, the map
//would let the page show through it.
function makeOpaque(tex: Texture): void {
  if (tex.format !== RGBAFormat) return
  const data = (tex.image as { data: Uint16Array | Float32Array }).data
  const one = data instanceof Uint16Array ? HALF_ONE : 1
  for (let i = 3; i < data.length; i += 4) data[i] = one
}

export function loadEquirect(url: string): Promise<Texture> {
  let pending = sources.get(url)
  if (!pending) {
    pending = decodeEquirect(url).then((tex) => {
      tex.mapping = EquirectangularReflectionMapping
      makeOpaque(tex)
      return tex
    })
    //a failed load is not cached: the next viewer tries again
    pending.catch(() => sources.delete(url))
    sources.set(url, pending)
  }
  return pending
}

export interface EnvironmentSpec {
  url:        string | null | undefined
  intensity:  number
  //degrees around the vertical axis
  rotation:   number
  //the map drawn behind the model; the studio is never drawn
  background: boolean
}

const DEG = Math.PI / 180
const STUDIO_KEY = "studio"
const STUDIO_BLUR = 0.04

//THE STUDIO PROBE, SHARED TOO. Prefiltering it costs each viewer the same
//shader compiles and draws: the first viewer does it once and reads the pixels
//back, every other viewer uploads them.
let studioPixels: { data: Uint16Array; width: number; height: number } | null = null

//a prefiltered map on one renderer
interface Probe {
  texture: Texture
  dispose(): void
}

//Per renderer: one PMREM generator and one prefiltered probe per map, so a mode
//switch between two maps rebinds a probe instead of reprocessing it.
export class EnvironmentManager {
  private readonly pmrem: PMREMGenerator
  private readonly probes = new Map<string, Promise<Probe>>()
  private readonly scene: Scene
  private readonly renderer: WebGLRenderer
  private readonly onChange: () => void
  private seq = 0
  private disposed = false
  //a shader compile in progress: the renderer must outlive it
  compiling: Promise<unknown> | null = null

  constructor(scene: Scene, renderer: WebGLRenderer, onChange: () => void) {
    this.scene = scene
    this.renderer = renderer
    this.onChange = onChange
    this.pmrem = new PMREMGenerator(renderer)
  }

  //No url = the procedural studio. A map that fails to load is logged and
  //replaced by the studio so the model is still lit.
  async set(spec: EnvironmentSpec): Promise<void> {
    const token = ++this.seq
    const url = spec.url || null
    let probe: Probe
    let backdrop: Texture | null = null
    try {
      probe = await this.probe(url)
      if (url && spec.background) backdrop = await loadEquirect(url)
    } catch (err) {
      if (this.disposed) return
      console.error(`[three] environment map ${url} failed to load, using the studio light instead:`, err)
      probe = await this.probe(null)
    }
    if (this.disposed || token !== this.seq) return
    const turn = spec.rotation * DEG
    this.scene.environment = probe.texture
    this.scene.environmentIntensity = spec.intensity
    this.scene.environmentRotation.set(0, turn, 0)
    this.scene.background = backdrop
    this.scene.backgroundIntensity = spec.intensity
    this.scene.backgroundRotation.set(0, turn, 0)
    this.onChange()
  }

  private probe(url: string | null): Promise<Probe> {
    const key = url ?? STUDIO_KEY
    let pending = this.probes.get(key)
    if (!pending) {
      pending = url ? this.fromUrl(url) : this.studio()
      pending.catch(() => this.probes.delete(key))
      this.probes.set(key, pending)
    }
    return pending
  }

  private async fromUrl(url: string): Promise<Probe> {
    const source = await loadEquirect(url)
    if (this.disposed) throw new Error("viewer disposed")
    const target = this.pmrem.fromEquirectangular(source)
    //frees this renderer's upload only; the decoded pixels stay shared
    source.dispose()
    return target
  }

  private async studio(): Promise<Probe> {
    if (!studioPixels) {
      const room = new RoomEnvironment()
      //the room's shaders compile off the main thread, for the buffer the probe is drawn into
      const buffer = new WebGLRenderTarget(1, 1)
      this.renderer.setRenderTarget(buffer)
      this.compiling = this.renderer.compileAsync(room, new PerspectiveCamera())
      this.renderer.setRenderTarget(null)
      buffer.dispose()
      try {
        await this.compiling
      } finally {
        this.compiling = null
      }
      //its own task: the heaviest step of the first viewer
      await nextStep()
      if (this.disposed) {
        room.dispose()
        throw new Error("viewer disposed")
      }
      const target = this.pmrem.fromScene(room, STUDIO_BLUR)
      room.dispose()
      //a GPU that cannot read the probe back keeps it for itself
      if (!this.renderer.capabilities.textureTypeReadable(HalfFloatType)) return target
      //reading waits for the GPU to finish drawing: one more task
      await nextStep()
      if (this.disposed) throw new Error("viewer disposed")
      const { width, height } = target
      const data = new Uint16Array(width * height * 4)
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, data)
      target.dispose()
      studioPixels = { data, width, height }
    }
    const texture = new DataTexture(studioPixels.data, studioPixels.width, studioPixels.height, RGBAFormat, HalfFloatType)
    texture.mapping = CubeUVReflectionMapping
    texture.magFilter = LinearFilter
    texture.minFilter = LinearFilter
    texture.needsUpdate = true
    return { texture, dispose: () => texture.dispose() }
  }

  dispose(): void {
    this.disposed = true
    this.scene.environment = null
    this.scene.background = null
    //a probe that failed was logged by set()
    for (const pending of this.probes.values()) pending.then((p) => p.dispose(), () => undefined)
    this.probes.clear()
    this.pmrem.dispose()
  }
}

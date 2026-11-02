import { EquirectangularReflectionMapping, PMREMGenerator, type Scene, type Texture, type WebGLRenderTarget, type WebGLRenderer } from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js"
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js"

//DECODED HDR / EXR SOURCES, SHARED BY EVERY VIEWER ON THE PAGE. A WebGL texture
//cannot cross contexts, but the decoded pixels can: each viewer uploads the same
//texture to its own renderer, prefilters it with its own PMREM, then disposes its
//upload. The CPU copy stays here for the page lifetime, so a viewer that loads
//later skips the download and the decode (a site uses two or three maps).
const sources = new Map<string, Promise<Texture>>()

export function loadEquirect(url: string): Promise<Texture> {
  let pending = sources.get(url)
  if (!pending) {
    const loader = /\.exr$/i.test(url) ? new EXRLoader() : new HDRLoader()
    pending = loader.loadAsync(url).then((tex) => {
      tex.mapping = EquirectangularReflectionMapping
      return tex
    })
    //a failed load is not cached: the next viewer tries again
    pending.catch(() => sources.delete(url))
    sources.set(url, pending)
  }
  return pending
}

const STUDIO_KEY = "studio"
const STUDIO_BLUR = 0.04

//Per renderer: one PMREM generator and one prefiltered probe per map, so a mode
//switch between two maps rebinds a probe instead of reprocessing it.
export class EnvironmentManager {
  private readonly pmrem: PMREMGenerator
  private readonly probes = new Map<string, Promise<WebGLRenderTarget>>()
  private readonly scene: Scene
  private readonly onChange: () => void
  private seq = 0
  private disposed = false

  constructor(scene: Scene, renderer: WebGLRenderer, onChange: () => void) {
    this.scene = scene
    this.onChange = onChange
    this.pmrem = new PMREMGenerator(renderer)
  }

  //url null or empty = the procedural studio. A map that fails to load is
  //logged and replaced by the studio so the model is still lit.
  async set(url: string | null | undefined, intensity: number): Promise<void> {
    const token = ++this.seq
    let target: WebGLRenderTarget
    try {
      target = await this.probe(url || null)
    } catch (err) {
      if (this.disposed) return
      console.error(`[three] environment map ${url} failed to load, using the studio light instead:`, err)
      target = await this.probe(null)
    }
    if (this.disposed || token !== this.seq) return
    this.scene.environment = target.texture
    this.scene.environmentIntensity = intensity
    this.onChange()
  }

  private probe(url: string | null): Promise<WebGLRenderTarget> {
    const key = url ?? STUDIO_KEY
    let pending = this.probes.get(key)
    if (!pending) {
      pending = url ? this.fromUrl(url) : Promise.resolve(this.studio())
      pending.catch(() => this.probes.delete(key))
      this.probes.set(key, pending)
    }
    return pending
  }

  private async fromUrl(url: string): Promise<WebGLRenderTarget> {
    const source = await loadEquirect(url)
    if (this.disposed) throw new Error("viewer disposed")
    const target = this.pmrem.fromEquirectangular(source)
    //frees this renderer's upload only; the decoded pixels stay shared
    source.dispose()
    return target
  }

  private studio(): WebGLRenderTarget {
    const room = new RoomEnvironment()
    const target = this.pmrem.fromScene(room, STUDIO_BLUR)
    room.dispose()
    return target
  }

  dispose(): void {
    this.disposed = true
    this.scene.environment = null
    //a probe that failed was logged by set()
    for (const pending of this.probes.values()) pending.then((t) => t.dispose(), () => undefined)
    this.probes.clear()
    this.pmrem.dispose()
  }
}

import type { WebGLRenderer } from "three"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"

//Decoders are served from public/vendor, copied from three/examples/jsm/libs.
//Each is fetched only when a model actually uses its extension.
const VENDOR = `${import.meta.env.BASE_URL}vendor/`

//one decoder worker pool per page, shared by every viewer
let draco: DRACOLoader | null = null
let ktx2:  KTX2Loader  | null = null

export function createGltfLoader(renderer: WebGLRenderer): GLTFLoader {
  draco ??= new DRACOLoader().setDecoderPath(`${VENDOR}draco/`)
  //supported GPU formats are a property of the device, the same for every context
  ktx2  ??= new KTX2Loader().setTranscoderPath(`${VENDOR}basis/`).detectSupport(renderer)
  return new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
}

//total is null when the server sends no Content-Length (a compressed response)
export type ProgressFn = (loaded: number, total: number | null) => void

export async function fetchArrayBuffer(url: string, signal: AbortSignal, onProgress: ProgressFn): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`)
  if (!res.body) throw new Error(`empty response body for ${url}`)
  const header = res.headers.get("content-length")
  const encoded = res.headers.get("content-encoding")
  const total = header && !encoded ? Number(header) : null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out.buffer
}

export async function loadGltf(url: string, renderer: WebGLRenderer, signal: AbortSignal, onProgress: ProgressFn): Promise<GLTF> {
  const buffer = await fetchArrayBuffer(url, signal, onProgress)
  const base = url.slice(0, url.lastIndexOf("/") + 1)
  return createGltfLoader(renderer).parseAsync(buffer, base)
}

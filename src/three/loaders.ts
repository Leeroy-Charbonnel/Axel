import type { WebGLRenderer } from "three"
import type { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"

//Decoders are served from public/vendor, copied from three/examples/jsm/libs.
//The Draco and KTX2 loaders, code and decoder, are fetched only for a model
//that names their extension: an optimized model (meshopt + WebP) needs neither.
const VENDOR = `${import.meta.env.BASE_URL}vendor/`
const DRACO_EXTENSION = "KHR_draco_mesh_compression"
const KTX2_EXTENSION = "KHR_texture_basisu"

//one decoder worker pool per page, shared by every viewer
let draco: Promise<DRACOLoader> | null = null
let ktx2:  Promise<KTX2Loader>  | null = null

function dracoLoader(): Promise<DRACOLoader> {
  draco ??= import("three/examples/jsm/loaders/DRACOLoader.js")
    .then((m) => new m.DRACOLoader().setDecoderPath(`${VENDOR}draco/`))
  return draco
}

function ktx2Loader(renderer: WebGLRenderer): Promise<KTX2Loader> {
  //supported GPU formats are a property of the device, the same for every context
  ktx2 ??= import("three/examples/jsm/loaders/KTX2Loader.js")
    .then((m) => new m.KTX2Loader().setTranscoderPath(`${VENDOR}basis/`).detectSupport(renderer))
  return ktx2
}

const GLB_MAGIC = 0x46546c67
const GLB_JSON_CHUNK = 0x4e4f534a
const GLB_HEADER_BYTES = 12
const GLB_CHUNK_HEADER_BYTES = 8

//The extensions a model names, read from the JSON of a .glb or a .gltf
export function extensionsUsed(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer)
  let json = new Uint8Array(buffer)
  if (buffer.byteLength >= GLB_HEADER_BYTES && view.getUint32(0, true) === GLB_MAGIC) {
    if (buffer.byteLength < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES || view.getUint32(GLB_HEADER_BYTES + 4, true) !== GLB_JSON_CHUNK) {
      throw new Error("[gltf] the .glb does not start with a JSON chunk")
    }
    json = new Uint8Array(buffer, GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES, view.getUint32(GLB_HEADER_BYTES, true))
  }
  const parsed = JSON.parse(new TextDecoder().decode(json)) as { extensionsUsed?: string[] }
  return parsed.extensionsUsed ?? []
}

async function gltfLoaderFor(buffer: ArrayBuffer, renderer: WebGLRenderer): Promise<GLTFLoader> {
  const used = extensionsUsed(buffer)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  if (used.includes(DRACO_EXTENSION)) loader.setDRACOLoader(await dracoLoader())
  if (used.includes(KTX2_EXTENSION)) loader.setKTX2Loader(await ktx2Loader(renderer))
  return loader
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
  return (await gltfLoaderFor(buffer, renderer)).parseAsync(buffer, base)
}

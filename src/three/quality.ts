import type { WebGLRenderer } from "three"

//RENDER QUALITY BY DEVICE. A first guess from what the browser tells about
//the machine (the GPU's name, cores, memory, touch), then the frame rate has
//the last word: a viewer that cannot keep up drops one level (core.ts).
//- high:   ambient occlusion, 2048 shadows, full pixel ratio
//- medium: 2048 shadows, pixel ratio 1.5
//- low:    1024 shadows, pixel ratio 1
//Every level filters its shadows the same way (three's default, PCF).

export type Quality = "low" | "medium" | "high"

export interface QualityProfile {
  maxPixelRatio:    number
  shadowMapSize:    number
  ambientOcclusion: boolean
  //texture filtering at grazing angles, capped by the GPU
  anisotropy:       number
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  high:   { maxPixelRatio: 2,   shadowMapSize: 2048, ambientOcclusion: true,  anisotropy: 16 },
  medium: { maxPixelRatio: 1.5, shadowMapSize: 2048, ambientOcclusion: false, anisotropy: 8 },
  low:    { maxPixelRatio: 1,   shadowMapSize: 1024, ambientOcclusion: false, anisotropy: 4 },
}

const ORDER: Quality[] = ["low", "medium", "high"]

//dedicated desktop GPUs and Apple silicon
const STRONG_GPU = /\b(rtx|gtx\s?1[0-9]{3}|rx\s?[5-9][0-9]{3}|radeon pro|arc a[0-9]|apple m[0-9])/i
//software renderers, phone GPUs and old integrated chips
const WEAK_GPU = /(swiftshader|llvmpipe|software|mali|adreno|powervr|intel\(r\) hd graphics|intel hd graphics)/i
const LOW_MEMORY_GB = 4
const LOW_CORES = 4

//The lowest level a viewer of this visit dropped to: the next viewers start no higher
let ceiling: Quality = "high"

export function rememberQuality(q: Quality): void {
  if (ORDER.indexOf(q) < ORDER.indexOf(ceiling)) ceiling = q
}

export function detectQuality(renderer: WebGLRenderer, touch: boolean): Quality {
  const guess = guessQuality(renderer, touch)
  return ORDER.indexOf(guess) < ORDER.indexOf(ceiling) ? guess : ceiling
}

function guessQuality(renderer: WebGLRenderer, touch: boolean): Quality {
  const gl = renderer.getContext()
  const info = gl.getExtension("WEBGL_debug_renderer_info")
  const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ""
  //not in every browser: absent means unknown, not weak
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency
  if (WEAK_GPU.test(gpu) || (memory !== undefined && memory < LOW_MEMORY_GB) || (cores !== undefined && cores < LOW_CORES)) return "low"
  //a phone or a tablet never gets the heaviest level, whatever its chip
  if (touch) return "medium"
  return STRONG_GPU.test(gpu) ? "high" : "medium"
}

//one level down, or null at the bottom
export function lowerQuality(q: Quality): Quality | null {
  const i = ORDER.indexOf(q)
  return i > 0 ? ORDER[i - 1]! : null
}

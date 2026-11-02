import {
  Color,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three"
import { VIEWER_DEFAULTS } from "../lib/viewer-defaults"
import type { MaterialState } from "./types"

//WIREFRAME SWEEP MATERIALS. Each mesh renders with a copy of its source
//material plus a shader patch driven by uWfProgress (0..1):
//  - normal kind:   a plane moving along uWfAxis tints every fragment it has
//                   passed toward the wireframe look (tint, roughness,
//                   metalness, env and specular overrides)
//  - emissive kind: the whole mesh fades to a flat emission colour, no plane
//At progress 0 both render exactly like the source material.
//
//The copy keeps every map and feature of the source (vertex colours, alpha
//map, clearcoat, transmission, sheen, light map, bump, displacement...): a lit
//source becomes a MeshPhysicalMaterial copied field by field by three's own
//copy(), an unlit source (KHR_materials_unlit) stays a MeshBasicMaterial.
//
//Uniforms are per material, never shared at module level: two viewers on a
//page must not see each other's sweep.

interface SweepUniformSet {
  uWfProgress:      { value: number }
  uWfTint:          { value: Color }
  uWfAxis:          { value: Vector3 }
  uWfMin:           { value: number }
  uWfRange:         { value: number }
  uWfMetalness:     { value: number }
  uWfRoughness:     { value: number }
  uWfEnvScale:      { value: number }
  uWfSpecScale:     { value: number }
  uWfEmissive:      { value: Color }
  uWfEmissiveBoost: { value: number }
}

function freshUniformSet(boost: number): SweepUniformSet {
  const wf = VIEWER_DEFAULTS.wireframeMaterial
  return {
    uWfProgress:      { value: 0 },
    uWfTint:          { value: new Color(wf.color) },
    uWfAxis:          { value: new Vector3(1, 0, 0) },
    uWfMin:           { value: 0 },
    uWfRange:         { value: 1 },
    uWfMetalness:     { value: wf.metalness },
    uWfRoughness:     { value: wf.roughness },
    uWfEnvScale:      { value: wf.envMapIntensity },
    uWfSpecScale:     { value: wf.specularIntensity },
    uWfEmissive:      { value: new Color(VIEWER_DEFAULTS.wireframeModeColor) },
    uWfEmissiveBoost: { value: boost },
  }
}

//SHADER PATCHES

//THE SWEEP FRONT, shared with the wireframe lines (wireframe.ts). wfFront() is
//how far a world position sits behind the front, in sweep units: 0 or more
//means swept. The position is clamped, so a fragment before sweepStart or past
//sweepEnd belongs to the first or last slice: nothing is swept at progress 0
//and everything is at 1.
export const WF_FRONT_GLSL =
  "uniform float uWfProgress;\nuniform vec3 uWfAxis;\nuniform float uWfMin;\nuniform float uWfRange;\n" +
  "float wfFront(vec3 worldPos) {\n" +
  "  float t = clamp((dot(worldPos, uWfAxis) - uWfMin) / max(uWfRange, 0.0001), 0.0, 1.0);\n" +
  "  return uWfProgress * 1.04 - 0.02 - t;\n" +
  "}\n"

const VERTEX_COMMON = "#include <common>\nvarying vec3 vWfWorldPos;"
const VERTEX_POS    = "#include <project_vertex>\nvWfWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"

const FRAGMENT_COMMON =
  "#include <common>\n" +
  "varying vec3 vWfWorldPos;\n" +
  WF_FRONT_GLSL +
  "uniform vec3 uWfTint;\n" +
  "uniform float uWfMetalness;\nuniform float uWfRoughness;\n" +
  "uniform float uWfEnvScale;\nuniform float uWfSpecScale;\n" +
  "uniform vec3 uWfEmissive;\nuniform float uWfEmissiveBoost;\n"

//step() keeps the front a hard line
const FRAGMENT_MASK =
  "#include <map_fragment>\n" +
  "float wfD = wfFront(vWfWorldPos);\n" +
  "float wfMask = step(0.0, wfD);\n" +
  "diffuseColor.rgb = mix(diffuseColor.rgb, uWfTint, wfMask);\n"


const FRAGMENT_ROUGHNESS =
  "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uWfRoughness, wfMask);\n"

const FRAGMENT_METALNESS =
  "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uWfMetalness, wfMask);\n"

//dielectric F0 is 0.04 at ior 1.5; uWfSpecScale scales it like
//MeshPhysicalMaterial.specularIntensity does
const FRAGMENT_SPECULAR =
  "#include <lights_physical_fragment>\n" +
  "material.specularColor = mix(material.specularColor, vec3(0.04 * uWfSpecScale), wfMask);\n" +
  "material.specularColorBlended = mix(material.specularColor, diffuseColor.rgb, metalnessFactor);\n" +
  "material.specularF90 = mix(material.specularF90, mix(uWfSpecScale, 1.0, metalnessFactor), wfMask);\n"

//scene.environment drives envMapIntensity, so the wireframe env strength is
//uWfEnvScale in absolute terms
const FRAGMENT_ENV =
  "#include <lights_fragment_maps>\n" +
  "#ifdef USE_ENVMAP\n" +
  "float wfEnvK = mix(1.0, uWfEnvScale / max(envMapIntensity, 0.0001), wfMask);\n" +
  "iblIrradiance *= wfEnvK;\n" +
  "radiance      *= wfEnvK;\n" +
  "#endif\n"

const FRAGMENT_EMISSIVE_ALPHA = "diffuseColor.a = 1.0;\n#include <alphatest_fragment>"
const FRAGMENT_EMISSIVE_OUT =
  "outgoingLight = mix(outgoingLight, uWfEmissive * uWfEmissiveBoost, uWfProgress);\n" +
  "diffuseColor.a = 1.0;\n" +
  "#include <opaque_fragment>"

type SweepKind = "normal" | "emissive"

function patchShader(shader: WebGLProgramParametersWithUniforms, uniforms: SweepUniformSet, kind: SweepKind, lit: boolean): void {
  Object.assign(shader.uniforms, uniforms)
  let frag = shader.fragmentShader.replace("#include <common>", FRAGMENT_COMMON)
  if (kind === "emissive") {
    frag = frag
      .replace("#include <alphatest_fragment>", FRAGMENT_EMISSIVE_ALPHA)
      .replace("#include <opaque_fragment>", FRAGMENT_EMISSIVE_OUT)
  } else {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", VERTEX_COMMON)
      .replace("#include <project_vertex>", VERTEX_POS)
    frag = frag
      .replace("#include <map_fragment>", FRAGMENT_MASK)
    if (lit) {
      frag = frag
        .replace("#include <roughnessmap_fragment>", FRAGMENT_ROUGHNESS)
        .replace("#include <metalnessmap_fragment>", FRAGMENT_METALNESS)
        .replace("#include <lights_physical_fragment>", FRAGMENT_SPECULAR)
        .replace("#include <lights_fragment_maps>", FRAGMENT_ENV)
    }
  }
  shader.fragmentShader = frag
}

//an emissive pick renders as solid flat emission: nothing may discard or blend it
function forceOpaque(m: MeshPhysicalMaterial | MeshBasicMaterial): void {
  m.transparent = false
  m.opacity     = 1
  m.alphaTest   = 0
  m.alphaMap    = null
  m.alphaHash   = false
  m.depthWrite  = true
  m.depthTest   = true
  if (m instanceof MeshPhysicalMaterial) m.transmission = 0
}

function copyLitSource(target: MeshPhysicalMaterial, source: MeshStandardMaterial): void {
  if ((source as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    MeshPhysicalMaterial.prototype.copy.call(target, source as MeshPhysicalMaterial)
    return
  }
  //a standard source: physical extras keep their defaults (ior 1.5, specular
  //1), which render exactly like MeshStandardMaterial
  MeshStandardMaterial.prototype.copy.call(target, source)
  target.defines = { STANDARD: "", PHYSICAL: "" }
}

export class CustomNormalMaterial extends MeshPhysicalMaterial {
  //allocated here, not at compile time, so a push before the first render lands
  readonly _sweepUniforms: SweepUniformSet

  constructor(source?: MeshStandardMaterial) {
    super()
    if (source) copyLitSource(this, source)
    this._sweepUniforms = freshUniformSet(1)
    this.onBeforeCompile = (shader) => patchShader(shader, this._sweepUniforms, "normal", true)
  }

  customProgramCacheKey(): string {
    return "sweep-normal"
  }
}

export class CustomEmissiveMaterial extends MeshPhysicalMaterial {
  readonly _sweepUniforms: SweepUniformSet

  constructor(source?: MeshStandardMaterial, emissiveBoost = 1) {
    super()
    if (source) copyLitSource(this, source)
    forceOpaque(this)
    this._sweepUniforms = freshUniformSet(emissiveBoost)
    this.onBeforeCompile = (shader) => patchShader(shader, this._sweepUniforms, "emissive", true)
  }

  customProgramCacheKey(): string {
    return "sweep-emissive"
  }

  setEmissiveBoost(v: number): void {
    this._sweepUniforms.uWfEmissiveBoost.value = v
  }
}

//Unlit source: the sweep tints the flat colour, no lighting overrides.
export class SweepBasicMaterial extends MeshBasicMaterial {
  readonly _sweepUniforms: SweepUniformSet
  readonly sweepKind: SweepKind

  constructor(source: MeshBasicMaterial, emissiveBoost: number | null) {
    super()
    this.copy(source)
    this.sweepKind = emissiveBoost === null ? "normal" : "emissive"
    if (this.sweepKind === "emissive") forceOpaque(this)
    this._sweepUniforms = freshUniformSet(emissiveBoost ?? 1)
    this.onBeforeCompile = (shader) => patchShader(shader, this._sweepUniforms, this.sweepKind, false)
  }

  customProgramCacheKey(): string {
    return `sweep-basic-${this.sweepKind}`
  }

  setEmissiveBoost(v: number): void {
    this._sweepUniforms.uWfEmissiveBoost.value = v
  }
}

export type SweepMaterial = CustomNormalMaterial | CustomEmissiveMaterial | SweepBasicMaterial

//emissiveBoost null = a normal mesh, a number = an emissive pick at that brightness
export function createSweepMaterial(source: Material, emissiveBoost: number | null): SweepMaterial {
  if ((source as MeshStandardMaterial).isMeshStandardMaterial) {
    const lit = source as MeshStandardMaterial
    return emissiveBoost === null ? new CustomNormalMaterial(lit) : new CustomEmissiveMaterial(lit, emissiveBoost)
  }
  if ((source as MeshBasicMaterial).isMeshBasicMaterial) {
    return new SweepBasicMaterial(source as MeshBasicMaterial, emissiveBoost)
  }
  throw new Error(`material "${source.name}" is a ${source.type}, which the viewer cannot render`)
}

export interface WfSweepPatch {
  progress?:          number
  tintColor?:         Color | string
  axis?:              Vector3
  min?:               number
  range?:             number
  metalness?:         number
  roughness?:         number
  envIntensity?:      number
  specularIntensity?: number
  emissiveColor?:     Color | string
}

export function pushSweepUniforms(materials: Iterable<SweepMaterial>, patch: WfSweepPatch): void {
  for (const mat of materials) {
    const u = mat._sweepUniforms
    if (patch.progress !== undefined)          u.uWfProgress.value = patch.progress
    if (patch.tintColor !== undefined)         u.uWfTint.value.set(patch.tintColor)
    if (patch.axis !== undefined)              u.uWfAxis.value.copy(patch.axis)
    if (patch.min !== undefined)               u.uWfMin.value = patch.min
    if (patch.range !== undefined)             u.uWfRange.value = patch.range
    if (patch.metalness !== undefined)         u.uWfMetalness.value = patch.metalness
    if (patch.roughness !== undefined)         u.uWfRoughness.value = patch.roughness
    if (patch.envIntensity !== undefined)      u.uWfEnvScale.value = patch.envIntensity
    if (patch.specularIntensity !== undefined) u.uWfSpecScale.value = patch.specularIntensity
    if (patch.emissiveColor !== undefined)     u.uWfEmissive.value.set(patch.emissiveColor)
  }
}

//The editor's per-material panel values, applied over the copied source.
export function applyMaterialState(mat: SweepMaterial, spec: MaterialState): void {
  mat.color.set(spec.color)
  if (mat instanceof MeshPhysicalMaterial) {
    mat.metalness         = spec.metalness
    mat.roughness         = spec.roughness
    mat.envMapIntensity   = spec.envMapIntensity
    mat.specularIntensity = spec.specularIntensity
    if (spec.emissiveEnabled) {
      mat.emissive.set(spec.emissive)
      mat.emissiveIntensity = spec.emissiveIntensity
    } else {
      mat.emissive.setHex(0x000000)
      mat.emissiveIntensity = 0
    }
  }
}

//The panel values of a material as loaded, before any override.
export function readMaterialState(mat: SweepMaterial): MaterialState {
  const color = `#${mat.color.getHexString()}`
  if (!(mat instanceof MeshPhysicalMaterial)) {
    return { color, emissive: "#000000", emissiveEnabled: false, emissiveIntensity: 1, metalness: 0, roughness: 1, envMapIntensity: 1, specularIntensity: 1 }
  }
  return {
    color,
    emissive:          `#${mat.emissive.getHexString()}`,
    emissiveEnabled:   mat.emissive.getHex() !== 0 && mat.emissiveIntensity > 0,
    emissiveIntensity: mat.emissiveIntensity,
    metalness:         mat.metalness,
    roughness:         mat.roughness,
    envMapIntensity:   mat.envMapIntensity,
    specularIntensity: mat.specularIntensity,
  }
}

//BREAKDOWN VIEW - neutral matte grey that shows the form without the surfacing
const CLAY_COLOR     = "#b4b2ae"
const CLAY_ROUGHNESS = 0.85

export function createClayMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: CLAY_COLOR, roughness: CLAY_ROUGHNESS, metalness: 0 })
}

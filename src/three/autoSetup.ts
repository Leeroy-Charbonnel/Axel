import { type AnimationClip, Box3, type BufferGeometry, type Material, type Mesh, type Object3D, type Texture, Vector3 } from "three"
import { VIEWER_DEFAULTS } from "../lib/viewer-defaults"
import { type ShadowFrustum, shadowFrustum } from "./lights"
import type { SharedLight, Vec3 } from "./types"

//AUTO SETUP - everything a viewer or the editor needs to show a model well,
//derived from the model alone. Pure: reads the scene graph, changes nothing,
//returns plain JSON-able data.

export const CAMERA_FOV = 35
export const DESKTOP_ASPECT = 16 / 9
export const PHONE_ASPECT   = 9 / 16
//pleasant 3/4 angle: 40 degrees round from the front, 22 above the horizon
const VIEW_AZIMUTH_DEG   = 40
const VIEW_ELEVATION_DEG = 22
//breathing room around the silhouette
const FRAME_MARGIN = 1.12
export const MAX_TEXTURE_SIZE = 2048

export interface CameraView {
  position: Vec3
  target:   Vec3
}

export interface ModelStats {
  triangles:      number
  vertices:       number
  meshes:         number
  //unique materials counted by three.js type, e.g. MeshStandardMaterial: 4
  materials:      Record<string, number>
  //every mesh has UV coordinates
  hasUV:          boolean
  textures:       number
  maxTextureSize: number
  vertexColors:   boolean
  animations:     number
  skinned:        boolean
  morphTargets:   boolean
}

export interface AutoSetup {
  bounds: {
    box:    { min: Vec3; max: Vec3 }
    size:   Vec3
    center: Vec3
    radius: number
    sphere: { center: Vec3; radius: number }
  }
  views:  { desktop: CameraView; phone: CameraView }
  orbit:  { minDistance: number; maxDistance: number }
  clip:   { near: number; far: number }
  ground: { y: number }
  //for the key light of the rig below
  shadow: ShadowFrustum
  lights: SharedLight[]
  sweep:  { axis: Vec3; start: number; end: number; durationMs: number }
  stats:  ModelStats
  warnings: AutoSetupWarning[]
}

//WHAT MAY GO WRONG WITH A MODEL, as codes with their values: the model
//editor words them in the admin's language (autoSetupWarn* labels)
export type AutoSetupWarning =
  | { code: "unsupportedMaterial"; material: string; type: string }
  | { code: "transmission";        material: string }
  | { code: "oversizedTextures";   count: number; limit: number; largest: number }
  | { code: "texturesWithoutUV";   meshes: string[] }

export interface AutoSetupOptions {
  fov?:        number
  //gltf.animations; the scene root does not carry them
  animations?: AnimationClip[]
}

const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z]
const DEG = Math.PI / 180

function directionFrom(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = azimuthDeg * DEG
  const el = elevationDeg * DEG
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
}

//Smallest distance from target, along dir, at which all eight corners of the
//box fit the frustum of that aspect (with FRAME_MARGIN around them).
export function fitDistance(box: Box3, target: Vector3, dir: Vector3, aspect: number, fov = CAMERA_FOV): number {
  const right = new Vector3(0, 1, 0).cross(dir)
  //looking straight down or up: any horizontal right vector will do
  if (right.lengthSq() < 1e-12) right.set(1, 0, 0)
  right.normalize()
  const up   = dir.clone().cross(right).normalize()
  const tanV = Math.tan((fov * DEG) / 2)
  const tanH = tanV * aspect
  const radius = box.getSize(new Vector3()).length() / 2
  let distance = 0
  let maxDepth = -Infinity
  const p = new Vector3()
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target)
    const depth = p.dot(dir)
    maxDepth = Math.max(maxDepth, depth)
    distance = Math.max(
      distance,
      depth + (Math.abs(p.dot(right)) * FRAME_MARGIN) / tanH,
      depth + (Math.abs(p.dot(up)) * FRAME_MARGIN) / tanV,
    )
  }
  //never inside or grazing the box
  return Math.max(distance, maxDepth + radius * 0.1)
}

//The default 3/4 view of the box for that aspect, aimed at its centre.
export function fitCameraView(
  box: Box3,
  aspect: number,
  fov = CAMERA_FOV,
  azimuthDeg = VIEW_AZIMUTH_DEG,
  elevationDeg = VIEW_ELEVATION_DEG,
): CameraView {
  const target = box.getCenter(new Vector3())
  const dir = directionFrom(azimuthDeg, elevationDeg)
  const distance = fitDistance(box, target, dir, aspect, fov)
  return { position: tuple(target.clone().addScaledVector(dir, distance)), target: tuple(target) }
}

//A view authored in the 16:9 editor, shown in a narrower frame. The angle and
//target stay; the camera steps back to keep the authored width in frame, but
//never further than it takes to show the whole model.
export function fitViewToAspect(view: CameraView, box: Box3, aspect: number, fov = CAMERA_FOV, authoredAspect = DESKTOP_ASPECT): CameraView {
  if (aspect >= authoredAspect) return view
  const target = new Vector3(...view.target)
  const offset = new Vector3(...view.position).sub(target)
  const authored = offset.length()
  if (authored === 0) return view
  const dir = offset.divideScalar(authored)
  const sameWidth = authored * (authoredAspect / aspect)
  const distance = Math.max(authored, Math.min(sameWidth, fitDistance(box, target, dir, aspect, fov)))
  return { position: tuple(target.clone().addScaledVector(dir, distance)), target: view.target }
}

function threeAxisLight(id: string, azimuthDeg: number, elevationDeg: number, intensity: number, castShadow: boolean, center: Vector3, radius: number): SharedLight {
  const pos = center.clone().addScaledVector(directionFrom(azimuthDeg, elevationDeg), radius * 3)
  return {
    id,
    type: "directional",
    x: pos.x, y: pos.y, z: pos.z,
    tx: center.x, ty: center.y, tz: center.z,
    normalIntensity: intensity,
    normalColor:     VIEWER_DEFAULTS.normalColor,
    wfIntensity:     intensity,
    wfColor:         VIEWER_DEFAULTS.normalColor,
    enabled:    true,
    wfEnabled:  true,
    castShadow,
  }
}

function textureSize(tex: Texture): number {
  const img = tex.image as { width?: number; height?: number } | null
  return Math.max(img?.width ?? 0, img?.height ?? 0)
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex()
  const count = index ? index.count : geometry.getAttribute("position")?.count ?? 0
  return Math.floor(count / 3)
}

//the wireframe pass
const SWEEP_MIN_MS  = 600
const SWEEP_STEP_MS = 100
const SWEEP_MAX_MS  = 1000

//Where the model starts and ends along an axis, from the corners of its box
export function sweepExtent(axis: Vec3, setup: Pick<AutoSetup, "bounds">): { min: number; max: number } {
  const length = Math.hypot(...axis) || 1
  const n = axis.map((v) => v / length)
  const { min, max } = setup.bounds.box
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < 8; i++) {
    const p = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]
    const d = p[0]! * n[0]! + p[1]! * n[1]! + p[2]! * n[2]!
    lo = Math.min(lo, d)
    hi = Math.max(hi, d)
  }
  return { min: lo, max: hi }
}

export function computeAutoSetup(root: Object3D, opts: AutoSetupOptions = {}): AutoSetup {
  const fov = opts.fov ?? CAMERA_FOV
  const warnings: AutoSetupWarning[] = []

  //STATS
  const meshes: Mesh[] = []
  root.traverse((obj) => {
    if ((obj as Mesh).isMesh) meshes.push(obj as Mesh)
  })
  if (meshes.length === 0) throw new Error("the model contains no mesh")

  let triangles = 0
  let vertices  = 0
  let skinned = false
  let morphTargets = false
  let vertexColors = false
  let withoutUV = 0
  //a texture needs UVs to land anywhere; an untextured mesh without them is fine
  const texturedWithoutUV: string[] = []
  const materials = new Set<Material>()
  for (const mesh of meshes) {
    const g = mesh.geometry
    const instances = (mesh as Mesh & { isInstancedMesh?: boolean; count?: number }).isInstancedMesh
      ? (mesh as unknown as { count: number }).count
      : 1
    triangles += triangleCount(g) * instances
    vertices  += (g.getAttribute("position")?.count ?? 0) * instances
    if ((mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned = true
    if ((g.morphAttributes.position?.length ?? 0) > 0) morphTargets = true
    if (g.getAttribute("color")) vertexColors = true
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of meshMaterials) materials.add(m)
    if (!g.getAttribute("uv")) {
      withoutUV++
      if (meshMaterials.some((m) => Object.values(m).some((v) => (v as Texture | null)?.isTexture))) {
        texturedWithoutUV.push(mesh.name || "(unnamed)")
      }
    }
  }

  const byType: Record<string, number> = {}
  const textures = new Set<Texture>()
  for (const m of materials) {
    byType[m.type] = (byType[m.type] ?? 0) + 1
    for (const value of Object.values(m)) {
      if (value && typeof value === "object" && (value as Texture).isTexture) textures.add(value as Texture)
    }
    const supported = m.type === "MeshStandardMaterial" || m.type === "MeshPhysicalMaterial" || m.type === "MeshBasicMaterial"
    if (!supported) warnings.push({ code: "unsupportedMaterial", material: m.name, type: m.type })
    if (((m as Material & { transmission?: number }).transmission ?? 0) > 0) {
      warnings.push({ code: "transmission", material: m.name })
    }
  }

  let maxTextureSize = 0
  let oversized = 0
  for (const t of textures) {
    const s = textureSize(t)
    maxTextureSize = Math.max(maxTextureSize, s)
    if (s > MAX_TEXTURE_SIZE) oversized++
  }
  if (oversized > 0) {
    warnings.push({ code: "oversizedTextures", count: oversized, limit: MAX_TEXTURE_SIZE, largest: maxTextureSize })
  }
  if (texturedWithoutUV.length > 0) warnings.push({ code: "texturesWithoutUV", meshes: texturedWithoutUV })

  //BOUNDS
  const box = new Box3()
  for (const mesh of meshes) box.expandByObject(mesh, true)
  if (box.isEmpty()) throw new Error("the model has no vertices")
  const size   = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const radius = Math.max(size.length() / 2, 1e-6)

  //VIEWS
  const desktop = fitCameraView(box, DESKTOP_ASPECT, fov)
  const phone   = fitCameraView(box, PHONE_ASPECT, fov)
  const farthest = Math.max(
    new Vector3(...desktop.position).distanceTo(center),
    new Vector3(...phone.position).distanceTo(center),
  )
  const minDistance = radius * 0.3
  const maxDistance = farthest * 2.5

  //LIGHTS, relative to the default camera azimuth: key to the side and above,
  //fill low on the other side, rim behind
  const key  = threeAxisLight("auto-key",  VIEW_AZIMUTH_DEG + 50,  45, 1.8, true,  center, radius)
  const fill = threeAxisLight("auto-fill", VIEW_AZIMUTH_DEG - 70,  20, 0.6, false, center, radius)
  const rim  = threeAxisLight("auto-rim",  VIEW_AZIMUTH_DEG + 180, 50, 1.0, false, center, radius)

  //SWEEP from the floor up, over the whole box
  const axis: Vec3 = [0, 1, 0]
  //a denser mesh gets a slightly slower pass: SWEEP_MIN_MS at 10k triangles,
  //SWEEP_STEP_MS more per doubling, SWEEP_MAX_MS at most
  const durationMs = Math.round(Math.min(SWEEP_MAX_MS, SWEEP_MIN_MS + SWEEP_STEP_MS * Math.log2(Math.max(1, triangles / 10000))))

  return {
    bounds: {
      box:    { min: tuple(box.min), max: tuple(box.max) },
      size:   tuple(size),
      center: tuple(center),
      radius,
      sphere: { center: tuple(center), radius },
    },
    views:  { desktop, phone },
    orbit:  { minDistance, maxDistance },
    clip:   { near: radius * 0.005, far: maxDistance + radius * 4 },
    ground: { y: box.min.y },
    shadow: shadowFrustum(new Vector3(key.x, key.y, key.z), center, center, radius),
    lights: [key, fill, rim],
    sweep:  { axis, start: box.min.y, end: box.max.y, durationMs },
    stats: {
      triangles,
      vertices,
      meshes: meshes.length,
      materials: byType,
      hasUV: withoutUV === 0,
      textures: textures.size,
      maxTextureSize,
      vertexColors,
      animations: (opts.animations ?? root.animations).length,
      skinned,
      morphTargets,
    },
    warnings,
  }
}

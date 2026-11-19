import { VIEWER_DEFAULTS } from "../../lib/viewer-defaults"
import { type AutoSetup, type CameraView, DESKTOP_ASPECT, PHONE_ASPECT } from "../../three/autoSetup"
import type { DefaultView, SharedLight, Vec3, ViewerSettings } from "../../three/types"
import type { Model3dView } from "../../types/portfolio"

//THE EDITOR'S MATHS, framework free: what "auto" means for every control,
//the light presets, and the conversions between saved world values and the
//model-relative values the sliders show.

export type LightPreset = "studio" | "soft" | "contrast"

//multipliers over the auto rig's key, fill and rim intensities
const PRESET_SCALE: Record<LightPreset, { key: number; fill: number; rim: number }> = {
  studio:   { key: 1,    fill: 1,    rim: 1 },
  soft:     { key: 0.7,  fill: 1.6,  rim: 0.6 },
  contrast: { key: 1.35, fill: 0.35, rim: 1.5 },
}
export const LIGHT_PRESETS = Object.keys(PRESET_SCALE) as LightPreset[]

//the role of an auto rig light, from its id
export type LightRole = "key" | "fill" | "rim"
export function lightRole(light: SharedLight): LightRole | null {
  const role = light.id.replace(/^auto-/, "")
  return light.id.startsWith("auto-") && (role === "key" || role === "fill" || role === "rim") ? role : null
}

const round = (v: number) => Math.round(v * 1000) / 1000

//jsonb hands objects back with their keys reordered: compare with sorted keys
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

export function presetLights(setup: AutoSetup, preset: LightPreset): SharedLight[] {
  const scale = PRESET_SCALE[preset]
  return setup.lights.map((l) => {
    const k = scale[lightRole(l) ?? "key"]
    return { ...l, normalIntensity: round(l.normalIntensity * k), wfIntensity: round(l.wfIntensity * k) }
  })
}

export function matchPreset(lights: SharedLight[], setup: AutoSetup): LightPreset | null {
  const current = stableJson(lights)
  return LIGHT_PRESETS.find((p) => stableJson(presetLights(setup, p)) === current) ?? null
}

//THE VALUE EVERY CONTROL FALLS BACK TO
export interface AutoValues {
  stage: { orbitMin: number; orbitMax: number; ground: boolean; lift: number }
  sweep: { axis: Vec3; start: number; end: number; durationMs: number }
  lights: SharedLight[]
}

export function autoValues(setup: AutoSetup): AutoValues {
  const r = setup.bounds.radius
  return {
    stage: {
      orbitMin:      round(setup.orbit.minDistance / r),
      orbitMax:      round(setup.orbit.maxDistance / r),
      ground:        true,
      lift:          0,
    },
    sweep:  setup.sweep,
    lights: presetLights(setup, "studio"),
  }
}

//LIGHT POSITIONS, around the model centre: azimuth and elevation in degrees,
//distance in model radii. Same convention as the auto rig.
const DEG = Math.PI / 180

export interface LightOrbit { azimuth: number; elevation: number; distance: number }

export function lightOrbit(light: SharedLight, setup: AutoSetup): LightOrbit {
  const [cx, cy, cz] = setup.bounds.center
  const dx = light.x - cx
  const dy = light.y - cy
  const dz = light.z - cz
  const length = Math.hypot(dx, dy, dz)
  if (length === 0) return { azimuth: 0, elevation: 0, distance: 0 }
  return {
    azimuth:   Math.atan2(dx, dz) / DEG,
    elevation: Math.asin(dy / length) / DEG,
    distance:  length / setup.bounds.radius,
  }
}

//the light moved to that orbit; a directional light keeps aiming at the centre
export function placeLight(light: SharedLight, orbit: LightOrbit, setup: AutoSetup): SharedLight {
  const [cx, cy, cz] = setup.bounds.center
  const d = orbit.distance * setup.bounds.radius
  const az = orbit.azimuth * DEG
  const el = orbit.elevation * DEG
  const next: SharedLight = {
    ...light,
    x: cx + Math.sin(az) * Math.cos(el) * d,
    y: cy + Math.sin(el) * d,
    z: cz + Math.cos(az) * Math.cos(el) * d,
  }
  if (light.type === "directional") Object.assign(next, { tx: cx, ty: cy, tz: cz })
  return next
}

//A new light, placed for this model rather than at a fixed spot: above and to
//the front-right, three radii out for the sun-like one, closer for a bulb.
export function newLight(type: SharedLight["type"], setup: AutoSetup, id: string): SharedLight {
  const base: SharedLight = {
    id,
    type,
    x: 0, y: 0, z: 0,
    normalIntensity: type === "point" ? 2 : 1,
    normalColor:     VIEWER_DEFAULTS.normalColor,
    wfIntensity:     type === "point" ? 2 : 1,
    wfColor:         VIEWER_DEFAULTS.normalColor,
    enabled:    true,
    wfEnabled:  true,
    castShadow: false,
    ...(type === "point" ? { range: 0 } : {}),
  }
  return placeLight(base, { azimuth: 30, elevation: 40, distance: type === "point" ? 1.5 : 3 }, setup)
}

//The same light as the other type, where it stands: a sun aims at the model
//centre, a bulb reaches as far as it can.
export function withLightType(light: SharedLight, type: SharedLight["type"], setup: AutoSetup): SharedLight {
  const { tx: _tx, ty: _ty, tz: _tz, range: _range, castShadow: _castShadow, ...rest } = light
  const [tx, ty, tz] = setup.bounds.center
  return type === "directional" ? { ...rest, type, tx, ty, tz } : { ...rest, type, range: 0 }
}

//SWEEP: positions along the axis as a fraction of the model's extent on it
export { sweepExtent } from "../../three/autoSetup"

//VIEWS
export function toStartView(view: CameraView, aspect: number): Omit<DefaultView, "name"> {
  return { pos: view.position, target: view.target, aspect: round(aspect) }
}

export interface AutoSummary {
  views:          string[]
  orbit:          { min: number; max: number }
  lights:         number
  sweepAxis:      Vec3
  sweepMs:        number
  materialsReset: number
}

const sameView = (a: Model3dView, b: Model3dView) => stableJson(a) === stableJson(b)

//Writes a bookmark for each screen, keeping the name of the current default
//when there is one, so the projects pointing at it follow.
function upsertView(views: Model3dView[], name: string, view: CameraView, aspect: number): Model3dView[] {
  const next: Model3dView = { name, position: view.position, target: view.target, wireframe: false, aspect: round(aspect) }
  const i = views.findIndex((v) => v.name === name)
  if (i < 0) return [...views, next]
  if (sameView(views[i]!, next)) return views
  return views.map((v, j) => (j === i ? { ...v, ...next } : v))
}

//THE AUTOMATIC SETUP applied to a document: views and their screen defaults,
//the studio rig, and the stage and sweep handed back to the auto values.
//Material overrides go only when asked.
export function applyAutoSetup(
  settings: ViewerSettings,
  views: Model3dView[],
  setup: AutoSetup,
  opts: { resetMaterials: boolean; names: { desktop: string; phone: string } },
): { settings: ViewerSettings; views: Model3dView[]; summary: AutoSummary } {
  const desktopName = settings.defaultViews?.desktop?.name ?? opts.names.desktop
  const phoneName   = settings.defaultViews?.phone?.name   ?? opts.names.phone
  let nextViews = upsertView(views, desktopName, setup.views.desktop, DESKTOP_ASPECT)
  nextViews = upsertView(nextViews, phoneName, setup.views.phone, PHONE_ASPECT)

  const auto = autoValues(setup)
  const wf = { ...(settings.wireframeMode ?? {}) }
  delete wf.sweepAxis
  delete wf.sweepStart
  delete wf.sweepEnd
  delete wf.sweepDurationMs

  const next: ViewerSettings = {
    ...settings,
    defaultViews: {
      desktop: { name: desktopName, ...toStartView(setup.views.desktop, DESKTOP_ASPECT) },
      phone:   { name: phoneName,   ...toStartView(setup.views.phone, PHONE_ASPECT) },
    },
    lights: auto.lights,
    wireframeMode: wf,
  }
  delete next.stage
  const materialsReset = opts.resetMaterials ? (settings.materials ?? []).length : 0
  if (opts.resetMaterials) delete next.materials

  return {
    settings: next,
    views: nextViews,
    summary: {
      views:          [desktopName, phoneName],
      orbit:          { min: auto.stage.orbitMin, max: auto.stage.orbitMax },
      lights:         auto.lights.length,
      sweepAxis:      setup.sweep.axis,
      sweepMs:        setup.sweep.durationMs,
      materialsReset,
    },
  }
}

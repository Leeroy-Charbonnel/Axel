//SHAPE OF model_3d.viewer_settings, the snapshot the editor saves and the
//viewer applies. Read from jsonb, so every field may be missing.

export type Vec3 = [number, number, number]

export type ViewerMode = "render" | "wireframe" | "clay"

//One light, shared by both modes: position and range are common, intensity
//and colour are per mode.
export interface SharedLight {
  id:   string
  type: "point" | "directional"
  x: number; y: number; z: number
  //directional target
  tx?: number; ty?: number; tz?: number
  //point light distance, 0 = infinite
  range?:          number
  normalIntensity: number
  normalColor:     string
  wfIntensity:     number
  wfColor:         string
  //false = the light does not exist in either mode
  enabled?:    boolean
  //false = the light fades out while the model is in wireframe mode
  wfEnabled?:  boolean
  //default: directional lights cast, point lights do not
  castShadow?: boolean
}

//Matched to the loaded model by material name, or by glTF material index
//when the material has no name.
export interface MaterialState {
  name?:             string
  index?:            number
  color:             string
  emissive:          string
  emissiveEnabled:   boolean
  emissiveIntensity: number
  metalness:         number
  roughness:         number
  envMapIntensity:   number
  specularIntensity: number
}

export interface EmissiveSpec {
  name?:     string
  intensity: number
}

export interface StartView {
  pos:    Vec3
  target: Vec3
}

export interface WireframeMaterialParams {
  color:             string
  metalness:         number
  roughness:         number
  envMapIntensity:   number
  specularIntensity: number
}

export interface ViewerSettings {
  //null = frame the model automatically
  startView?: StartView | null
  materials?: MaterialState[]
  lights?:    SharedLight[]
  normalMode?: {
    hdrId?:        string
    hdrUrl?:       string | null
    hdrIntensity?: number
  }
  wireframeMode?: {
    hdrId?:            string
    hdrUrl?:           string | null
    hdrIntensity?:     number
    //colour the emissive picks glow with
    color?:            string
    overlayOn?:        boolean
    overlayColor?:     string
    //pixels
    overlayLineWidth?: number
    //world-space direction, normalised at runtime
    sweepAxis?:        Vec3
    //world-space positions along sweepAxis
    sweepStart?:       number
    sweepEnd?:         number
    sweepDurationMs?:  number
    material?:         WireframeMaterialParams
    emissiveMeshes?:   EmissiveSpec[]
  }
}

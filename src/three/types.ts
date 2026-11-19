//SHAPE OF model_3d.viewer_settings, the snapshot the editor saves and the
//viewer applies. Read from jsonb, so every field may be missing.

export type Vec3 = [number, number, number]

export type ViewerMode = "render" | "wireframe" | "clay"

//a fixed CSS colour ("#rrggbb"), or "background": the site background colour
export type WireColor = string

//the environment of one look; no hdrUrl = the procedural studio
export interface EnvironmentSettings {
  hdrId?:        string
  hdrUrl?:       string | null
  hdrIntensity?: number
  //degrees around the vertical axis
  hdrRotation?:  number
  //true: the map is drawn behind the model
  hdrBackground?: boolean
}

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
  //width / height of the frame it was authored in; 16:9 when missing
  aspect?: number
}

//A camera bookmark picked as the start view of one kind of screen, used when
//the project names no view. name is the bookmark it was taken from.
export interface DefaultView extends StartView {
  name: string
}

export interface WireframeMaterialParams {
  //old surface colour, no longer read: surfaceColor replaced it
  color:             string
  metalness:         number
  roughness:         number
  envMapIntensity:   number
  specularIntensity: number
}

export interface ViewerSettings {
  //null = the default view for the screen, else frame the model automatically
  startView?: StartView | null
  //numbered marks on the model (an exploded view's legend), in the file's
  //own frame, numbered 01, 02... in this order
  labels?: Vec3[]
  //phone = a frame taller than wide
  defaultViews?: { desktop?: DefaultView; phone?: DefaultView }
  //missing fields follow the auto setup
  stage?: {
    //zoom limits, in multiples of the model radius
    orbitMin?:      number
    orbitMax?:      number
    //the soft glow on the floor under the model
    ground?:        boolean
    //the gap between the model and the floor, in model radii (a hanging object)
    lift?:          number
  }
  materials?: MaterialState[]
  lights?:    SharedLight[]
  normalMode?: EnvironmentSettings
  wireframeMode?: EnvironmentSettings & {
    //colour the emissive picks glow with
    color?:            string
    overlayOn?:        boolean
    //this model's wireframe colours; missing = white surfaces, black lines.
    //A "background" surface is left clear, so the page shows through it.
    surfaceColor?:     WireColor
    lineColor?:        WireColor
    //old line colour, no longer read: lineColor replaced it
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

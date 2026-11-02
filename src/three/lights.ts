import { Color, DirectionalLight, Group, PointLight, Vector3 } from "three"
import type { SharedLight } from "./types"

const SHADOW_BIAS        = -0.0002
const SHADOW_NORMAL_BIAS = 0.02
const POINT_LIGHT_DECAY  = 2

export interface ShadowFrustum {
  left: number; right: number; top: number; bottom: number
  near: number; far: number
}

//Orthographic shadow box of a directional light at lightPos aimed at target,
//fitted to the model's bounding sphere. In light space a receiver shares the
//xy of its occluder, so the sides only need the sphere; the far plane reaches
//the ground behind the model along a grazing ray.
export function shadowFrustum(lightPos: Vector3, target: Vector3, center: Vector3, radius: number): ShadowFrustum {
  const half = radius * 1.15
  const dir = target.clone().sub(lightPos)
  const length = dir.length()
  //depth of the sphere centre along the light's view direction
  const depth = length > 0 ? center.clone().sub(lightPos).dot(dir.divideScalar(length)) : 0
  return {
    left: -half, right: half, top: half, bottom: -half,
    near: Math.max(radius * 0.01, depth - radius * 1.5),
    far:  depth + radius * 6,
  }
}

interface LiveLight {
  spec:  SharedLight
  light: PointLight | DirectionalLight
}

const colorA = new Color()
const colorB = new Color()

//The lights of a viewer, from the saved specs. A light with enabled: false is
//not created at all.
export class LightRig {
  readonly group = new Group()
  private readonly live: LiveLight[] = []

  //shadowMapSize: from the render quality (quality.ts)
  constructor(specs: SharedLight[], shadowMapSize: number) {
    for (const spec of specs) {
      if (spec.enabled === false) continue
      const castShadow = spec.castShadow ?? spec.type === "directional"
      let light: PointLight | DirectionalLight
      if (spec.type === "point") {
        light = new PointLight(spec.normalColor, spec.normalIntensity, spec.range ?? 0, POINT_LIGHT_DECAY)
      } else {
        light = new DirectionalLight(spec.normalColor, spec.normalIntensity)
        light.target.position.set(spec.tx ?? 0, spec.ty ?? 0, spec.tz ?? 0)
        this.group.add(light.target)
      }
      light.position.set(spec.x, spec.y, spec.z)
      light.castShadow = castShadow
      if (castShadow) {
        light.shadow.mapSize.set(shadowMapSize, shadowMapSize)
        light.shadow.bias       = SHADOW_BIAS
        light.shadow.normalBias = SHADOW_NORMAL_BIAS
      }
      this.group.add(light)
      this.live.push({ spec, light })
    }
  }

  //t = 0 normal mode, 1 wireframe mode; intensity and colour blend between the two
  setModeMix(t: number): void {
    for (const { spec, light } of this.live) {
      const wf = spec.wfEnabled === false ? 0 : spec.wfIntensity
      light.intensity = spec.normalIntensity + (wf - spec.normalIntensity) * t
      colorA.set(spec.normalColor)
      colorB.set(spec.wfColor)
      light.color.copy(colorA.lerp(colorB, t))
    }
  }

  fitShadows(center: Vector3, radius: number): void {
    for (const { light } of this.live) {
      if (!light.castShadow) continue
      if (light instanceof DirectionalLight) {
        const f = shadowFrustum(light.position, light.target.position, center, radius)
        Object.assign(light.shadow.camera, f)
      } else {
        light.shadow.camera.near = radius * 0.01
        light.shadow.camera.far  = light.position.distanceTo(center) + radius * 6
      }
      light.shadow.camera.updateProjectionMatrix()
    }
  }

  dispose(): void {
    for (const { light } of this.live) light.dispose()
    this.group.clear()
  }
}

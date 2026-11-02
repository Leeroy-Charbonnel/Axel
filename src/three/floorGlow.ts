import { Color, Mesh, PlaneGeometry, ShaderMaterial } from "three"
import { VIEWER_DEFAULTS } from "../lib/viewer-defaults"

//THE FLOOR UNDER EVERY MODEL: a disc on the ground, lighter at its centre and
//fading to nothing at its rim, like a studio spot on a dark floor. Built by the
//viewer for every model, sized from its bounds: nothing to set per model.

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = uOpacity * pow(1.0 - smoothstep(0.0, 1.0, d), 1.6);
  gl_FragColor = vec4(uColor, a);
}`

export function createFloorGlow(): Mesh {
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor:   { value: new Color(VIEWER_DEFAULTS.floorGlowColor) },
      uOpacity: { value: VIEWER_DEFAULTS.floorGlowOpacity },
    },
    transparent: true,
    depthWrite: false,
  })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  mesh.rotation.x = -Math.PI / 2
  //drawn first, under the model and its shadow
  mesh.renderOrder = -1
  mesh.visible = false
  return mesh
}

//centred under the model, its diameter a few times the model's radius
export function placeFloorGlow(mesh: Mesh, center: [number, number, number], radius: number, y: number): void {
  mesh.scale.setScalar(radius * VIEWER_DEFAULTS.floorGlowScale)
  mesh.position.set(center[0], y, center[2])
}

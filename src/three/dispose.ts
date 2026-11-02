import type { Material, Object3D, Texture, WebGLRenderer } from "three"

//material.dispose() frees the program, not the textures it points at
export function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && (value as Texture).isTexture) (value as Texture).dispose()
  }
  material.dispose()
}

//Every geometry, material and material texture under root. Safe on a tree that
//was never rendered (a GLB that arrives after unmount).
export function disposeObject(root: Object3D): void {
  root.traverse((obj) => {
    const withGeometry = obj as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] }
    withGeometry.geometry?.dispose()
    const mat = withGeometry.material
    if (!mat) return
    for (const m of Array.isArray(mat) ? mat : [mat]) disposeMaterial(m)
  })
}

//loseContext: false when the context is already lost and will be restored
export function disposeRenderer(renderer: WebGLRenderer, loseContext: boolean): void {
  renderer.renderLists.dispose()
  renderer.dispose()
  if (loseContext) renderer.forceContextLoss()
}

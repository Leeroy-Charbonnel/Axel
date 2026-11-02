//WIREFRAME EDGES WITHOUT QUAD DIAGONALS. No three.js import: the edge worker
//loads this file alone.
//
//Exporters (Blender, Maya, Houdini, GLTFExporter) emit the two triangles of a
//triangulated quad one after the other. A consecutive pair sharing exactly two
//vertices shares the quad's diagonal, and that edge is dropped; every other
//edge is drawn. This needs the original triangle order, which is why the GLB
//optimizer never reorders triangles.
//
//Edges are keyed by a * vertexCount + b (a < b), exact as a double below 2^53,
//sorted once instead of hashed as strings.

export interface EdgeJob {
  //xyz per vertex
  positions: Float32Array
  //null for non-indexed geometry
  index:     Uint32Array | Uint16Array | null
}

export interface EdgeRequest { jobs: EdgeJob[] }
export type EdgeResponse = { segments: Float32Array[] } | { error: string }

//Returns xyz xyz per segment, the layout LineSegmentsGeometry.setPositions takes.
export function computeEdgeSegments(positions: Float32Array, index: ArrayLike<number> | null): Float32Array {
  const vertexCount = positions.length / 3
  const triCount    = Math.floor((index ? index.length : vertexCount) / 3)
  const at = index ? (i: number) => index[i]! : (i: number) => i

  const diagonals = new Float64Array(triCount >> 1)
  let diagonalCount = 0
  for (let t = 0; t + 1 < triCount; t += 2) {
    const a0 = at(3 * t), a1 = at(3 * t + 1), a2 = at(3 * t + 2)
    const b0 = at(3 * t + 3), b1 = at(3 * t + 4), b2 = at(3 * t + 5)
    let shared = 0
    let s0 = 0
    let s1 = 0
    if (a0 === b0 || a0 === b1 || a0 === b2) { s0 = a0; shared++ }
    if (a1 === b0 || a1 === b1 || a1 === b2) { if (shared === 0) s0 = a1; else s1 = a1; shared++ }
    if (a2 === b0 || a2 === b1 || a2 === b2) { if (shared === 0) s0 = a2; else s1 = a2; shared++ }
    if (shared === 2) diagonals[diagonalCount++] = s0 < s1 ? s0 * vertexCount + s1 : s1 * vertexCount + s0
  }

  const keys = new Float64Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    const v0 = at(3 * t), v1 = at(3 * t + 1), v2 = at(3 * t + 2)
    keys[3 * t]     = v0 < v1 ? v0 * vertexCount + v1 : v1 * vertexCount + v0
    keys[3 * t + 1] = v1 < v2 ? v1 * vertexCount + v2 : v2 * vertexCount + v1
    keys[3 * t + 2] = v2 < v0 ? v2 * vertexCount + v0 : v0 * vertexCount + v2
  }
  keys.sort()
  const sortedDiagonals = diagonals.subarray(0, diagonalCount).sort()

  //unique keys minus diagonals, both lists sorted: one merge pass
  const kept = new Float64Array(keys.length)
  let keptCount = 0
  let d = 0
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!
    if (i > 0 && k === keys[i - 1]) continue
    while (d < diagonalCount && sortedDiagonals[d]! < k) d++
    if (d < diagonalCount && sortedDiagonals[d] === k) continue
    kept[keptCount++] = k
  }

  const out = new Float32Array(keptCount * 6)
  for (let i = 0; i < keptCount; i++) {
    const k = kept[i]!
    const a = Math.floor(k / vertexCount)
    const b = k - a * vertexCount
    out[6 * i]     = positions[3 * a]!
    out[6 * i + 1] = positions[3 * a + 1]!
    out[6 * i + 2] = positions[3 * a + 2]!
    out[6 * i + 3] = positions[3 * b]!
    out[6 * i + 4] = positions[3 * b + 1]!
    out[6 * i + 5] = positions[3 * b + 2]!
  }
  return out
}

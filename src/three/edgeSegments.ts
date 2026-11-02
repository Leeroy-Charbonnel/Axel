//WIREFRAME EDGES WITHOUT QUAD DIAGONALS. No three.js import: the edge worker
//loads this file alone.
//
//An edge is dropped when it lies inside a face: when its two triangles lie in
//one plane and it is the longest edge of one of them (a diagonal inside a flat
//face or n-gon, however it was triangulated; the real edges of a flat quad grid
//are never the longest of their triangles, so they stay), or when two
//consecutive triangles share it as the longest edge of both (the diagonal of a
//curved quad: exporters emit the two triangles of a quad one after the other,
//which is why the GLB optimizer never reorders triangles). Every other edge is
//drawn once, across UV seams and hard edges.
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

//two triangles closer than this to one plane belong to one flat face
const COPLANAR_COS = Math.cos((0.5 * Math.PI) / 180)

function dist2(positions: Float32Array, a: number, b: number): number {
  const x = positions[3 * a]! - positions[3 * b]!, y = positions[3 * a + 1]! - positions[3 * b + 1]!, z = positions[3 * a + 2]! - positions[3 * b + 2]!
  return x * x + y * y + z * z
}

//whether the edge s0-s1 of the triangle (a, b, c) is its longest
function isLongest(positions: Float32Array, a: number, b: number, c: number, s0: number, s1: number): boolean {
  const shared = dist2(positions, s0, s1)
  return dist2(positions, a, b) <= shared && dist2(positions, b, c) <= shared && dist2(positions, c, a) <= shared
}

function normalOf(positions: Float32Array, a: number, b: number, c: number): [number, number, number] {
  const ux = positions[3 * b]! - positions[3 * a]!, uy = positions[3 * b + 1]! - positions[3 * a + 1]!, uz = positions[3 * b + 2]! - positions[3 * a + 2]!
  const vx = positions[3 * c]! - positions[3 * a]!, vy = positions[3 * c + 1]! - positions[3 * a + 1]!, vz = positions[3 * c + 2]! - positions[3 * a + 2]!
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  return [nx / len, ny / len, nz / len]
}

//Returns xyz xyz per segment, the layout LineSegmentsGeometry.setPositions takes.
export function computeEdgeSegments(positions: Float32Array, index: ArrayLike<number> | null): Float32Array {
  const vertexCount = positions.length / 3
  const triCount    = Math.floor((index ? index.length : vertexCount) / 3)
  //vertices split at a UV seam or a hard edge share a position: they count as
  //one, so an edge along a seam is drawn once and its two faces are neighbours
  const canonical = new Uint32Array(vertexCount)
  const seen = new Map<string, number>()
  for (let v = 0; v < vertexCount; v++) {
    const key = `${positions[3 * v]},${positions[3 * v + 1]},${positions[3 * v + 2]}`
    const first = seen.get(key)
    if (first === undefined) seen.set(key, v)
    canonical[v] = first ?? v
  }
  const raw = index ? (i: number) => index[i]! : (i: number) => i
  const at = (i: number) => canonical[raw(i)]!
  const edgeKey = (a: number, b: number) => (a < b ? a * vertexCount + b : b * vertexCount + a)

  const normals = new Float32Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    const n = normalOf(positions, at(3 * t), at(3 * t + 1), at(3 * t + 2))
    normals[3 * t] = n[0]; normals[3 * t + 1] = n[1]; normals[3 * t + 2] = n[2]
  }
  const coplanar = (t: number, u: number) =>
    normals[3 * t]! * normals[3 * u]! + normals[3 * t + 1]! * normals[3 * u + 1]! + normals[3 * t + 2]! * normals[3 * u + 2]! >= COPLANAR_COS

  //whether the edge k is the longest of triangle t
  const longestIn = (t: number, k: number) => {
    const a = Math.floor(k / vertexCount)
    return isLongest(positions, at(3 * t), at(3 * t + 1), at(3 * t + 2), a, k - a * vertexCount)
  }

  //QUAD DIAGONALS - a consecutive pair whose shared edge is the longest of both
  const diagonals = new Float64Array(triCount)
  let diagonalCount = 0
  for (let t = 0; t + 1 < triCount; t++) {
    const a0 = at(3 * t), a1 = at(3 * t + 1), a2 = at(3 * t + 2)
    const b0 = at(3 * t + 3), b1 = at(3 * t + 4), b2 = at(3 * t + 5)
    let shared = 0
    let s0 = 0
    let s1 = 0
    if (a0 === b0 || a0 === b1 || a0 === b2) { s0 = a0; shared++ }
    if (a1 === b0 || a1 === b1 || a1 === b2) { if (shared === 0) s0 = a1; else s1 = a1; shared++ }
    if (a2 === b0 || a2 === b1 || a2 === b2) { if (shared === 0) s0 = a2; else s1 = a2; shared++ }
    if (shared !== 2) continue
    if (isLongest(positions, a0, a1, a2, s0, s1) && isLongest(positions, b0, b1, b2, s0, s1)) diagonals[diagonalCount++] = edgeKey(s0, s1)
  }
  const sortedDiagonals = diagonals.subarray(0, diagonalCount).sort()

  //EVERY EDGE with the triangle it belongs to, sorted by edge
  const keys = new Float64Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    const v0 = at(3 * t), v1 = at(3 * t + 1), v2 = at(3 * t + 2)
    keys[3 * t] = edgeKey(v0, v1)
    keys[3 * t + 1] = edgeKey(v1, v2)
    keys[3 * t + 2] = edgeKey(v2, v0)
  }
  const order = Uint32Array.from(keys.keys()).sort((i, j) => keys[i]! - keys[j]!)

  //an edge goes when its two triangles lie in one plane and it is the longest
  //edge of one of them (inside a flat face, whatever the triangle order), or
  //when it is a quad diagonal
  const kept = new Float64Array(keys.length)
  let keptCount = 0
  let d = 0
  for (let i = 0; i < order.length; ) {
    const k = keys[order[i]!]!
    let j = i + 1
    while (j < order.length && keys[order[j]!] === k) j++
    const t = Math.floor(order[i]! / 3)
    const u = Math.floor(order[i + 1]! / 3)
    const flat = j - i === 2 && coplanar(t, u) && (longestIn(t, k) || longestIn(u, k))
    while (d < diagonalCount && sortedDiagonals[d]! < k) d++
    const diagonal = d < diagonalCount && sortedDiagonals[d] === k
    if (!flat && !diagonal) kept[keptCount++] = k
    i = j
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

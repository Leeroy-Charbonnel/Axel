import { type Document, NodeIO, Primitive } from "@gltf-transform/core"
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions"
import { dedup, prune, quantize, resample, textureCompress, weld } from "@gltf-transform/functions"
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer"
import sharp from "sharp"

//GLB OPTIMIZER - what the browser downloads and decodes, made smaller without
//changing what it shows: duplicates merged, unused data dropped, vertices
//welded, animations resampled, textures capped at 2048 px and re-encoded to
//WebP, geometry quantized and meshopt-compressed (EXT_meshopt_compression,
//decoded by the viewer's MeshoptDecoder). The phone copy is the same with
//textures capped at 1024 px.
//
//Triangles are never reordered (no reorder(), which meshopt() would run): the
//viewer finds quad diagonals from the order the exporter wrote the triangles in.

export interface OptimizeReport {
  bytesBefore: number
  bytesAfter:  number
  triangles:   number
  textures:    number
  //longest side of the largest texture kept, in pixels
  largestTexture: number
}

const DEFAULT_MAX_TEXTURE_SIZE = 2048
export const PHONE_MAX_TEXTURE_SIZE = 1024
const COLOR_QUALITY = 85

let ioReady: Promise<NodeIO> | null = null

export function gltfIO(): Promise<NodeIO> {
  ioReady ??= Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]).then(() =>
    new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder }),
  )
  return ioReady
}

function primitiveTriangles(prim: Primitive): number {
  const indices = prim.getIndices()
  const count = indices ? indices.getCount() : prim.getAttribute("POSITION")?.getCount() ?? 0
  const mode = prim.getMode()
  if (mode === Primitive.Mode.TRIANGLES) return Math.floor(count / 3)
  if (mode === Primitive.Mode.TRIANGLE_STRIP || mode === Primitive.Mode.TRIANGLE_FAN) return Math.max(0, count - 2)
  return 0
}

//Triangles drawn by every scene, a mesh counted once per node that uses it: dedup
//merges identical meshes into one shared by several nodes, the drawn total stays.
export function countTriangles(doc: Document): number {
  let total = 0
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh()
      if (!mesh) return
      for (const prim of mesh.listPrimitives()) total += primitiveTriangles(prim)
    })
  }
  return total
}

export async function optimizeGlb(
  input: Uint8Array,
  opts: { maxTextureSize?: number } = {},
): Promise<{ output: Uint8Array; report: OptimizeReport }> {
  const io = await gltfIO()
  const doc = await io.readBinary(input)
  const trianglesBefore = countTriangles(doc)
  const max = opts.maxTextureSize ?? DEFAULT_MAX_TEXTURE_SIZE

  await doc.transform(
    //named materials and meshes stay apart: the editor's overrides and emissive
    //picks find them by name. Their duplicated vertex data is still shared.
    dedup({ keepUniqueNames: true }),
    prune(),
    weld(),
    resample(),
    //normal maps carry vectors, not colour: lossy WebP bends the shading
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [max, max], slots: /^normalTexture$/, nearLossless: true }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [max, max], slots: /^(?!normalTexture$)/, quality: COLOR_QUALITY }),
    quantize(),
  )
  doc.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

  const output = await io.writeBinary(doc)
  const triangles = countTriangles(doc)
  if (triangles !== trianglesBefore) {
    throw new Error(`optimization changed the triangle count: ${trianglesBefore} -> ${triangles}`)
  }
  return {
    output,
    report: {
      bytesBefore: input.byteLength,
      bytesAfter:  output.byteLength,
      triangles,
      textures:    doc.getRoot().listTextures().length,
      largestTexture: Math.max(0, ...doc.getRoot().listTextures().flatMap((t) => t.getSize() ?? [])),
    },
  }
}

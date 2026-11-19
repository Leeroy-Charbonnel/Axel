import { describe, expect, test } from "bun:test"
import { Document } from "@gltf-transform/core"
import sharp from "sharp"
import { gltfIO, optimizeGlb, PHONE_MAX_TEXTURE_SIZE } from "../../server/glb-optimize"

//one triangle with a colour texture of that size, as a .glb. The texture is a
//gradient: the optimizer turns a plain colour into a material factor.
async function texturedGlb(size: number): Promise<Uint8Array> {
  const pixels = new Uint8Array(size * size * 3)
  for (let i = 0; i < size * size; i++) pixels[i * 3] = (i % size) * 255 / size
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
  const doc = new Document()
  const buffer = doc.createBuffer()
  const position = doc.createAccessor().setType("VEC3").setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer)
  const uv = doc.createAccessor().setType("VEC2").setArray(new Float32Array([0, 0, 1, 0, 0, 1])).setBuffer(buffer)
  const texture = doc.createTexture("colour").setImage(new Uint8Array(png)).setMimeType("image/png")
  const material = doc.createMaterial("painted").setBaseColorTexture(texture)
  const primitive = doc.createPrimitive().setAttribute("POSITION", position).setAttribute("TEXCOORD_0", uv).setMaterial(material)
  doc.createScene().addChild(doc.createNode("part").setMesh(doc.createMesh("part").addPrimitive(primitive)))
  return (await gltfIO()).writeBinary(doc)
}

describe("optimizeGlb", () => {
  test("reports its largest texture, the one a phone copy is decided on", async () => {
    const { report } = await optimizeGlb(await texturedGlb(1536))
    expect(report.largestTexture).toBe(1536)
    expect(report.textures).toBe(1)
    expect(report.triangles).toBe(1)
  })

  test("the phone cap shrinks a larger texture and keeps the triangles", async () => {
    const { report } = await optimizeGlb(await texturedGlb(1536), { maxTextureSize: PHONE_MAX_TEXTURE_SIZE })
    expect(report.largestTexture).toBe(PHONE_MAX_TEXTURE_SIZE)
    expect(report.triangles).toBe(1)
  })

  test("a texture under the cap keeps its size", async () => {
    const { report } = await optimizeGlb(await texturedGlb(512), { maxTextureSize: PHONE_MAX_TEXTURE_SIZE })
    expect(report.largestTexture).toBe(512)
  })
})

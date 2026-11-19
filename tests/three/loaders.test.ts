import { describe, expect, test } from "bun:test"
import { extensionsUsed } from "../../src/three/loaders"

function glb(json: string): ArrayBuffer {
  const text = new TextEncoder().encode(json)
  const out = new ArrayBuffer(20 + text.byteLength)
  const view = new DataView(out)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, out.byteLength, true)
  view.setUint32(12, text.byteLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(out, 20).set(text)
  return out
}

describe("the extensions a model names", () => {
  test("are read from a .glb", () => {
    expect(extensionsUsed(glb(`{"asset":{"version":"2.0"},"extensionsUsed":["KHR_draco_mesh_compression","EXT_texture_webp"]}`)))
      .toEqual(["KHR_draco_mesh_compression", "EXT_texture_webp"])
  })

  test("are read from a .gltf", () => {
    const gltf = new TextEncoder().encode(`{"asset":{"version":"2.0"},"extensionsUsed":["KHR_texture_basisu"]}`)
    expect(extensionsUsed(gltf.buffer as ArrayBuffer)).toEqual(["KHR_texture_basisu"])
  })

  test("are none when the model names none", () => {
    expect(extensionsUsed(glb(`{"asset":{"version":"2.0"}}`))).toEqual([])
  })

  test("a .glb without a JSON chunk is refused", () => {
    const broken = glb("{}")
    new DataView(broken).setUint32(16, 0x004e4942, true)
    expect(() => extensionsUsed(broken)).toThrow("JSON chunk")
  })
})

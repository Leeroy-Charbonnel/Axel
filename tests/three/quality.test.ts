import { expect, test } from "bun:test"
import type { WebGLRenderer } from "three"
import { detectQuality, rememberQuality } from "../../src/three/quality"

//A renderer whose context names this GPU
function rendererWith(gpu: string): WebGLRenderer {
  const gl = {
    getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
    getParameter: () => gpu,
  }
  return { getContext: () => gl } as unknown as WebGLRenderer
}

test("a strong GPU starts high, a weak one low", () => {
  expect(detectQuality(rendererWith("NVIDIA GeForce RTX 3070"), false)).toBe("high")
  expect(detectQuality(rendererWith("Intel(R) HD Graphics 4000"), false)).toBe("low")
})

test("after a viewer dropped, the next ones start no higher", () => {
  rememberQuality("medium")
  expect(detectQuality(rendererWith("NVIDIA GeForce RTX 3070"), false)).toBe("medium")
  rememberQuality("low")
  expect(detectQuality(rendererWith("NVIDIA GeForce RTX 3070"), false)).toBe("low")
  //a higher level never lifts the ceiling back
  rememberQuality("high")
  expect(detectQuality(rendererWith("NVIDIA GeForce RTX 3070"), false)).toBe("low")
})

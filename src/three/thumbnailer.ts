import { frameToPixels, pixelsStill } from "../lib/thumb-image"
import { decodeEquirect } from "./environment"
import { equirectPreview } from "./equirectPreview"
import { inLoadTurn } from "./loadQueue"
import { ModelViewer } from "./modelViewer"
import type { ViewerSettings } from "./types"

//STILLS OF 3D FILES, for the admin's thumbnails. A model is drawn by the
//public viewer itself, so the picture is what the site shows: on one hidden
//canvas whose WebGL context serves every model of a run and is given back at
//the end. An environment map needs no context, it is computed.

//a model not drawn after this long has failed
const MODEL_TIMEOUT_MS = 120_000

export class ModelStills {
  private host: HTMLDivElement | null = null
  private canvas: HTMLCanvasElement | null = null

  //The hidden canvas at this size. It keeps its layout: the viewer reads its size from it.
  private surface(width: number, height: number): HTMLCanvasElement {
    if (!this.host || !this.canvas) {
      this.host = document.createElement("div")
      this.host.setAttribute("aria-hidden", "true")
      this.host.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;contain:strict"
      this.canvas = document.createElement("canvas")
      this.canvas.style.cssText = "display:block;width:100%;height:100%"
      this.host.append(this.canvas)
      document.body.append(this.host)
    }
    this.host.style.width = `${width}px`
    this.host.style.height = `${height}px`
    return this.canvas
  }

  //The model as its viewer shows it at rest: these settings, the start view
  //for a frame of this shape, nothing moving. Throws with the reason.
  async take(url: string, settings: ViewerSettings, width: number, height: number, glowColor: string): Promise<Blob> {
    const canvas = this.surface(width, height)
    const viewer = new ModelViewer({ canvas, maxPixelRatio: 1, touch: false, reducedMotion: true, autoRotate: false, glowColor })
    //no frame loop: the only frames are the ones asked for here
    viewer.setActive(false)
    let timer = 0
    try {
      await Promise.race([
        inLoadTurn(() => viewer.load(url, settings, () => undefined)),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(`not drawn after ${MODEL_TIMEOUT_MS / 1000} s`)), MODEL_TIMEOUT_MS)
        }),
      ])
      const gl = viewer.core.renderer.getContext()
      if (gl.isContextLost()) throw new Error("the WebGL context was lost")
      //drawn and read in the same task: the browser clears the canvas after it
      viewer.core.renderNow()
      const w = gl.drawingBufferWidth
      const h = gl.drawingBufferHeight
      const frame = new Uint8Array(w * h * 4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, frame)
      return await pixelsStill(frameToPixels(frame, w, h), w, h, width, height)
    } finally {
      clearTimeout(timer)
      //the next model takes the same canvas and context
      viewer.dispose(false)
    }
  }

  dispose(): void {
    this.canvas?.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext()
    this.host?.remove()
    this.host = null
    this.canvas = null
  }
}

//A square picture of an .hdr or .exr environment map
export async function environmentStill(url: string, side: number): Promise<Blob> {
  const texture = await decodeEquirect(url)
  const image = texture.image as { data: Uint16Array | Float32Array; width: number; height: number }
  const pixels = equirectPreview({ data: image.data, width: image.width, height: image.height, topFirst: texture.flipY }, side)
  texture.dispose()
  return pixelsStill(pixels, side, side, side, side)
}

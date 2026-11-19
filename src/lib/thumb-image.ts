//STILLS FOR THUMBNAILS, drawn in the admin's browser: what a canvas or a video
//shows, cropped to fill the asked frame and encoded. No 3D code here.

const STILL_TYPE = "image/webp"
const STILL_QUALITY = 0.9
//a video that gave no frame after this long has failed
const VIDEO_TIMEOUT_MS = 30_000

export interface Crop { x: number; y: number; width: number; height: number }

//The centred part of a source that fills a frame of this shape (width / height)
export function coverCrop(sourceWidth: number, sourceHeight: number, aspect: number): Crop {
  const width = Math.min(sourceWidth, sourceHeight * aspect)
  const height = width / aspect
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height }
}

//true when no pixel was drawn: every alpha is 0
export function isBlank(rgba: Uint8ClampedArray): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0) return false
  return true
}

//Draws the source so it fills width x height, and encodes the result.
//Throws when nothing was drawn: an empty picture is not a thumbnail.
export async function still(
  source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number,
): Promise<Blob> {
  if (!sourceWidth || !sourceHeight) throw new Error("the source has no size")
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("this browser gave no 2D canvas")
  const crop = coverCrop(sourceWidth, sourceHeight, width / height)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
  if (isBlank(ctx.getImageData(0, 0, width, height).data)) throw new Error("the picture came out empty")
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, STILL_TYPE, STILL_QUALITY))
  if (!blob) throw new Error("the browser could not encode the picture")
  return blob
}

//The same from RGBA pixels, top row first
export async function pixelsStill(
  pixels: Uint8ClampedArray<ArrayBuffer>, sourceWidth: number, sourceHeight: number, width: number, height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = sourceWidth
  canvas.height = sourceHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("this browser gave no 2D canvas")
  ctx.putImageData(new ImageData(pixels, sourceWidth, sourceHeight), 0, 0)
  return still(canvas, sourceWidth, sourceHeight, width, height)
}

//A WEBGL FRAME AS A PICTURE. The frame of a transparent canvas comes bottom
//row first, its colour multiplied by its alpha. Light added through glass is
//brighter than its alpha allows: the page shows it, a picture file cannot. Such
//a pixel becomes as opaque as its brightest channel, so it keeps its colour.
export function frameToPixels(frame: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(width * height * 4)
  const row = width * 4
  for (let y = 0; y < height; y++) {
    const from = (height - 1 - y) * row
    const to = y * row
    for (let x = 0; x < row; x += 4) {
      const r = frame[from + x]!, g = frame[from + x + 1]!, b = frame[from + x + 2]!
      const alpha = Math.max(frame[from + x + 3]!, r, g, b)
      if (alpha === 0) continue
      out[to + x] = (r * 255) / alpha
      out[to + x + 1] = (g * 255) / alpha
      out[to + x + 2] = (b * 255) / alpha
      out[to + x + 3] = alpha
    }
  }
  return out
}

//The frame in the middle of a video, as a square
export function videoFrame(url: string, side: number): Promise<Blob> {
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  return new Promise<Blob>((resolve, reject) => {
    //drops the download and the decoder
    const release = () => {
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
    }
    const fail = (reason: Error) => {
      release()
      reject(reason)
    }
    const timer = setTimeout(() => fail(new Error(`no frame after ${VIDEO_TIMEOUT_MS / 1000} s`)), VIDEO_TIMEOUT_MS)
    const draw = () => {
      still(video, video.videoWidth, video.videoHeight, side, side).then((blob) => {
        release()
        resolve(blob)
      }, fail)
    }
    video.addEventListener("error", () => fail(new Error(video.error?.message || `media error ${video.error?.code}`)), { once: true })
    video.addEventListener("seeked", draw, { once: true })
    //the first frame is there: go to the middle, or draw it when the length is unknown
    video.addEventListener("loadeddata", () => {
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration / 2
      else draw()
    }, { once: true })
    video.src = url
  })
}

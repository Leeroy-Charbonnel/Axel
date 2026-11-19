import { DataUtils } from "three"

//A PICTURE OF AN ENVIRONMENT MAP, computed on the CPU: no WebGL context and no
//float texture needed. The map is averaged down, looked at through a wide lens
//facing its centre, exposed on its average brightness, then tone mapped.

export interface EquirectSource {
  //half floats or floats, row after row, 1 to 4 channels a pixel
  data:     Uint16Array | Float32Array
  width:    number
  height:   number
  //true: the first row is the top of the picture
  topFirst: boolean
}

//the map is averaged down to about this width before it is looked at
const WORK_WIDTH = 1024
//horizontal field of view of the picture, degrees
const LENS_DEG = 100
//the brightness the average of the map is exposed to
const EXPOSURE_KEY = 0.3
//a dark part counts for at least this share of the mean: a black ground or
//a black studio does not burn the sky or the lamps
const DARK_FLOOR = 0.1
const LUMA = [0.2126, 0.7152, 0.0722] as const

interface Linear { rgb: Float32Array; width: number; height: number }

//Block average in linear light, top row first, always three channels
function averaged(source: EquirectSource): Linear {
  const { data, topFirst } = source
  const channels = Math.round(data.length / (source.width * source.height))
  if (channels < 1 || channels > 4) throw new Error(`an environment map with ${channels} channels cannot be drawn`)
  const half = data instanceof Uint16Array
  const k = Math.max(1, Math.floor(source.width / WORK_WIDTH))
  const width = Math.floor(source.width / k)
  const height = Math.floor(source.height / k)
  if (width < 1 || height < 1) throw new Error("the environment map is empty")
  const rgb = new Float32Array(width * height * 3)
  const read = (index: number) => {
    const v = half ? DataUtils.fromHalfFloat(data[index]!) : data[index]!
    //a broken pixel (NaN, infinite, negative) counts as black
    return Number.isFinite(v) && v > 0 ? v : 0
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0
      for (let j = 0; j < k; j++) {
        const row = y * k + j
        const line = (topFirst ? row : source.height - 1 - row) * source.width
        for (let i = 0; i < k; i++) {
          const at = (line + x * k + i) * channels
          const red = read(at)
          r += red
          //one or two channels: a grey map
          g += channels >= 3 ? read(at + 1) : red
          b += channels >= 3 ? read(at + 2) : red
        }
      }
      const out = (y * width + x) * 3
      const n = k * k
      rgb[out] = r / n
      rgb[out + 1] = g / n
      rgb[out + 2] = b / n
    }
  }
  return { rgb, width, height }
}

//The scale that brings the map's average brightness (a log average) to the
//key. It follows the map's own values, whatever their unit.
function exposureOf(image: Linear): number {
  const count = image.width * image.height
  const luma = new Float32Array(count)
  let total = 0
  for (let i = 0; i < count; i++) {
    const at = i * 3
    luma[i] = LUMA[0] * image.rgb[at]! + LUMA[1] * image.rgb[at + 1]! + LUMA[2] * image.rgb[at + 2]!
    total += luma[i]!
  }
  //an all-black map stays black
  if (total === 0) return 1
  const floor = (total / count) * DARK_FLOOR
  let logs = 0
  for (let i = 0; i < count; i++) logs += Math.log(luma[i]! + floor)
  return EXPOSURE_KEY / Math.exp(logs / count)
}

//linear 0..1 to an sRGB byte
function srgbByte(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

//A square RGBA picture, `side` pixels wide, of the map seen from its centre
//looking at the horizon in the middle of the image.
export function equirectPreview(source: EquirectSource, side: number): Uint8ClampedArray<ArrayBuffer> {
  const image = averaged(source)
  const exposure = exposureOf(image)
  const out = new Uint8ClampedArray(side * side * 4)
  const reach = Math.tan((LENS_DEG / 2) * Math.PI / 180)
  const { rgb, width, height } = image
  for (let y = 0; y < side; y++) {
    const dy = (1 - (2 * (y + 0.5)) / side) * reach
    for (let x = 0; x < side; x++) {
      const dx = ((2 * (x + 0.5)) / side - 1) * reach
      //the direction of this pixel, as a place on the map
      const u = (0.5 + Math.atan2(dx, 1) / (2 * Math.PI)) * width - 0.5
      const v = (0.5 - Math.atan2(dy, Math.hypot(dx, 1)) / Math.PI) * height - 0.5
      const x0 = Math.floor(u), y0 = Math.floor(v)
      const fx = u - x0, fy = v - y0
      //the map wraps around sideways, and stops at the poles
      const xa = ((x0 % width) + width) % width, xb = (xa + 1) % width
      const ya = Math.min(height - 1, Math.max(0, y0)), yb = Math.min(height - 1, Math.max(0, y0 + 1))
      const at = (y * side + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = rgb[(ya * width + xa) * 3 + c]! * (1 - fx) + rgb[(ya * width + xb) * 3 + c]! * fx
        const bottom = rgb[(yb * width + xa) * 3 + c]! * (1 - fx) + rgb[(yb * width + xb) * 3 + c]! * fx
        const lit = (top * (1 - fy) + bottom * fy) * exposure
        //Reinhard: the brightest parts fold under 1
        out[at + c] = srgbByte(lit / (1 + lit))
      }
      out[at + 3] = 255
    }
  }
  return out
}

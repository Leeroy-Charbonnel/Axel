//IMAGE DERIVATIVES, shared by the server route (server/images.ts) and the
//front (SiteImage.vue): the widths the server encodes and the URL that names one.
export const IMAGE_WIDTHS = [320, 640, 960, 1200, 1440, 1920]
export const IMAGE_FORMATS = ["webp", "jpeg"] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]

//width and height of each image in a payload, keyed by its /media URL
export type ImageSizes = Record<string, [number, number]>

//HOW WIDE EACH KIND OF IMAGE IS DRAWN, the `sizes` the browser picks a copy
//with. They follow the layout: a 1280px container (--site-max-width), one
//column up to 1024px, and the image tokens of style.css.
const CONTAINER = 1280
export const IMAGE_SIZES = {
  still:    `(max-width: 1024px) 100vw, ${Math.round(CONTAINER * 8 / 12)}px`,
  gallery:  "(max-width: 640px) 100vw, 360px",
  lightbox: "100vw",
  thumb:    "72px",
  avatar:   "96px",
  icon:     "18px",
  //a media library tile, --editor-media-tile and its share of the free space
  tile:     "200px",
}

//a detail-page block spans w of the 3 grid columns, one column on a phone
export function blockSizes(w: number): string {
  const share = Math.min(w, 3) / 3
  return `(max-width: 640px) 100vw, (max-width: ${CONTAINER}px) ${Math.round(share * 100)}vw, ${Math.round(CONTAINER * share)}px`
}

//an upload the server can resize: a still under /media/images. A GIF keeps
//its frames by being served as it is.
const DERIVABLE = /^\/media\/(images\/[0-9a-f-]{36}\.(?:jpe?g|png|webp|avif))$/

export function storedImage(url: string): string | null {
  return DERIVABLE.exec(url)?.[1] ?? null
}

export function derivativeUrl(stored: string, width: number, format: ImageFormat = "webp"): string {
  return `/media/${format}/${width}/${stored}`
}

//the widths worth offering for an image this wide: every smaller step, then
//one step that serves the image at its own width (the server never enlarges)
export function widthSteps(naturalWidth: number | null): Array<{ step: number; width: number }> {
  if (naturalWidth === null) return IMAGE_WIDTHS.map((w) => ({ step: w, width: w }))
  const steps = IMAGE_WIDTHS.filter((w) => w < naturalWidth).map((w) => ({ step: w, width: w }))
  const top = IMAGE_WIDTHS.find((w) => w >= naturalWidth)
  const widest = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!
  steps.push(top ? { step: top, width: naturalWidth } : { step: widest, width: widest })
  return steps
}

//IMAGE DERIVATIVES, shared by the server route (server/images.ts) and the
//front (SiteImage.vue): the widths the server encodes and the URL that names one.
export const IMAGE_WIDTHS = [320, 640, 960, 1200, 1440, 1920]
export const IMAGE_FORMATS = ["webp", "jpeg"] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]

//THUMBNAILS THE ADMIN'S BROWSER MAKES (server/thumbs.ts). A file's thumbnail is
//a square this many pixels wide: a library tile at twice its size.
export const THUMB_SIDE = 400
//A model's picture, also the poster of its viewer
export const MODEL_THUMB = { width: 960, height: 540 }

//Width and height of each image in a payload, keyed by its /media URL
export type ImageSizes = Record<string, [number, number]>

//HOW WIDE EACH KIND OF IMAGE IS DRAWN, the `sizes` the browser picks a copy
//with. They follow the layout: a 1280px container (--site-max-width), the
//project card's columns, and the image tokens of style.css.
const CONTAINER = 1280
//The project card stacks its columns up to this viewport width
const CARD_STACKED_MAX = 768
//The viewport width where the card reaches the full container
const CARD_FULL_VIEWPORT = 1400
//The card's media column: its share of the viewport, then its widest size
const CARD_MEDIA_VW = 50
const CARD_MEDIA_MAX = 700
export const IMAGE_SIZES = {
  still:    `(max-width: ${CARD_STACKED_MAX}px) 100vw, (max-width: ${CARD_FULL_VIEWPORT}px) ${CARD_MEDIA_VW}vw, ${CARD_MEDIA_MAX}px`,
  gallery:  "(max-width: 640px) 100vw, 360px",
  lightbox: "100vw",
  thumb:    "160px",
  avatar:   "96px",
  icon:     "18px",
  //A media library tile, --editor-media-tile and its share of the free space
  tile:     "200px",
}

//A detail-page block spans w of the page's columns, one column on a phone
export function blockSizes(w: number, cols: number): string {
  const share = Math.min(w, cols) / cols
  return `(max-width: 640px) 100vw, (max-width: ${CONTAINER}px) ${Math.round(share * 100)}vw, ${Math.round(CONTAINER * share)}px`
}

//An upload the server can resize: a still under {folder}/images. A GIF keeps
//its frames by being served as it is.
const DERIVABLE = /^\/media\/((?:(?:projects\/\d+|shared)\/)?images\/[0-9a-f-]{36}\.(?:jpe?g|png|webp|avif))$/

export function storedImage(url: string): string | null {
  return DERIVABLE.exec(url)?.[1] ?? null
}

export function derivativeUrl(stored: string, width: number, format: ImageFormat = "webp"): string {
  return `/media/${format}/${width}/${stored}`
}

//The step of the smallest copy at least `drawn` image pixels wide, or the widest one
export function stepFor(drawn: number, naturalWidth: number | null): number {
  const steps = widthSteps(naturalWidth)
  return (steps.find((s) => s.width >= drawn) ?? steps[steps.length - 1]!).step
}

//The widths worth offering for an image this wide: every smaller step, then
//one step that serves the image at its own width (the server never enlarges)
export function widthSteps(naturalWidth: number | null): Array<{ step: number; width: number }> {
  if (naturalWidth === null) return IMAGE_WIDTHS.map((w) => ({ step: w, width: w }))
  const steps = IMAGE_WIDTHS.filter((w) => w < naturalWidth).map((w) => ({ step: w, width: w }))
  const top = IMAGE_WIDTHS.find((w) => w >= naturalWidth)
  const widest = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!
  steps.push(top ? { step: top, width: naturalWidth } : { step: widest, width: widest })
  return steps
}

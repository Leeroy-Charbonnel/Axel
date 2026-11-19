import express from "express"
import sharp from "sharp"
import { HttpError } from "./errors"

//A PICTURE SENT BY THE ADMIN'S BROWSER (a thumbnail it drew, thumbs.ts). The
//body of the request is the picture. It is decoded and encoded again here: only
//a picture this server wrote is ever stored, never the bytes it was given.

//what a browser's canvas encodes to
const PICTURE_TYPES = ["image/webp", "image/png", "image/jpeg"]
const PICTURE_FORMATS = ["webp", "png", "jpeg"]
const PICTURE_MAX_BYTES = 4 * 1024 * 1024
//the most pixels a received picture may decode to
const PICTURE_MAX_PIXELS = 4096 * 4096

//the body parser of a route that receives a picture, after requireAdmin
export const pictureBody = express.raw({ type: PICTURE_TYPES, limit: PICTURE_MAX_BYTES })

export function receivedPicture(req: express.Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(415, `send the picture as the body, as ${PICTURE_TYPES.join(", ")}`)
  }
  return req.body
}

//The received picture as a WebP no side of which is longer than `side`, never enlarged
export async function encodePicture(bytes: Buffer, side: number): Promise<{ data: Buffer; width: number; height: number }> {
  try {
    const image = sharp(bytes, { limitInputPixels: PICTURE_MAX_PIXELS })
    const { format } = await image.metadata()
    if (!PICTURE_FORMATS.includes(format)) throw new Error(`a ${format} picture is not accepted`)
    const { data, info } = await image
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
  } catch (e) {
    throw new HttpError(400, `not a readable picture: ${e instanceof Error ? e.message : String(e)}`)
  }
}

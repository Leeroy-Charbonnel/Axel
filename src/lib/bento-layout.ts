import type { DetailBlock } from "../types/portfolio"

//BENTO LAYOUT - pure geometry of the detail-page grid, shared by the public
//render, the editor and the case-study builder. Desktop is 3 columns of rows with a
//minimum height that grow with their text; phone is one column whose rows come
//from mobileY / mobileH.

export type GridLayout = "desktop" | "phone"
export interface Rect { x: number; y: number; w: number; h: number }
export type Rects = Map<string, Rect>

export const GRID_COLS: Record<GridLayout, number> = { desktop: 3, phone: 1 }

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

//the phone layout is authored once every block carries its own row and span
export function phoneAuthored(blocks: DetailBlock[]): boolean {
  return blocks.length > 0 && blocks.every((b) => b.mobileY !== undefined && b.mobileH !== undefined)
}

//desktop reading order, row by row then left to right
export function readingOrder(blocks: DetailBlock[]): DetailBlock[] {
  return [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
}

//until the phone layout is authored, phones stack the blocks in reading order
export function layoutRects(blocks: DetailBlock[], layout: GridLayout): Rects {
  const rects: Rects = new Map()
  if (layout === "desktop") {
    for (const b of blocks) rects.set(b.id, { x: b.x, y: b.y, w: b.w, h: b.h })
    return rects
  }
  if (phoneAuthored(blocks)) {
    for (const b of blocks) rects.set(b.id, { x: 0, y: b.mobileY!, w: 1, h: b.mobileH! })
    return rects
  }
  let y = 0
  for (const b of readingOrder(blocks)) {
    rects.set(b.id, { x: 0, y, w: 1, h: b.h })
    y += b.h
  }
  return rects
}

//a row no block covers is taken out and the rows below move up: what the
//public page draws once the blocks it leaves out are gone
export function closeEmptyRows(rects: Rects): Rects {
  const covered = new Set<number>()
  for (const r of rects.values()) for (let y = r.y; y < r.y + r.h; y++) covered.add(y)
  const shift = (y: number) => {
    let empty = 0
    for (let row = 0; row < y; row++) if (!covered.has(row)) empty++
    return y - empty
  }
  const out: Rects = new Map()
  for (const [id, r] of rects) out.set(id, { ...r, y: shift(r.y) })
  return out
}

export function bottomOf(rects: Iterable<Rect>): number {
  let max = 0
  for (const r of rects) max = Math.max(max, r.y + r.h)
  return max
}

//first top-left cell, row by row, where a w x h block fits without overlap
export function firstFree(rects: Iterable<Rect>, cols: number, w: number, h: number): { x: number; y: number } {
  const taken = [...rects]
  const width = Math.min(w, cols)
  for (let y = 0; ; y++) {
    for (let x = 0; x + width <= cols; x++) {
      const candidate = { x, y, w: width, h }
      if (!taken.some((r) => overlaps(candidate, r))) return { x, y }
    }
  }
}

//the anchor keeps its place; every block it lands on moves down below it,
//and so on in reading order, so nothing ever overlaps and no gap is closed
export function reflow(rects: Rects, anchorId: string): Rects {
  const anchor = rects.get(anchorId)
  if (!anchor) throw new Error(`[bento] reflow anchor ${anchorId} is not in the layout`)
  const out: Rects = new Map([[anchorId, { ...anchor }]])
  const placed: Rect[] = [out.get(anchorId)!]
  const rest = [...rects.entries()]
    .filter(([id]) => id !== anchorId)
    .sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
  for (const [id, r] of rest) {
    const next = { ...r }
    let hit = placed.find((p) => overlaps(next, p))
    while (hit) {
      next.y = hit.y + hit.h
      hit = placed.find((p) => overlaps(next, p))
    }
    out.set(id, next)
    placed.push(next)
  }
  return out
}

//THE PHONE STACK - one column has no use for gaps or pushes: the anchor goes
//in before the first block whose middle it sits above, and the column is
//packed again from the top
export function restack(rects: Rects, anchorId: string): Rects {
  const anchor = rects.get(anchorId)
  if (!anchor) throw new Error(`[bento] restack anchor ${anchorId} is not in the layout`)
  const others = [...rects.entries()]
    .filter(([id]) => id !== anchorId)
    .sort(([, a], [, b]) => a.y - b.y)
  const out: Rects = new Map()
  let y = 0
  let placed = false
  for (const [id, r] of others) {
    if (!placed && anchor.y <= r.y + r.h / 2) {
      out.set(anchorId, { ...anchor, y })
      y += anchor.h
      placed = true
    }
    out.set(id, { ...r, y })
    y += r.h
  }
  if (!placed) out.set(anchorId, { ...anchor, y })
  return out
}

//writes a layout back onto the blocks; a phone write authors every block
export function writeRects(blocks: DetailBlock[], layout: GridLayout, rects: Rects): void {
  for (const b of blocks) {
    const r = rects.get(b.id)
    if (!r) throw new Error(`[bento] block ${b.id} has no rect in the ${layout} layout`)
    if (layout === "desktop") {
      b.x = r.x; b.y = r.y; b.w = r.w; b.h = r.h
    } else {
      b.mobileY = r.y; b.mobileH = r.h
    }
  }
}

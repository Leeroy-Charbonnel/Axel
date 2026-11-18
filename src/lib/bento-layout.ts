import type { DetailBlock } from "../types/portfolio"

//BENTO LAYOUT - pure geometry of the detail-page grid, shared by the public
//render, the editor and the case-study builder. Desktop is the page's columns of rows with a
//minimum height that grow with their text; phone is one column whose rows come
//from mobileY / mobileH.

export type GridLayout = "desktop" | "phone"
export interface Rect { x: number; y: number; w: number; h: number }
export type Rects = Map<string, Rect>

const PHONE_COLS = 1

//Columns of a layout: the page's own count on desktop, one on a phone
export function gridCols(layout: GridLayout, desktopCols: number): number {
  return layout === "desktop" ? desktopCols : PHONE_COLS
}

type Entry = [string, Rect]
const byReading = ([, a]: Entry, [, b]: Entry) => a.y - b.y || a.x - b.x

//Lays the rects down in the given order over the ones already placed: a rect
//that lands on another moves down below it, until it lands on none. With
//keepOrder, a rect never lands before the one laid down just before it.
function pushDown(out: Rects, placed: Rect[], ordered: Entry[], keepOrder: boolean): Rects {
  let prev: Rect | null = null
  for (const [id, r] of ordered) {
    const next = { ...r }
    if (keepOrder && prev && (next.y < prev.y || (next.y === prev.y && next.x < prev.x))) {
      next.y = next.x < prev.x ? prev.y + 1 : prev.y
    }
    let hit = placed.find((p) => overlaps(next, p))
    while (hit) {
      next.y = hit.y + hit.h
      hit = placed.find((p) => overlaps(next, p))
    }
    out.set(id, next)
    placed.push(next)
    prev = next
  }
  return out
}

//Every block fits in `cols` columns: too wide ones shrink, too far right ones
//move left, and a block that then lands on another moves down below it. The
//blocks keep their reading order.
export function fitToCols(rects: Rects, cols: number): Rects {
  const fitted = [...rects.entries()].sort(byReading).map(([id, r]): Entry => {
    const w = Math.min(r.w, cols)
    return [id, { ...r, w, x: Math.min(r.x, cols - w) }]
  })
  return pushDown(new Map(), [], fitted, true)
}

//A column edge of a `from`-column grid on a `to`-column grid
function scaleEdge(col: number, from: number, to: number): number {
  return Math.round(col * to / from)
}

//A span of a `from`-column grid on a `to`-column grid, never under one column
export function scaleSpan(w: number, from: number, to: number): number {
  return Math.max(1, scaleEdge(w, from, to))
}

//Every rect keeps its share of the width: a block on every column of `from` spans every column of `to`
function scaleRects(rects: Rects, from: number, to: number): Rects {
  const out: Rects = new Map()
  for (const [id, r] of rects) {
    const x = scaleEdge(r.x, from, to)
    out.set(id, { ...r, x, w: Math.max(1, scaleEdge(r.x + r.w, from, to) - x) })
  }
  return out
}

//Moves the desktop layout of the blocks from `from` to `to` columns, in place:
//each block keeps its share of the width, then the blocks are fitted
export function fitBlocks(blocks: DetailBlock[], from: number, to: number): void {
  writeRects(blocks, "desktop", fitToCols(scaleRects(layoutRects(blocks, "desktop"), from, to), to))
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

//The phone layout is authored once every block carries its own row and span
export function phoneAuthored(blocks: DetailBlock[]): boolean {
  return blocks.length > 0 && blocks.every((b) => b.mobileY !== undefined && b.mobileH !== undefined)
}

//Desktop reading order, row by row then left to right
export function readingOrder(blocks: DetailBlock[]): DetailBlock[] {
  return [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
}

//Until the phone layout is authored, phones stack the blocks in reading order
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

//A row no block covers is taken out and the rows below move up: what the
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

//First top-left cell, row by row, where a w x h block fits without overlap
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

//The anchor keeps its place; every block it lands on moves down below it,
//and so on in reading order, so nothing ever overlaps and no gap is closed
export function reflow(rects: Rects, anchorId: string): Rects {
  const anchor = rects.get(anchorId)
  if (!anchor) throw new Error(`[bento] reflow anchor ${anchorId} is not in the layout`)
  const placed = { ...anchor }
  const rest = [...rects.entries()].filter(([id]) => id !== anchorId).sort(byReading)
  return pushDown(new Map([[anchorId, placed]]), [placed], rest, false)
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

//Writes a layout back onto the blocks; a phone write authors every block
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

//Grid-template-rows, one track per row: a row that holds headings and nothing
//else is only as high as its title, every other row is at least minHeight and
//grows with its text. The public grid and the editor draw the same rows.
export function rowTracks(blocks: DetailBlock[], rects: Rects, rows: number, minHeight: string): string {
  const heading: boolean[] = Array.from({ length: rows }, () => false)
  const other: boolean[] = Array.from({ length: rows }, () => false)
  for (const b of blocks) {
    const r = rects.get(b.id)
    if (!r) continue
    for (let row = r.y; row < r.y + r.h && row < rows; row++) {
      if (b.type === "heading") heading[row] = true
      else other[row] = true
    }
  }
  return heading.map((h, row) => (h && !other[row] ? "auto" : `minmax(${minHeight}, auto)`)).join(" ")
}

//The first row at or below the bottom of a block that no block crosses: where
//a section can be slid in after it without cutting another block in two
export function rowAfter(rects: Rects, id: string): number {
  const r = rects.get(id)
  if (!r) throw new Error(`[bento] block ${id} has no rect`)
  let row = r.y + r.h
  for (let moved = true; moved;) {
    moved = false
    for (const o of rects.values()) {
      if (o.y < row && o.y + o.h > row) {
        row = o.y + o.h
        moved = true
      }
    }
  }
  return row
}

import { computed, onBeforeUnmount, shallowRef, type Ref } from "vue"
import {
  bottomOf, firstFree, fitBlocks, gridCols, layoutRects, phoneAuthored, reflow, restack, rowAfter, writeRects,
  type GridLayout, type Rect, type Rects,
} from "../lib/bento-layout"
import { pageSpan } from "../lib/project-sheet"
import { insertSection, type SectionPreset } from "../lib/section-presets"
import { blockType, newBlockId } from "../components/portfolio/detail/block-types"
import type { DetailBlock, DetailBlockType } from "../types/portfolio"

//THE BENTO EDITOR ENGINE - drag to move, drag the corner to resize, drag a
//type from the panel to create, arrows to nudge. Whatever lands on another
//block pushes it down (reflow), so a drop is never refused. While a pointer is
//down only a preview layout changes; the blocks are written once, on release,
//which makes every gesture a single undo step.

const NEW_ID = "__new__"
const DRAG_THRESHOLD_PX = 4
const MIN_ROWS = 8
const SPARE_ROWS = 2

type Mode = "move" | "resize" | "create"
interface Drag {
  mode:   Mode
  id:     string
  type:   DetailBlockType
  startX: number
  startY: number
  //For a move: which cell of the block the pointer grabbed
  grabX:  number
  grabY:  number
  moved:  boolean
}

export interface BentoGridOptions {
  blocks: Ref<DetailBlock[]>
  layout: Ref<GridLayout>
  //The page's desktop column count
  desktopCols: Readonly<Ref<number>>
  grid:   Ref<HTMLElement | null>
  select: (id: string | null) => void
  //A block picked on the canvas with the pointer
  pick:   (id: string) => void
  //Closes the history step, called before and after every write
  commit: () => void
}

export function useBentoGrid(o: BentoGridOptions) {
  const drag    = shallowRef<Drag | null>(null)
  const preview = shallowRef<Rects | null>(null)

  const cols  = computed(() => gridCols(o.layout.value, o.desktopCols.value))
  const saved = computed(() => layoutRects(o.blocks.value, o.layout.value))
  const rects = computed(() => preview.value ?? saved.value)
  const rows  = computed(() => Math.max(MIN_ROWS, bottomOf(rects.value.values()) + SPARE_ROWS))
  const phantom = computed(() => preview.value?.get(NEW_ID) ?? null)

  //POINTER TO CELL - the canvas may be scaled down to fit, so pixel offsets
  //are divided by the scale and measured against the resolved grid tracks;
  //rows grow with their text, so each one has its own height
  function cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const el = o.grid.value
    if (!el) return null
    const box = el.getBoundingClientRect()
    if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return null
    const scale = box.width / el.offsetWidth
    const css = getComputedStyle(el)
    const rowsPx = css.gridTemplateRows.split(" ").map(parseFloat)
    const colGap = parseFloat(css.columnGap)
    const rowGap = parseFloat(css.rowGap)
    if (![...rowsPx, colGap, rowGap].every(Number.isFinite)) {
      throw new Error("[bento] the canvas grid tracks did not resolve to pixels")
    }
    const colPx = (el.offsetWidth - (cols.value - 1) * colGap) / cols.value
    const px = (clientX - box.left) / scale
    const py = (clientY - box.top) / scale
    let y = 0
    let bottom = rowsPx[0]! + rowGap
    while (y < rowsPx.length - 1 && py >= bottom) {
      y += 1
      bottom += rowsPx[y]! + rowGap
    }
    return {
      x: Math.min(cols.value - 1, Math.max(0, Math.floor(px / (colPx + colGap)))),
      y,
    }
  }

  function withRect(id: string, r: Rect): Rects {
    const next: Rects = new Map(saved.value)
    next.set(id, r)
    return o.layout.value === "phone" ? restack(next, id) : reflow(next, id)
  }

  //WRITES
  function apply(next: Rects) {
    o.commit()
    writeRects(o.blocks.value, o.layout.value, next)
    o.commit()
  }

  function addBlock(type: DetailBlockType, at?: Rects) {
    o.commit()
    const def = blockType(type)
    const id = newBlockId()
    const all = o.blocks.value
    const block: DetailBlock = { id, type, x: 0, y: 0, w: def.size.w, h: def.size.h, content: def.create() }
    const desktop = layoutRects(all, "desktop")
    const phone = layoutRects(all, "phone")
    const place = (rs: Rects, layout: GridLayout): Rect => {
      const layoutCols = gridCols(layout, o.desktopCols.value)
      const w = pageSpan(def.size.w, layoutCols)
      return { ...firstFree(rs.values(), layoutCols, w, def.size.h), w, h: def.size.h }
    }
    const atRect = at?.get(NEW_ID)

    if (o.layout.value === "desktop") {
      const r = atRect ?? place(desktop, "desktop")
      Object.assign(block, { x: r.x, y: r.y, w: r.w, h: r.h })
      if (at) writeRects(all, "desktop", at)
      if (phoneAuthored(all)) Object.assign(block, { mobileY: bottomOf(phone.values()), mobileH: def.size.h })
      o.blocks.value = [...all, block]
    } else {
      const r = place(desktop, "desktop")
      Object.assign(block, { x: r.x, y: r.y, w: r.w, h: r.h })
      const nextPhone: Rects = at ? new Map(at) : new Map(phone)
      if (!at) nextPhone.set(NEW_ID, { x: 0, y: bottomOf(phone.values()), w: 1, h: def.size.h })
      nextPhone.set(id, nextPhone.get(NEW_ID)!)
      const next = [...all, block]
      writeRects(next, "phone", nextPhone)
      o.blocks.value = next
    }
    o.select(id)
    o.commit()
  }

  //A copy right under the block; what was below it moves down
  function duplicateBlock(id: string) {
    const all = o.blocks.value
    const src = all.find((b) => b.id === id)
    if (!src) throw new Error(`[bento] block ${id} not found`)
    o.commit()
    const copy: DetailBlock = { ...(JSON.parse(JSON.stringify(src)) as DetailBlock), id: newBlockId() }
    const desktop = layoutRects(all, "desktop")
    desktop.set(copy.id, { x: src.x, y: src.y + src.h, w: src.w, h: src.h })
    const next = [...all, copy]
    writeRects(next, "desktop", reflow(desktop, copy.id))
    if (phoneAuthored(all)) {
      const at = src.mobileY! + src.mobileH!
      for (const b of all) if (b.mobileY! >= at) b.mobileY = b.mobileY! + src.mobileH!
      copy.mobileY = at
    }
    o.blocks.value = next
    o.select(copy.id)
    o.commit()
  }

  //A whole section of the sheet, after the block's band, or at the end
  function addSection(preset: SectionPreset, afterId: string | null) {
    o.commit()
    const all = o.blocks.value
    const desktop = layoutRects(all, "desktop")
    const phone = layoutRects(all, "phone")
    const at = afterId
      ? { y: rowAfter(desktop, afterId), phoneY: rowAfter(phone, afterId) }
      : { y: bottomOf(desktop.values()), phoneY: bottomOf(phone.values()) }
    const next = insertSection(all, preset, newBlockId, at, o.desktopCols.value)
    o.blocks.value = next
    o.select(next[all.length]?.id ?? null)
    o.commit()
  }

  function removeBlock(id: string) {
    o.commit()
    o.blocks.value = o.blocks.value.filter((b) => b.id !== id)
    o.select(null)
    o.commit()
  }

  //KEYBOARD - arrows move the block one cell (on the phone stack: past the
  //neighbouring block), shift + arrows resize it
  function nudge(id: string, dx: number, dy: number, resize: boolean) {
    const r = saved.value.get(id)
    if (!r) return
    if (o.layout.value === "phone" && !resize) {
      if (!dy) return
      const order = [...saved.value.entries()].sort(([, a], [, b]) => a.y - b.y)
      const neighbour = order[order.findIndex(([k]) => k === id) + dy]?.[1]
      if (!neighbour) return
      apply(withRect(id, { ...r, y: dy > 0 ? neighbour.y + neighbour.h : neighbour.y }))
      return
    }
    const next = resize
      ? { ...r, w: Math.min(cols.value - r.x, Math.max(1, r.w + dx)), h: Math.max(1, r.h + dy) }
      : { ...r, x: Math.min(cols.value - r.w, Math.max(0, r.x + dx)), y: Math.max(0, r.y + dy) }
    if (next.x === r.x && next.y === r.y && next.w === r.w && next.h === r.h) return
    apply(withRect(id, next))
  }

  //Back to the automatic phone stack
  function resetPhone() {
    o.commit()
    for (const b of o.blocks.value) {
      delete b.mobileY
      delete b.mobileH
    }
    o.commit()
  }

  //POINTER GESTURES
  function begin(e: PointerEvent, d: Omit<Drag, "startX" | "startY" | "moved">) {
    e.preventDefault()
    drag.value = { ...d, startX: e.clientX, startY: e.clientY, moved: false }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    document.addEventListener("pointercancel", stop)
  }

  function startMove(e: PointerEvent, block: DetailBlock) {
    const r = saved.value.get(block.id)
    const cell = cellAt(e.clientX, e.clientY)
    if (!r || !cell) return
    begin(e, { mode: "move", id: block.id, type: block.type, grabX: cell.x - r.x, grabY: cell.y - r.y })
  }

  function startResize(e: PointerEvent, block: DetailBlock) {
    e.stopPropagation()
    begin(e, { mode: "resize", id: block.id, type: block.type, grabX: 0, grabY: 0 })
  }

  function startCreate(e: PointerEvent, type: DetailBlockType) {
    begin(e, { mode: "create", id: NEW_ID, type, grabX: 0, grabY: 0 })
  }

  function onMove(e: PointerEvent) {
    const d = drag.value
    if (!d) return
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD_PX) return
      drag.value = { ...d, moved: true }
    }
    const cell = cellAt(e.clientX, e.clientY)
    if (d.mode === "create") {
      if (!cell) { preview.value = null; return }
      const size = blockType(d.type).size
      const w = pageSpan(size.w, cols.value)
      preview.value = withRect(NEW_ID, { x: Math.min(cols.value - w, cell.x), y: cell.y, w, h: size.h })
      return
    }
    if (!cell) return
    const r = saved.value.get(d.id)!
    preview.value = d.mode === "move"
      ? withRect(d.id, { ...r, x: Math.min(cols.value - r.w, Math.max(0, cell.x - d.grabX)), y: Math.max(0, cell.y - d.grabY) })
      : withRect(d.id, { ...r, w: Math.min(cols.value - r.x, Math.max(1, cell.x - r.x + 1)), h: Math.max(1, cell.y - r.y + 1) })
  }

  function onUp() {
    const d = drag.value
    const next = preview.value
    stop()
    if (!d) return
    if (d.mode === "create") {
      if (next?.has(NEW_ID)) addBlock(d.type, next)
      else if (!d.moved) addBlock(d.type)
      return
    }
    if (!d.moved) {
      o.pick(d.id)
      return
    }
    if (next) apply(next)
  }

  function stop() {
    drag.value = null
    preview.value = null
    document.removeEventListener("pointermove", onMove)
    document.removeEventListener("pointerup", onUp)
    document.removeEventListener("pointercancel", stop)
  }

  onBeforeUnmount(stop)

  //A new column count: every block keeps its share of the width and fits in.
  //The caller commits around it, with the settings change, for one undo step
  function fitColumns(from: number, to: number) {
    fitBlocks(o.blocks.value, from, to)
  }

  return {
    fitColumns,
    drag, rects, rows, cols, phantom, duplicateBlock, addSection,
    startMove, startResize, startCreate,
    addBlock, removeBlock, nudge, resetPhone,
  }
}

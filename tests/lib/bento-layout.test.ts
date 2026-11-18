import { describe, expect, test } from "bun:test"
import { firstFree, fitToCols, gridCols, overlaps, type Rect, type Rects } from "../../src/lib/bento-layout"

const SEED = 42
const LAYOUT_COUNT = 200
const BLOCKS_PER_LAYOUT = 8
const SOURCE_COLS = 6
const MAX_H = 3

function rects(entries: [string, Rect][]): Rects {
  return new Map(entries)
}

//Same rects, keyed in id order, so key order never matters
function plain(layout: Rects): Record<string, Rect> {
  return Object.fromEntries([...layout].sort(([a], [b]) => a.localeCompare(b)))
}

function readingIds(layout: Rects): string[] {
  return [...layout].sort(([, a], [, b]) => a.y - b.y || a.x - b.x).map(([id]) => id)
}

//Small seeded random, so a failure always comes back the same
function random(seed: number): (max: number) => number {
  let state = seed
  return (max) => {
    state = (state * 16807) % 2147483647
    return state % max
  }
}

//Valid layouts in SOURCE_COLS columns, each block put on the first free cell
function sampleLayouts(): Rects[] {
  const next = random(SEED)
  const layouts: Rects[] = []
  for (let n = 0; n < LAYOUT_COUNT; n++) {
    const layout: Rects = new Map()
    for (let i = 0; i < BLOCKS_PER_LAYOUT; i++) {
      const w = 1 + next(SOURCE_COLS)
      const h = 1 + next(MAX_H)
      const { x, y } = firstFree(layout.values(), SOURCE_COLS, w, h)
      layout.set(`b${i}`, { x, y, w, h })
    }
    layouts.push(layout)
  }
  return layouts
}

function eachFit(check: (before: Rects, after: Rects, cols: number) => void): void {
  for (const layout of sampleLayouts()) {
    for (let cols = 1; cols <= SOURCE_COLS; cols++) check(layout, fitToCols(layout, cols), cols)
  }
}

describe("gridCols", () => {
  test("desktop uses the page's own count, phone always one", () => {
    expect(gridCols("desktop", 3)).toBe(3)
    expect(gridCols("desktop", 6)).toBe(6)
    expect(gridCols("phone", 3)).toBe(1)
    expect(gridCols("phone", 6)).toBe(1)
  })
})

describe("fitToCols", () => {
  test("keeps every block", () => {
    eachFit((before, after) => {
      expect([...after.keys()].sort()).toEqual([...before.keys()].sort())
    })
  })

  test("no two blocks overlap after fitting", () => {
    eachFit((_, after) => {
      const list = [...after.values()]
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) expect(overlaps(list[i]!, list[j]!)).toBe(false)
      }
    })
  })

  test("no two blocks overlap even when the input already overlaps", () => {
    const after = fitToCols(rects([
      ["a", { x: 0, y: 0, w: 2, h: 2 }],
      ["b", { x: 1, y: 1, w: 2, h: 2 }],
      ["c", { x: 0, y: 0, w: 3, h: 1 }],
    ]), 3)
    const list = [...after.values()]
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) expect(overlaps(list[i]!, list[j]!)).toBe(false)
    }
  })

  test("nothing goes past the last column", () => {
    eachFit((_, after, cols) => {
      for (const r of after.values()) {
        expect(r.x).not.toBeLessThan(0)
        expect(r.x + r.w).toBeLessThanOrEqual(cols)
      }
    })
  })

  test("widths only shrink, to the column count at most", () => {
    eachFit((before, after, cols) => {
      for (const [id, r] of after) expect(r.w).toBe(Math.min(before.get(id)!.w, cols))
    })
  })

  test("blocks move left or down, never right or up, and keep their height", () => {
    eachFit((before, after) => {
      for (const [id, r] of after) {
        const old = before.get(id)!
        expect(r.x).toBeLessThanOrEqual(old.x)
        expect(r.y).not.toBeLessThan(old.y)
        expect(r.h).toBe(old.h)
      }
    })
  })

  test("a layout that already fits is left as it is", () => {
    for (const layout of sampleLayouts()) {
      expect(plain(fitToCols(layout, SOURCE_COLS))).toEqual(plain(layout))
    }
  })

  test("fitting twice gives the same result", () => {
    eachFit((_, after, cols) => {
      expect(plain(fitToCols(after, cols))).toEqual(plain(after))
    })
  })

  test("a row of three narrow blocks wraps in reading order", () => {
    const after = fitToCols(rects([
      ["a", { x: 0, y: 0, w: 1, h: 1 }],
      ["b", { x: 1, y: 0, w: 1, h: 1 }],
      ["c", { x: 2, y: 0, w: 1, h: 1 }],
    ]), 2)
    expect(plain(after)).toEqual({
      a: { x: 0, y: 0, w: 1, h: 1 },
      b: { x: 1, y: 0, w: 1, h: 1 },
      c: { x: 1, y: 1, w: 1, h: 1 },
    })
    expect(readingIds(after)).toEqual(["a", "b", "c"])
  })

  test("a block wider than the grid shrinks to the full width", () => {
    const after = fitToCols(rects([["a", { x: 1, y: 0, w: 3, h: 2 }]]), 2)
    expect(after.get("a")).toEqual({ x: 0, y: 0, w: 2, h: 2 })
  })
})

describe("fitToCols reading order", () => {
  test("every sample layout keeps its reading order on every column count", () => {
    eachFit((before, after) => expect(readingIds(after)).toEqual(readingIds(before)))
  })

  test("blocks keep their reading order", () => {
    const before = rects([
      ["a", { x: 0, y: 0, w: 1, h: 3 }],
      ["b", { x: 1, y: 0, w: 2, h: 1 }],
      ["c", { x: 2, y: 1, w: 1, h: 1 }],
    ])
    expect(readingIds(fitToCols(before, 2))).toEqual(readingIds(before))
  })
})

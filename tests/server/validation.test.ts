import { describe, expect, test } from "bun:test"
import { detailBlock, detailGrid, mainProjectPatch } from "../../server/validation"
import { llmsFullTxt, projectPage } from "../../server/seo"
import { BLOCK_TYPES } from "../../src/components/portfolio/detail/block-types"
import { CASE_STUDY_VIEWS, caseStudyBlocks } from "../../src/lib/case-study"
import { sheetBlocks, type SheetMedia } from "../../src/lib/project-sheet"
import { SECTION_PRESETS, insertSection } from "../../src/lib/section-presets"
import { fitBlocks, fitToCols, layoutRects, overlaps, rowAfter, type Rects } from "../../src/lib/bento-layout"
import { DEFAULT_GRID, GRID_SETTINGS } from "../../src/lib/detail-grid"
import type { DetailBlock, MainProjectDto, PortfolioDto } from "../../src/types/portfolio"

const ID = "7004bd48-4c6b-43da-9bb3-c63a1e64e0cc"
const frame = { id: "b1", x: 0, y: 0, w: 1, h: 1 }

describe("detail block content schemas", () => {
  test("every block the editor creates, and every case-study block, is accepted", () => {
    for (const def of BLOCK_TYPES) {
      const result = detailBlock.safeParse({ ...frame, type: def.type, content: def.create() })
      expect(result.success).toBe(true)
    }
    //every shape, with and without an introduction, with every, some or no views
    //and steps of every aspect, starting on either side
    const text = { fr: "Texte", en: "Text" }
    const viewSets = [
      Object.fromEntries(CASE_STUDY_VIEWS.map((v) => [v, ID])),
      { "vp-clay": ID, "vp-front": ID, "vp-top": ID, "vp-textures": ID },
      { "vp-wire": ID, "vp-exploded": ID },
      {},
    ]
    const steps = [0.8, 1, 1.78, 1.5, 0.75].map((aspect, i) => ({
      media: { kind: i === 2 ? "video" as const : "image" as const, fileId: ID, aspect },
      title: text, text, section: i % 2 === 0 ? text : undefined,
    }))
    const pages = []
    for (const shape of ["tall", "wide", "compact"] as const)
      for (const intro of [text, null])
        for (const views of viewSets)
          for (const stepList of [steps, []])
            for (const startRight of [false, true])
              pages.push(caseStudyBlocks({
                modelId: ID, view: "Default", shape, mainId: ID, wireId: ID, detailIds: [ID, ID, ID],
                videoId: intro ? ID : null, views, intro, steps: stepList, outro: intro, startRight,
                evolution: intro ? [{ fileId: ID, label: text }, { fileId: ID, label: text }] : [],
              }))
    //a sheet with everything, and with each optional band missing in turn
    const img = { fileId: ID, caption: text }
    const full: SheetMedia = {
      modelId: ID, view: "Default", intro: text,
      plansId: ID,
      blocking: { levels: [img, img, img], videoId: ID, text },
      exploded: { fileId: ID, modelId: ID, legend: [text] },
      shaders: [{ title: text, steps: [img, img] }],
      materials: [{ fileId: ID, name: text, rows: [{ label: text, value: "0.35" }] }],
      maps: [img], uvId: ID, uvTexturedId: ID, process: [img, img], specs: [{ label: text, value: text }], outro: text,
    }
    const cuts: Partial<SheetMedia>[] = [
      {}, { intro: null, outro: null },
      { blocking: null }, { blocking: { levels: [img], videoId: null, text: null } },
      { blocking: { levels: [img, img], videoId: null, text } }, { blocking: { levels: [], videoId: ID, text: null } },
      { blocking: { levels: [], videoId: ID, text } },
      { exploded: null }, { exploded: { fileId: ID, modelId: null, legend: [] } },
      { shaders: [] },
      { materials: [] }, { maps: [] }, { uvId: null }, { uvId: null, uvTexturedId: null },
      { materials: [], maps: [], uvId: null, uvTexturedId: null }, { materials: [], uvTexturedId: null },
      { process: [] }, { specs: [] }, { specs: [], outro: null },
    ]
    for (const cut of cuts) pages.push(sheetBlocks({ ...full, ...cut }))
    //every section added to an empty page, at the end, and after a block mid-page
    let n = 0
    const newId = () => `new${++n}`
    const sheet = sheetBlocks(full)
    const mid = sheet[Math.floor(sheet.length / 2)]!
    for (const preset of SECTION_PRESETS) {
      pages.push(insertSection([], preset, newId, { y: 0, phoneY: 0 }, DEFAULT_GRID.cols))
      const at = { y: rowAfter(layoutRects(sheet, "desktop"), mid.id), phoneY: rowAfter(layoutRects(sheet, "phone"), mid.id) }
      pages.push(insertSection(sheet, preset, newId, at, DEFAULT_GRID.cols))
    }
    for (const blocks of pages) {
      expect(mainProjectPatch.safeParse({ detailPage: { blocks } }).success).toBe(true)
      //every cell of every row is covered exactly once: no hole, no overlap
      const height = Math.max(...blocks.map((b) => b.y + b.h))
      const cells = blocks.flatMap((b) => Array.from({ length: b.w * b.h }, (_, i) => `${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`))
      expect(new Set(cells).size).toBe(cells.length)
      expect(cells.length).toBe(height * DEFAULT_GRID.cols)
    }
  })

  test("a section on any column count is one band within the columns, with nothing over it", () => {
    let n = 0
    const newId = () => `s${++n}`
    const cols = GRID_SETTINGS.find((g) => g.key === "cols")!
    for (let count = cols.min; count <= cols.max; count++) {
      const grid = { ...DEFAULT_GRID, cols: count }
      //A page of one heading on every column, then a section after it
      const page = insertSection([], SECTION_PRESETS[0]!, newId, { y: 0, phoneY: 0 }, count)
      for (const preset of SECTION_PRESETS) {
        const top = rowAfter(layoutRects(page, "desktop"), page[0]!.id)
        const next = insertSection(page, preset, newId, { y: top, phoneY: 0 }, count)
        const added = next.slice(page.length)
        const bottom = Math.max(...added.map((b) => b.y + b.h))
        expect(mainProjectPatch.safeParse({ detailPage: { blocks: next, grid } }).success).toBe(true)
        expect(added.every((b) => b.y >= top && b.x + b.w <= count)).toBe(true)
        //The headings of the section span every column
        expect(added.filter((b) => b.type === "heading").every((b) => b.x === 0 && b.w === count)).toBe(true)
        //No block of the page lies in the section's rows
        expect(next.slice(0, page.length).every((b) => b.y + b.h <= top || b.y >= bottom)).toBe(true)
        const rects = layoutRects(next, "desktop")
        const all = [...rects.values()]
        expect(all.every((a, i) => all.every((b, j) => i === j || !overlaps(a, b)))).toBe(true)
      }
    }
  })
})

describe("detail grid", () => {
  test("fitToCols keeps every block within the columns without overlap", () => {
    const rects: Rects = new Map([
      ["a", { x: 0, y: 0, w: 3, h: 1 }],
      ["b", { x: 0, y: 1, w: 2, h: 2 }],
      ["c", { x: 2, y: 1, w: 1, h: 2 }],
      ["d", { x: 5, y: 3, w: 1, h: 1 }],
    ])
    for (const count of [1, 2, 3, 6]) {
      const fitted = [...fitToCols(rects, count).values()]
      expect(fitted.every((r) => r.x >= 0 && r.x + r.w <= count)).toBe(true)
      expect(fitted.every((a, i) => fitted.every((b, j) => i === j || !overlaps(a, b)))).toBe(true)
    }
  })

  test("a new column count keeps each block's share of the width, without overlap", () => {
    for (const [from, to] of [[3, 6], [3, 2], [3, 1], [6, 5], [5, 3], [2, 6]] as const) {
      const blocks = insertSection([], SECTION_PRESETS[0]!, () => crypto.randomUUID(), { y: 0, phoneY: 0 }, from)
      fitBlocks(blocks, from, to)
      expect(blocks.every((b) => b.x + b.w <= to)).toBe(true)
      expect(blocks.filter((b) => b.type === "heading").every((b) => b.x === 0 && b.w === to)).toBe(true)
      expect(blocks.every((a, i) => blocks.every((b, j) => i === j || !overlaps(a, b)))).toBe(true)
    }
  })

  test("the grid settings are held to their registry limits and step", () => {
    expect(detailGrid.safeParse(DEFAULT_GRID).success).toBe(true)
    for (const g of GRID_SETTINGS) {
      expect(detailGrid.safeParse({ ...DEFAULT_GRID, [g.key]: g.min - g.step }).success).toBe(false)
      expect(detailGrid.safeParse({ ...DEFAULT_GRID, [g.key]: g.max + g.step }).success).toBe(false)
      if (g.step > 1) expect(detailGrid.safeParse({ ...DEFAULT_GRID, [g.key]: g.min + 1 }).success).toBe(false)
    }
    expect(detailGrid.safeParse({ ...DEFAULT_GRID, extra: 1 }).success).toBe(false)
  })

  test("a block that ends past the page's last column is refused", () => {
    const block = { ...frame, type: "text", content: { text: { fr: "", en: "" } } }
    const page = (x: number, w: number, cols?: number) =>
      ({ detailPage: { blocks: [{ ...block, x, w }], ...(cols ? { grid: { ...DEFAULT_GRID, cols } } : {}) } })
    expect(mainProjectPatch.safeParse(page(0, DEFAULT_GRID.cols)).success).toBe(true)
    expect(mainProjectPatch.safeParse(page(1, DEFAULT_GRID.cols)).success).toBe(false)
    expect(mainProjectPatch.safeParse(page(4, 2, 6)).success).toBe(true)
    expect(mainProjectPatch.safeParse(page(1, 2, 2)).success).toBe(false)
  })

  test("a content that does not match its type is refused", () => {
    const refused = [
      { type: "text", content: {} },
      { type: "text", content: { text: "plain" } },
      { type: "heading", content: { text: { fr: "x" } } },
      { type: "specs", content: { rows: [{ label: { fr: "a", en: "a" } }] } },
      { type: "accordion", content: { items: "none" } },
      { type: "image", content: { fileId: "not-a-uuid", url: null } },
      { type: "image", content: { fileId: ID, url: "/media/x.jpg" } },
      { type: "button", content: { label: { fr: "", en: "" }, url: "javascript:alert(1)", newTab: true } },
      { type: "embed", content: { url: "data:text/html,x" } },
      { type: "viewer3d", content: { model3dId: ID, desktopView: "", mobileView: "", extra: 1 } },
      { type: "unknown", content: {} },
    ]
    for (const block of refused) expect(detailBlock.safeParse({ ...frame, ...block }).success).toBe(false)
  })
})

describe("seo with the optional fields absent", () => {
  test("an image without alt and a quote render", () => {
    const blocks = [
      { ...frame, id: "i", type: "image", content: { fileId: ID, url: "/media/images/a.jpg" } },
      { ...frame, id: "q", y: 1, type: "quote", content: { text: { fr: "Citation", en: "Quote" }, author: "" } },
    ] as DetailBlock[]
    const bi = { fr: "", en: "" }
    const project = {
      id: 1, title: { fr: "Projet", en: "Project" }, description: bi, role: bi, year: "", software: [],
      thumbnails: [], mainImageUrl: null, detailPage: { blocks },
    } as unknown as MainProjectDto
    const data = { mainProjects: [project], experiences: [], profile: null, images: {} } as unknown as PortfolioDto
    const page = projectPage(data, "https://example.test", "fr", 1)
    expect(page.status).toBe(200)
    expect(page.body.includes(`alt=""`)).toBe(true)
    expect(llmsFullTxt(data, "https://example.test").includes("> Citation")).toBe(true)
  })
})

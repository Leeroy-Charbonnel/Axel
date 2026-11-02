import { describe, expect, test } from "bun:test"
import { detailBlock, mainProjectPatch } from "../../server/validation"
import { llmsFullTxt, projectPage } from "../../server/seo"
import { BLOCK_TYPES } from "../../src/components/portfolio/detail/block-types"
import { CASE_STUDY_VIEWS, caseStudyBlocks } from "../../src/lib/case-study"
import { sheetBlocks, type SheetMedia } from "../../src/lib/project-sheet"
import { SECTION_PRESETS, insertSection } from "../../src/lib/section-presets"
import { layoutRects, rowAfter } from "../../src/lib/bento-layout"
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
      pages.push(insertSection([], preset, newId, { y: 0, phoneY: 0 }))
      const at = { y: rowAfter(layoutRects(sheet, "desktop"), mid.id), phoneY: rowAfter(layoutRects(sheet, "phone"), mid.id) }
      pages.push(insertSection(sheet, preset, newId, at))
    }
    for (const blocks of pages) {
      expect(mainProjectPatch.safeParse({ detailPage: { blocks } }).success).toBe(true)
      //every cell of every row is covered exactly once: no hole, no overlap
      const height = Math.max(...blocks.map((b) => b.y + b.h))
      const cells = blocks.flatMap((b) => Array.from({ length: b.w * b.h }, (_, i) => `${b.x + (i % b.w)},${b.y + Math.floor(i / b.w)}`))
      expect(new Set(cells).size).toBe(cells.length)
      expect(cells.length).toBe(height * 3)
    }
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

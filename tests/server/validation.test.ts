import { describe, expect, test } from "bun:test"
import { detailBlock, mainProjectPatch } from "../../server/validation"
import { llmsFullTxt, projectPage } from "../../server/seo"
import { BLOCK_TYPES } from "../../src/components/portfolio/detail/block-types"
import { caseStudyBlocks } from "../../src/lib/case-study"
import type { DetailBlock, MainProjectDto, PortfolioDto } from "../../src/types/portfolio"

const ID = "7004bd48-4c6b-43da-9bb3-c63a1e64e0cc"
const frame = { id: "b1", x: 0, y: 0, w: 1, h: 1 }

describe("detail block content schemas", () => {
  test("every block the editor creates, and every case-study block, is accepted", () => {
    for (const def of BLOCK_TYPES) {
      const result = detailBlock.safeParse({ ...frame, type: def.type, content: def.create() })
      expect(result.success).toBe(true)
    }
    const full = caseStudyBlocks({ modelId: ID, view: "Default", mainId: ID, wireId: ID, detailIds: [ID, ID], videoId: ID })
    const bare = caseStudyBlocks({ modelId: ID, view: "Default", mainId: ID, wireId: ID, detailIds: [], videoId: null })
    for (const blocks of [full, bare]) {
      expect(mainProjectPatch.safeParse({ detailPage: { blocks } }).success).toBe(true)
    }
    //bands follow each other: no row is left empty
    const rows = new Set(full.flatMap((b) => Array.from({ length: b.h }, (_, i) => b.y + i)))
    expect(rows.size).toBe(Math.max(...full.map((b) => b.y + b.h)))
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

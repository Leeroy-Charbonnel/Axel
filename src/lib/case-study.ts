import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType } from "../types/portfolio"

//CASE STUDY - the detail page of a project imported from a render folder
//(scripts/import-renders.ts), packed on the 3-column grid: the model next to
//its clay and wireframe views, the orthographic views, the exploded view with
//the topology and the texture maps, the render against its wireframe next to
//the turntable, and the details. A band takes the files the folder has and
//never leaves a hole. The page header already carries the description, the
//numbers, the role and the software, so the blocks repeat none of it.

export type CaseStudyView =
  | "vp-clay" | "vp-wire" | "vp-front" | "vp-side" | "vp-top"
  | "vp-exploded" | "vp-topology" | "vp-textures" | "screen"

export const CASE_STUDY_VIEWS: CaseStudyView[] = [
  "vp-clay", "vp-wire", "vp-front", "vp-side", "vp-top", "vp-exploded", "vp-topology", "vp-textures", "screen",
]

export interface CaseStudyMedia {
  modelId:   string
  view:      string
  mainId:    string
  wireId:    string
  detailIds: string[]
  videoId:   string | null
  //viewport views and extras, when the folder has them
  views:     Partial<Record<CaseStudyView, string>>
}

const bi = (fr: string, en: string): Bilingual => ({ fr, en })

const VIEW_ALT: Record<CaseStudyView, Bilingual> = {
  "vp-clay":     bi("Vue argile", "Clay view"),
  "vp-wire":     bi("Topologie sur le modèle", "Topology over the model"),
  "vp-front":    bi("Vue de face", "Front view"),
  "vp-side":     bi("Vue de profil", "Side view"),
  "vp-top":      bi("Vue de dessus", "Top view"),
  "vp-exploded": bi("Vue éclatée", "Exploded view"),
  "vp-topology": bi("Détail de la topologie", "Topology close-up"),
  "vp-textures": bi("Maps PBR", "PBR maps"),
  "screen":      bi("L'écran en fonctionnement", "The screen running"),
}

interface Tile {
  type:    DetailBlockType
  content: DetailBlockContent
}

export function caseStudyBlocks(m: CaseStudyMedia): DetailBlock[] {
  const blocks: DetailBlock[] = []
  let n = 0
  let y = 0
  let phoneY = 0
  function place(t: Tile, x: number, top: number, w: number, h: number, phoneH: number) {
    blocks.push({ id: `cs${++n}`, type: t.type, x, y: top, w, h, mobileY: phoneY, mobileH: phoneH, content: t.content })
    phoneY += phoneH
  }
  const image = (name: CaseStudyView): Tile | null => {
    const fileId = m.views[name]
    return fileId ? { type: "image", content: { fileId, url: null, alt: VIEW_ALT[name], fit: "cover" } } : null
  }
  const present = (tiles: (Tile | null)[]) => tiles.filter((t): t is Tile => t !== null)

  function heading(fr: string, en: string) {
    place({ type: "heading", content: { text: bi(fr, en) } }, 0, y, 3, 1, 1)
    y += 1
  }
  //a large tile on two columns with up to two small ones stacked beside it
  function pair(main: Tile, smalls: Tile[], mainPhoneH: number) {
    if (smalls.length === 0) {
      place(main, 0, y, 3, 3, mainPhoneH)
      y += 3
      return
    }
    place(main, 0, y, 2, 2, mainPhoneH)
    if (smalls.length === 1) place(smalls[0]!, 2, y, 1, 2, 1)
    else smalls.slice(0, 2).forEach((t, i) => place(t, 2, y + i, 1, 1, 1))
    y += 2
  }
  //one row of up to three tiles sharing the width
  function row(tiles: Tile[]) {
    if (!tiles.length) return
    const widths = tiles.length === 1 ? [3] : tiles.length === 2 ? [1, 2] : [1, 1, 1]
    let x = 0
    tiles.slice(0, 3).forEach((t, i) => {
      place(t, x, y, widths[i]!, 1, 1)
      x += widths[i]!
    })
    y += 1
  }

  heading("Le modèle", "The model")
  pair(
    { type: "viewer3d", content: { model3dId: m.modelId, desktopView: m.view, mobileView: m.view } },
    present([image("vp-clay"), image("vp-wire")]),
    2,
  )
  row(present([image("vp-front"), image("vp-side"), image("vp-top")]))

  const exploded = image("vp-exploded")
  const making = present([image("vp-topology"), image("vp-textures")])
  if (exploded || making.length) {
    heading("Construction", "Construction")
    if (exploded) pair(exploded, making, 1)
    else row(making)
  }

  heading("Rendus", "Renders")
  const video: Tile | null = m.videoId
    ? { type: "video", content: { fileId: m.videoId, url: null, autoplay: true, loop: true, muted: true, controls: false } }
    : null
  pair(
    { type: "compare", content: {
      beforeFileId: m.wireId, beforeUrl: null, afterFileId: m.mainId, afterUrl: null,
      beforeLabel: bi("Fil de fer", "Wireframe"), afterLabel: bi("Rendu", "Render"), followMouse: false,
    } },
    present([video, image("screen")]),
    2,
  )
  row(m.detailIds.slice(0, 3).map((fileId) => ({ type: "image", content: { fileId, url: null, fit: "cover" } })))
  return blocks
}

import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType } from "../types/portfolio"

//CASE STUDY - the detail page of a project imported from a render folder
//(scripts/import-renders.ts): the model, the wireframe against the render, the
//details and the turntable. The page header already carries the description,
//the numbers, the role and the software, so the blocks repeat none of it, and
//no text is invented here beyond the section titles.

export interface CaseStudyMedia {
  modelId:   string
  view:      string
  mainId:    string
  wireId:    string
  detailIds: string[]
  videoId:   string | null
}

const bi = (fr: string, en: string): Bilingual => ({ fr, en })

export function caseStudyBlocks(m: CaseStudyMedia): DetailBlock[] {
  const blocks: DetailBlock[] = []
  let n = 0
  //desktop: full-width bands from the top; phone: the same order, one column
  let y = 0
  let phoneY = 0
  function add(type: DetailBlockType, h: number, content: DetailBlockContent, phoneH = h) {
    blocks.push({ id: `cs${++n}`, type, x: 0, y, w: 3, h, mobileY: phoneY, mobileH: phoneH, content })
    y += h
    phoneY += phoneH
  }

  add("heading", 1, { text: bi("Le modèle", "The model") })
  add("viewer3d", 3, { model3dId: m.modelId, desktopView: m.view, mobileView: m.view }, 2)
  add("heading", 1, { text: bi("Topologie", "Topology") })
  add("compare", 3, {
    beforeFileId: m.wireId, beforeUrl: null, afterFileId: m.mainId, afterUrl: null,
    beforeLabel: bi("Fil de fer", "Wireframe"), afterLabel: bi("Rendu", "Render"), followMouse: false,
  }, 2)
  if (m.detailIds.length) {
    add("heading", 1, { text: bi("Détails", "Details") })
    add("carousel", 3, { intervalMs: 0, items: m.detailIds.map((fileId) => ({ fileId, url: null })) }, 2)
  }
  if (m.videoId) {
    add("heading", 1, { text: bi("Turntable", "Turntable") })
    add("video", 3, { fileId: m.videoId, url: null, autoplay: true, loop: true, muted: true, controls: false }, 2)
  }
  if (m.detailIds.length > 1) {
    add("marquee", 1, { speedPxs: 40, items: [m.mainId, ...m.detailIds].map((fileId) => ({ fileId, url: null })) })
  }
  return blocks
}

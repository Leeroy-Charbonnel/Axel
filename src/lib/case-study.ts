import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType, ProjectStats } from "../types/portfolio"

//CASE STUDY - the detail page of a project imported from a render folder
//(scripts/import-renders.ts): the model, its numbers, the wireframe against the
//render, the details and the turntable. Only facts the folder carries: no text
//is invented here beyond the section titles.

export interface CaseStudyMedia {
  modelId:     string
  view:        string
  mainId:      string
  wireId:      string
  detailIds:   string[]
  videoId:     string | null
  description: Bilingual
  role:        Bilingual
  year:        string
  software:    string[]
  stats:       ProjectStats
}

const bi = (fr: string, en: string): Bilingual => ({ fr, en })
const same = (v: string): Bilingual => ({ fr: v, en: v })
const count = (n: number | undefined, locale: string) => (n === undefined ? "" : n.toLocaleString(locale))

export function caseStudyBlocks(m: CaseStudyMedia): DetailBlock[] {
  const blocks: DetailBlock[] = []
  let n = 0
  //desktop: rows from the top, each band starting under the previous one;
  //phone: one column in reading order
  let y = 0
  let phoneY = 0
  function add(type: DetailBlockType, [x, w, h]: [number, number, number], content: DetailBlockContent, phoneH = h) {
    blocks.push({ id: `cs${++n}`, type, x, y, w, h, mobileY: phoneY, mobileH: phoneH, content })
    phoneY += phoneH
  }
  function band(rows: number, fill: () => void) {
    fill()
    y += rows
  }

  band(1, () => add("heading", [0, 3, 1], { text: bi("Le modèle", "The model") }))
  band(3, () => {
    add("viewer3d", [0, 2, 3], { model3dId: m.modelId, desktopView: m.view, mobileView: m.view }, 2)
    add("text", [2, 1, 3], { text: m.description }, 2)
  })
  band(1, () => add("counters", [0, 3, 1], { items: [
    { label: bi("Sommets", "Vertices"), value: m.stats.vertices },
    ...(m.stats.faces === undefined ? [] : [{ label: bi("Faces", "Faces"), value: m.stats.faces }]),
    ...(m.stats.triangles === undefined ? [] : [{ label: bi("Triangles", "Triangles"), value: m.stats.triangles }]),
  ] }, 2))

  band(1, () => add("heading", [0, 3, 1], { text: bi("Topologie", "Topology") }))
  band(2, () => {
    add("compare", [0, 2, 2], {
      beforeFileId: m.wireId, beforeUrl: null, afterFileId: m.mainId, afterUrl: null,
      beforeLabel: bi("Fil de fer", "Wireframe"), afterLabel: bi("Rendu", "Render"), followMouse: false,
    })
    add("specs", [2, 1, 2], { rows: [
      { label: bi("Faces", "Faces"),         value: { fr: count(m.stats.faces, "fr-FR"), en: count(m.stats.faces, "en-US") } },
      { label: bi("Triangles", "Triangles"), value: { fr: count(m.stats.triangles, "fr-FR"), en: count(m.stats.triangles, "en-US") } },
      { label: bi("Logiciels", "Software"),  value: same(m.software.join(", ")) },
      { label: bi("Rôle", "Role"),           value: m.role },
      { label: bi("Année", "Year"),          value: same(m.year) },
    ].filter((row) => row.value.fr !== "") }, 3)
  })

  if (m.detailIds.length) {
    band(1, () => add("heading", [0, 3, 1], { text: bi("Détails", "Details") }))
    band(3, () => add("carousel", [0, 3, 3], { intervalMs: 0, items: m.detailIds.map((fileId) => ({ fileId, url: null })) }, 2))
  }
  if (m.videoId) {
    const videoId = m.videoId
    band(1, () => add("heading", [0, 3, 1], { text: bi("Turntable", "Turntable") }))
    band(3, () => add("video", [0, 3, 3], { fileId: videoId, url: null, autoplay: true, loop: true, muted: true, controls: false }, 2))
  }
  if (m.detailIds.length > 1) {
    band(1, () => add("marquee", [0, 3, 1], { speedPxs: 40, items: [m.mainId, ...m.detailIds].map((fileId) => ({ fileId, url: null })) }))
  }
  return blocks
}

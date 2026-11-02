import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType } from "../types/portfolio"

//CASE STUDY - the detail page of a project imported from a render folder
//(scripts/import-renders.ts), told as a making-of on the 3-column grid:
//- an opening that follows the object's silhouette: a tall object gets a
//  narrow, tall viewer beside the introduction, a wide one a wide viewer above
//  it, a compact one a large viewer with the text at its side;
//- the making-of, in titled sections (references, blocking, modelling,
//  materials...): each step's image or video sized by its own aspect, its text
//  beside it, the sides alternating from one step to the next;
//- without a making-of, the working views (orthographic, exploded, clay,
//  topology, maps) stand in for it;
//- the renders (wireframe comparison, turntable, details), the evolution
//  carousel (the same view from blocking to final render) and the closing words.
//A band takes what the folder has and never leaves a hole. The page header
//already carries the description, the numbers, the role and the software.

export type ModelShape = "tall" | "wide" | "compact"

export type CaseStudyView =
  | "vp-clay" | "vp-wire" | "vp-front" | "vp-side" | "vp-top"
  | "vp-exploded" | "vp-topology" | "vp-textures" | "screen"

export const CASE_STUDY_VIEWS: CaseStudyView[] = [
  "vp-clay", "vp-wire", "vp-front", "vp-side", "vp-top", "vp-exploded", "vp-topology", "vp-textures", "screen",
]

export interface CaseStudyMediaFile {
  kind:   "image" | "video"
  fileId: string
  //width / height
  aspect: number
}

export interface CaseStudyStep {
  media:    CaseStudyMediaFile
  title:    Bilingual
  text:     Bilingual
  //opens a new section of the making-of under this title
  section?: Bilingual
}

export interface CaseStudyMedia {
  modelId:   string
  view:      string
  shape:     ModelShape
  mainId:    string
  wireId:    string
  detailIds: string[]
  videoId:   string | null
  views:     Partial<Record<CaseStudyView, string>>
  intro:     Bilingual | null
  steps:     CaseStudyStep[]
  outro:     Bilingual | null
  //the same view at each stage, from blocking to final render
  evolution: { fileId: string; label: Bilingual }[]
  //which side the first making-of image takes, so two pages do not open alike
  startRight: boolean
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

//a step's text as markdown: its title, then its paragraph
const stepText = (s: CaseStudyStep): Bilingual => ({
  fr: `### ${s.title.fr}\n\n${s.text.fr}`,
  en: `### ${s.title.en}\n\n${s.text.en}`,
})

export function caseStudyBlocks(m: CaseStudyMedia): DetailBlock[] {
  const blocks: DetailBlock[] = []
  let n = 0
  let y = 0
  let phoneY = 0
  function place(t: Tile, x: number, top: number, w: number, h: number, phoneH: number) {
    blocks.push({ id: `cs${++n}`, type: t.type, x, y: top, w, h, mobileY: phoneY, mobileH: phoneH, content: t.content })
    phoneY += phoneH
  }
  const viewImage = (name: CaseStudyView): Tile | null => {
    const fileId = m.views[name]
    return fileId ? { type: "image", content: { fileId, url: null, alt: VIEW_ALT[name], fit: "cover" } } : null
  }
  const present = (tiles: (Tile | null)[]) => tiles.filter((t): t is Tile => t !== null)
  const text = (b: Bilingual): Tile => ({ type: "text", content: { text: b } })

  function heading(fr: string, en: string) {
    place({ type: "heading", content: { text: bi(fr, en) } }, 0, y, 3, 1, 1)
    y += 1
  }
  //a large tile on two columns with up to two small ones stacked at its right
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

  //OPENING - the viewer shaped like the object, the introduction beside it
  const viewer: Tile = { type: "viewer3d", content: { model3dId: m.modelId, desktopView: m.view, mobileView: m.view } }
  const intro = m.intro ? text(m.intro) : null
  const side = present([viewImage("vp-clay"), viewImage("vp-wire")]).slice(0, 2)
  if (m.shape === "tall") {
    //four rows: the viewer on one column, the introduction and the side views on two
    place(viewer, 0, y, 1, 4, 3)
    const sideTop = intro ? y + 2 : y
    const sideH = intro ? 2 : 4
    if (intro) place(intro, 1, y, 2, side.length ? 2 : 4, 2)
    if (side.length === 2) side.forEach((t, i) => place(t, 1 + i, sideTop, 1, sideH, 1))
    else if (side.length === 1) place(side[0]!, 1, sideTop, 2, sideH, 1)
    else if (!intro) blocks[blocks.length - 1]!.w = 3
    y += 4
  } else if (m.shape === "wide") {
    place(viewer, 0, y, 3, 2, 2)
    y += 2
    if (intro) {
      place(intro, 0, y, side.length ? 2 : 3, 2, 2)
      side.slice(0, 2).forEach((t, i) => place(t, 2, y + i, 1, side.length === 1 ? 2 : 1, 1))
      y += 2
    } else row(side)
  } else if (intro) {
    place(viewer, 0, y, 2, 3, 2)
    place(intro, 2, y, 1, 3, 2)
    y += 3
    row(side)
  } else {
    pair(viewer, side, 2)
  }

  //MAKING-OF - media and text side by side, the media sized by its aspect
  if (m.steps.length && !m.steps[0]!.section) heading("Conception", "Making-of")
  m.steps.forEach((s, i) => {
    if (s.section) heading(s.section.fr, s.section.en)
    const portrait = s.media.aspect < 0.95
    const square = !portrait && s.media.aspect < 1.25
    const mediaW = portrait || square ? 1 : 2
    const h = portrait ? 3 : 2
    const mediaLeft = (i % 2 === 0) !== m.startRight
    const media: Tile = s.media.kind === "video"
      ? { type: "video", content: { fileId: s.media.fileId, url: null, autoplay: true, loop: true, muted: true, controls: false } }
      //shown whole: a plan, a blocking note or a node graph must not lose an edge
      : { type: "image", content: { fileId: s.media.fileId, url: null, alt: s.title, fit: "contain" } }
    place(media, mediaLeft ? 0 : 3 - mediaW, y, mediaW, h, portrait ? 3 : 2)
    place(text(stepText(s)), mediaLeft ? mediaW : 0, y, 3 - mediaW, h, 2)
    y += h
  })

  //WORKING VIEWS - without a making-of: the orthographic set, then the
  //exploded view with its close-ups
  const ortho = present([viewImage("vp-front"), viewImage("vp-side"), viewImage("vp-top")])
  const exploded = viewImage("vp-exploded")
  const making = present([viewImage("vp-topology"), viewImage("vp-textures")])
  if (!m.steps.length && (ortho.length || exploded || making.length)) {
    heading("Vues de travail", "Working views")
    row(ortho)
    if (exploded) pair(exploded, making, 1)
    else row(making)
  }

  //RENDERS - the wireframe comparison beside the turntable, then the details
  heading("Rendus", "Renders")
  const video: Tile | null = m.videoId
    ? { type: "video", content: { fileId: m.videoId, url: null, autoplay: true, loop: true, muted: true, controls: false } }
    : null
  pair(
    { type: "compare", content: {
      beforeFileId: m.wireId, beforeUrl: null, afterFileId: m.mainId, afterUrl: null,
      beforeLabel: bi("Fil de fer", "Wireframe"), afterLabel: bi("Rendu", "Render"), followMouse: false,
    } },
    present([video, viewImage("screen")]),
    2,
  )
  row(m.detailIds.slice(0, 3).map((fileId) => ({ type: "image", content: { fileId, url: null, fit: "cover" } })))

  if (m.evolution.length) {
    heading("Évolution", "Evolution")
    place({ type: "carousel", content: {
      intervalMs: 0,
      items: m.evolution.map((e) => ({ fileId: e.fileId, url: null, caption: e.label })),
    } }, 0, y, 3, 3, 2)
    y += 3
  }

  if (m.outro) {
    place(text(m.outro), 0, y, 3, 1, 2)
    y += 1
  }
  return blocks
}

import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType, MaterialItem, Viewer3dLook } from "../types/portfolio"
import { fitBlocks, scaleSpan } from "./bento-layout"
import { DEFAULT_GRID } from "./detail-grid"

//PROJECT SHEET - the detail page of a project imported with a technical plan
//(scripts/import-renders.ts, sheet/sheet.json), drawn on three columns and
//scaled to the page's own count: plans beside the model in blueprint, the
//blocking, the exploded view and its nomenclature, the shaders step by step,
//materials and maps, the production stages, then the specifications. A band
//takes what it is given and never leaves a hole. The page head already
//carries the title, the numbers and the thumbnails.
//The bands are shared with the editor's section presets (section-presets.ts):
//a section added by hand is laid out exactly as an imported one.

//The columns a band is drawn on
export const SHEET_COLS = 3

//A span of the sheet on a page of `cols` columns
export function pageSpan(w: number, cols: number): number {
  return scaleSpan(w, SHEET_COLS, cols)
}

export interface SheetImage {
  fileId:  string
  caption: Bilingual
}

export interface SheetMedia {
  modelId:   string
  view:      string
  intro:     Bilingual | null
  plansId:   string
  //From the roughest pass to the refined one
  blocking:  { levels: SheetImage[]; videoId: string | null; text: Bilingual | null } | null
  //The model saved apart, with its numbered marks; without it, the drawing
  exploded:  { fileId: string; modelId: string | null; legend: Bilingual[] } | null
  //One row of squares per shader, under its own title
  shaders:   { title: Bilingual; steps: SheetImage[] }[]
  materials: Omit<MaterialItem, "url">[]
  maps:      SheetImage[]
  //The UV layout as lines, and the same layout over the colour texture
  uvId:      string | null
  uvTexturedId: string | null
  process:   SheetImage[]
  specs:     { label: Bilingual; value: Bilingual }[]
  outro:     Bilingual | null
}

export interface Tile {
  type:    DetailBlockType
  content: DetailBlockContent
}

const bi = (fr: string, en: string): Bilingual => ({ fr, en })
const present = (tiles: (Tile | null)[]) => tiles.filter((t): t is Tile => t !== null)

//WRITER - lays tiles down the sheet from row 0, desktop and phone together,
//then hands them over on the page's own columns
export class SheetWriter {
  readonly blocks: DetailBlock[] = []
  y = 0
  private phoneY = 0

  private readonly newId: () => string
  private readonly cols: number

  constructor(newId: () => string, cols: number) {
    this.newId = newId
    this.cols = cols
  }

  place(t: Tile, x: number, top: number, w: number, h: number, phoneH: number) {
    this.blocks.push({ id: this.newId(), type: t.type, x, y: top, w, h, mobileY: this.phoneY, mobileH: phoneH, content: t.content })
    this.phoneY += phoneH
  }
  heading(text: Bilingual) {
    this.place({ type: "heading", content: { text } }, 0, this.y, SHEET_COLS, 1, 1)
    this.y += 1
  }
  //A large tile on two columns, up to two tiles stacked at its right
  pair(main: Tile, side: Tile[]) {
    if (side.length === 0) {
      this.place(main, 0, this.y, SHEET_COLS, 2, 2)
      this.y += 2
      return
    }
    const sideX = SHEET_COLS - 1
    this.place(main, 0, this.y, sideX, 2, 2)
    if (side.length === 1) this.place(side[0]!, sideX, this.y, 1, 2, 2)
    else side.slice(0, 2).forEach((t, i) => this.place(t, sideX, this.y + i, 1, 1, 1))
    this.y += 2
  }
  //Up to three tiles sharing a row: one takes it all, two split one and two
  row(tiles: Tile[], h: number) {
    if (!tiles.length) return
    const widths = tiles.length === 1 ? [SHEET_COLS] : tiles.length === 2 ? [1, SHEET_COLS - 1] : [1, 1, 1]
    let x = 0
    tiles.slice(0, SHEET_COLS).forEach((t, i) => {
      this.place(t, x, this.y, widths[i]!, h, h)
      x += widths[i]!
    })
    this.y += h
  }
  //The blocks on the page's columns: tiles a narrow page squeezes together stack instead
  fitted(): DetailBlock[] {
    fitBlocks(this.blocks, SHEET_COLS, this.cols)
    return this.blocks
  }
}

//BANDS - one per section of the sheet, each under its heading

//The drawing beside the model in the same black and white
export function bandPlans(w: SheetWriter, drawing: Tile, viewer: Tile) {
  w.heading(bi("Plans techniques", "Technical drawings"))
  w.pair(drawing, [viewer])
}

//The passes side by side, the motion test and the words beside them
export function bandBlocking(w: SheetWriter, levels: Tile | null, video: Tile | null, text: Tile | null) {
  w.heading(bi("Blocking", "Blocking"))
  const side = present([video, text])
  if (levels) w.pair(levels, side)
  else w.row(side, 2)
}

//The parts set apart, numbered, and their nomenclature beside them
export function bandExploded(w: SheetWriter, view: Tile, legend: Tile | null) {
  w.heading(bi("Vue éclatée", "Exploded view"))
  w.pair(view, present([legend]))
}

//Each shader built square by square, its name beside its squares
export function bandShaders(w: SheetWriter, rows: { title: Tile; squares: Tile }[]) {
  w.heading(bi("Shaders", "Shaders"))
  for (const r of rows) w.row([r.title, r.squares], 1)
}

//The swatches down the left, the maps and the UV layouts beside them
export function bandMaterials(w: SheetWriter, swatches: Tile | null, maps: Tile | null, uvs: Tile[]) {
  w.heading(bi("Matériaux et textures", "Materials and textures"))
  if (swatches && maps && uvs.length) {
    const right = SHEET_COLS - 1
    w.place(swatches, 0, w.y, 1, 3, 2)
    w.place(maps, 1, w.y, right, 1, 1)
    //One layout on both columns, or the two side by side
    uvs.slice(0, right).forEach((t, i) => w.place(t, 1 + i, w.y + 1, uvs.length === 1 ? right : 1, 2, 2))
    w.y += 3
  } else {
    w.row(present([swatches, maps]), 2)
    w.row(uvs, 2)
  }
}

//The same view at each stage
export function bandProcess(w: SheetWriter, stages: Tile) {
  w.heading(bi("Processus de production", "Production process"))
  w.row([stages], 1)
}

export function bandSpecs(w: SheetWriter, specs: Tile | null, text: Tile | null) {
  w.heading(bi("Spécifications", "Specifications"))
  w.row(present([specs, text]), 1)
}

//TILES
export const textTile = (text: Bilingual): Tile => ({ type: "text", content: { text } })
//Shown whole: a plan or a drawing must not lose an edge
export const imageTile = (fileId: string | null, alt: Bilingual): Tile => ({
  type: "image", content: { fileId, url: null, alt, fit: "contain" },
})
export const videoTile = (fileId: string | null): Tile => ({
  type: "video", content: { fileId, url: null, autoplay: true, loop: true, muted: true, controls: false },
})
export const viewerTile = (modelId: string | null, view: string, look: Viewer3dLook): Tile => ({
  type: "viewer3d", content: { model3dId: modelId, desktopView: view, mobileView: view, look },
})
export const legendTile = (items: Bilingual[], marker: "number" | "letter"): Tile => ({ type: "legend", content: { marker, items } })
export const sequenceTile = (items: SheetImage[], numbered: boolean): Tile => ({
  type: "sequence", content: { numbered, items: items.map((i) => ({ fileId: i.fileId, url: null, caption: i.caption })) },
})
export const shaderTitle = (title: Bilingual): Tile => textTile({ fr: `### ${title.fr}`, en: `### ${title.en}` })

//An imported page has no grid of its own: it is laid out on the default one
export function sheetBlocks(m: SheetMedia): DetailBlock[] {
  let n = 0
  const w = new SheetWriter(() => `ps${++n}`, DEFAULT_GRID.cols)

  if (m.intro) w.row([textTile(m.intro)], 1)

  bandPlans(w,
    imageTile(m.plansId, bi("Vues orthographiques cotées", "Dimensioned orthographic views")),
    viewerTile(m.modelId, m.view, "blueprint"))

  if (m.blocking) {
    bandBlocking(w,
      m.blocking.levels.length ? sequenceTile(m.blocking.levels, true) : null,
      m.blocking.videoId ? videoTile(m.blocking.videoId) : null,
      m.blocking.text ? textTile(m.blocking.text) : null)
  }

  if (m.exploded) {
    bandExploded(w,
      m.exploded.modelId
        ? viewerTile(m.exploded.modelId, m.view, "exploded")
        : imageTile(m.exploded.fileId, bi("Vue éclatée", "Exploded view")),
      m.exploded.legend.length ? legendTile(m.exploded.legend, "number") : null)
  }

  if (m.shaders.length) {
    bandShaders(w, m.shaders.map((s) => ({ title: shaderTitle(s.title), squares: sequenceTile(s.steps, true) })))
  }

  const swatches: Tile | null = m.materials.length
    ? { type: "materials", content: { items: m.materials.map((i) => ({ ...i, url: null })) } }
    : null
  const maps = m.maps.length ? sequenceTile(m.maps, false) : null
  const uvs = present([
    m.uvId ? imageTile(m.uvId, bi("Dépliage UV", "UV layout")) : null,
    m.uvTexturedId ? imageTile(m.uvTexturedId, bi("Dépliage UV texturé", "Textured UV layout")) : null,
  ])
  if (swatches || maps || uvs.length) bandMaterials(w, swatches, maps, uvs)

  if (m.process.length) bandProcess(w, sequenceTile(m.process, true))

  if (m.specs.length || m.outro) {
    bandSpecs(w, m.specs.length ? { type: "specs", content: { rows: m.specs } } : null, m.outro ? textTile(m.outro) : null)
  }
  return w.fitted()
}

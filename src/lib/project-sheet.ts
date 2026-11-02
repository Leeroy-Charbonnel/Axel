import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType, MaterialItem } from "../types/portfolio"

//PROJECT SHEET - the detail page of a project imported with a technical plan
//(scripts/import-renders.ts, sheet/sheet.json), laid out on the 3-column grid
//as a sheet: plans beside the model in blueprint, the blocking, the exploded view and its nomenclature, the shaders step by step, materials and maps, the production stages, then
//the specifications. A band takes what the folder has and never leaves a hole.
//The page head already carries the title, the numbers and the thumbnails.

export interface SheetImage {
  fileId:  string
  caption: Bilingual
}

export interface SheetMedia {
  modelId:   string
  view:      string
  intro:     Bilingual | null
  plansId:   string
  //from the roughest pass to the refined one
  blocking:  { levels: SheetImage[]; videoId: string | null; text: Bilingual | null } | null
  exploded:  { fileId: string; legend: Bilingual[]; text: Bilingual | null } | null
  //one row of squares per shader, under its own title
  shaders:   { title: Bilingual; steps: SheetImage[] }[]
  materials: Omit<MaterialItem, "url">[]
  maps:      SheetImage[]
  //the UV layout as lines, and the same layout over the colour texture
  uvId:      string | null
  uvTexturedId: string | null
  process:   SheetImage[]
  specs:     { label: Bilingual; value: Bilingual }[]
  outro:     Bilingual | null
}

interface Tile {
  type:    DetailBlockType
  content: DetailBlockContent
}

const bi = (fr: string, en: string): Bilingual => ({ fr, en })

export function sheetBlocks(m: SheetMedia): DetailBlock[] {
  const blocks: DetailBlock[] = []
  let n = 0
  let y = 0
  let phoneY = 0
  function place(t: Tile, x: number, top: number, w: number, h: number, phoneH: number) {
    blocks.push({ id: `ps${++n}`, type: t.type, x, y: top, w, h, mobileY: phoneY, mobileH: phoneH, content: t.content })
    phoneY += phoneH
  }
  const text = (b: Bilingual): Tile => ({ type: "text", content: { text: b } })
  //shown whole: a plan or a drawing must not lose an edge
  const image = (fileId: string, alt: Bilingual): Tile => ({ type: "image", content: { fileId, url: null, alt, fit: "contain" } })
  const video = (fileId: string): Tile => ({
    type: "video", content: { fileId, url: null, autoplay: true, loop: true, muted: true, controls: false },
  })
  const legend = (items: Bilingual[], marker: "number" | "letter"): Tile | null =>
    items.length ? { type: "legend", content: { marker, items } } : null
  const sequence = (items: SheetImage[], numbered: boolean): Tile => ({
    type: "sequence", content: { numbered, items: items.map((i) => ({ fileId: i.fileId, url: null, caption: i.caption })) },
  })
  const present = (tiles: (Tile | null)[]) => tiles.filter((t): t is Tile => t !== null)

  function heading(fr: string, en: string) {
    place({ type: "heading", content: { text: bi(fr, en) } }, 0, y, 3, 1, 1)
    y += 1
  }
  //a large tile on two columns, up to two tiles stacked at its right
  function pair(main: Tile, side: Tile[]) {
    if (side.length === 0) {
      place(main, 0, y, 3, 2, 2)
      y += 2
      return
    }
    place(main, 0, y, 2, 2, 2)
    if (side.length === 1) place(side[0]!, 2, y, 1, 2, 2)
    else side.slice(0, 2).forEach((t, i) => place(t, 2, y + i, 1, 1, 1))
    y += 2
  }
  //up to three tiles sharing a row: one takes it all, two split one and two
  function row(tiles: Tile[], h: number) {
    if (!tiles.length) return
    const widths = tiles.length === 1 ? [3] : tiles.length === 2 ? [1, 2] : [1, 1, 1]
    let x = 0
    tiles.slice(0, 3).forEach((t, i) => {
      place(t, x, y, widths[i]!, h, h)
      x += widths[i]!
    })
    y += h
  }

  if (m.intro) row([text(m.intro)], 1)

  //PLANS - the drawing beside the model in the same black and white
  heading("Plans techniques", "Technical drawings")
  const blueprint: Tile = {
    type: "viewer3d", content: { model3dId: m.modelId, desktopView: m.view, mobileView: m.view, look: "blueprint" },
  }
  pair(image(m.plansId, bi("Vues orthographiques cotées", "Dimensioned orthographic views")), [blueprint])

  //BLOCKING - the passes side by side, the motion test and the words beside them
  if (m.blocking) {
    heading("Blocking", "Blocking")
    const levels = m.blocking.levels.length ? sequence(m.blocking.levels, true) : null
    const side = present([m.blocking.videoId ? video(m.blocking.videoId) : null, m.blocking.text ? text(m.blocking.text) : null])
    if (levels) pair(levels, side)
    else row(side, 2)
  }

  //EXPLODED VIEW - the parts and their nomenclature
  if (m.exploded) {
    heading("Vue éclatée", "Exploded view")
    pair(image(m.exploded.fileId, bi("Vue éclatée", "Exploded view")), present([
      legend(m.exploded.legend, "number"),
      m.exploded.text ? text(m.exploded.text) : null,
    ]))
  }

  //SHADERS - each one built square by square, its name beside its squares
  if (m.shaders.length) {
    heading("Shaders", "Shaders")
    for (const s of m.shaders) row([text({ fr: `### ${s.title.fr}`, en: `### ${s.title.en}` }), sequence(s.steps, true)], 1)
  }

  //MATERIALS - the swatches down the left, the maps and the UV layout beside them
  const swatches: Tile | null = m.materials.length
    ? { type: "materials", content: { items: m.materials.map((i) => ({ ...i, url: null })) } }
    : null
  const maps = m.maps.length ? sequence(m.maps, false) : null
  const uvs = present([
    m.uvId ? image(m.uvId, bi("Dépliage UV", "UV layout")) : null,
    m.uvTexturedId ? image(m.uvTexturedId, bi("Dépliage UV texturé", "Textured UV layout")) : null,
  ])
  if (swatches || maps || uvs.length) {
    heading("Matériaux et textures", "Materials and textures")
    if (swatches && maps && uvs.length) {
      place(swatches, 0, y, 1, 3, 2)
      place(maps, 1, y, 2, 1, 1)
      //one layout on both columns, or the two side by side
      uvs.forEach((t, i) => place(t, 1 + i, y + 1, uvs.length === 1 ? 2 : 1, 2, 2))
      y += 3
    } else {
      row(present([swatches, maps]), 2)
      row(uvs, 2)
    }
  }

  //PRODUCTION - the same view at each stage
  if (m.process.length) {
    heading("Processus de production", "Production process")
    row([sequence(m.process, true)], 1)
  }

  if (m.specs.length || m.outro) {
    heading("Spécifications", "Specifications")
    row(present([
      m.specs.length ? { type: "specs", content: { rows: m.specs } } : null,
      m.outro ? text(m.outro) : null,
    ]), 1)
  }
  return blocks
}

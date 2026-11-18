import type { Bilingual, DetailBlock } from "../types/portfolio"
import { bottomOf, phoneAuthored } from "./bento-layout"
import {
  SheetWriter, bandBlocking, bandExploded, bandMaterials, bandPlans, bandProcess, bandShaders, bandSpecs,
  imageTile, legendTile, sequenceTile, shaderTitle, textTile, videoTile, viewerTile,
} from "./project-sheet"

//SECTION PRESETS - the sheet's sections as the editor adds them: the same bands
//the import lays out (project-sheet.ts), with empty blocks to fill. A visitor
//never sees an empty block, so a section half filled still reads well.

export interface SectionPreset {
  key:      string
  labelKey: string
  build:    (w: SheetWriter) => void
}

const empty = (): Bilingual => ({ fr: "", en: "" })

export const SECTION_PRESETS: SectionPreset[] = [
  { key: "plans",     labelKey: "sectionPlans",     build: (w) => bandPlans(w, imageTile(null, empty()), viewerTile(null, "", "blueprint")) },
  { key: "blocking",  labelKey: "sectionBlocking",  build: (w) => bandBlocking(w, sequenceTile([], true), videoTile(null), textTile(empty())) },
  { key: "exploded",  labelKey: "sectionExploded",  build: (w) => bandExploded(w, viewerTile(null, "", "exploded"), legendTile([empty()], "number")) },
  { key: "shaders",   labelKey: "sectionShaders",   build: (w) => bandShaders(w, [{ title: shaderTitle(empty()), squares: sequenceTile([], true) }]) },
  { key: "materials", labelKey: "sectionMaterials", build: (w) => bandMaterials(w,
      { type: "materials", content: { items: [] } }, sequenceTile([], false), [imageTile(null, empty()), imageTile(null, empty())]) },
  { key: "process",   labelKey: "sectionProcess",   build: (w) => bandProcess(w, sequenceTile([], true)) },
  { key: "specs",     labelKey: "sectionSpecs",     build: (w) => bandSpecs(w,
      { type: "specs", content: { rows: [{ label: empty(), value: empty() }] } }, textTile(empty())) },
]

//The preset's blocks on the page's `cols` columns, set below the given rows of
//the page (desktop and phone): everything from there down moves below the new section
export function insertSection(
  blocks: DetailBlock[], preset: SectionPreset, newId: () => string, at: { y: number; phoneY: number }, cols: number,
): DetailBlock[] {
  const w = new SheetWriter(newId, cols)
  preset.build(w)
  const section = w.fitted()
  const height = bottomOf(section)
  const phoneHeight = section.reduce((sum, b) => sum + b.mobileH!, 0)
  //The phone rows only exist once every block has its own
  const phone = blocks.length === 0 || phoneAuthored(blocks)
  const moved = blocks.map((b) => ({
    ...b,
    y: b.y >= at.y ? b.y + height : b.y,
    ...(phone ? { mobileY: b.mobileY! >= at.phoneY ? b.mobileY! + phoneHeight : b.mobileY } : {}),
  }))
  const added = section.map((b) => phone
    ? { ...b, y: b.y + at.y, mobileY: b.mobileY! + at.phoneY }
    : { ...b, y: b.y + at.y, mobileY: undefined, mobileH: undefined })
  return [...moved, ...added]
}

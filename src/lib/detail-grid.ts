import type { DetailGridSettings, DetailPage } from "../types/portfolio"

//DETAIL GRID SETTINGS - the desktop grid of a project page: column count,
//minimum row height and gap. One registry for the defaults, the limits and
//the CSS variables, read by the public grid, the editor, the panel and the
//server validator.

export interface GridSettingDef {
  key:      keyof DetailGridSettings
  labelKey: string
  default:  number
  min:      number
  max:      number
  step:     number
  unit:     "" | "px"
  //The CSS variable the grids read
  cssVar:   string
  //The page follows the slider while it moves; otherwise the value lands on release
  live:     boolean
}

export const GRID_SETTINGS: GridSettingDef[] = [
  { key: "cols", labelKey: "detailGridCols", default: 3,   min: 1,  max: 6,   step: 1,  unit: "",   cssVar: "--detail-cols",  live: false },
  { key: "rowH", labelKey: "detailGridRowH", default: 200, min: 80, max: 600, step: 10, unit: "px", cssVar: "--detail-row-h", live: true },
  { key: "gap",  labelKey: "detailGridGap",  default: 16,  min: 0,  max: 64,  step: 2,  unit: "px", cssVar: "--detail-gap",   live: true },
]

export const DEFAULT_GRID: DetailGridSettings =
  Object.fromEntries(GRID_SETTINGS.map((g) => [g.key, g.default])) as Record<keyof DetailGridSettings, number>

export function gridOf(page: Pick<DetailPage, "grid"> | null | undefined): DetailGridSettings {
  return { ...DEFAULT_GRID, ...page?.grid }
}

//The CSS variables of a grid, one per setting
export function gridStyle(grid: DetailGridSettings): Record<string, string> {
  return Object.fromEntries(GRID_SETTINGS.map((g) => [g.cssVar, `${grid[g.key]}${g.unit}`]))
}

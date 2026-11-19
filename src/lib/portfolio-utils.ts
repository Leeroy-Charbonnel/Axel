//PORTFOLIO formatting helpers shared by the home page and the detail blocks.

type StatKey = "triangles" | "vertices" | "faces" | "edges"

interface StatSource {
  vertices:   number
  edges:      number
  faces?:     number
  triangles?: number
}

export interface StatRow {
  key:      StatKey
  labelKey: string
  label:    string
  count: number
  value: string
}

const STAT_ORDER: { key: StatKey; labelKey: string }[] = [
  { key: "triangles", labelKey: "projectsStatTriangles" },
  { key: "vertices",  labelKey: "projectsStatVertices" },
  { key: "faces",     labelKey: "projectsStatFaces" },
  { key: "edges",     labelKey: "projectsStatEdges" },
]

//THE SPEC STRIP of a model: full labels, grouped digits in the reader's
//language, and nothing for a count that was never filled in (0 or missing).
//all: the empty counts too, for the editor.
export function statRows(stats: StatSource, lang: string, t: (key: string) => string, all = false): StatRow[] {
  const format = new Intl.NumberFormat(lang)
  return STAT_ORDER
    .filter(({ key }) => all || (stats[key] ?? 0) > 0)
    .map(({ key, labelKey }) => ({ key, labelKey, label: t(labelKey), count: stats[key] ?? 0, value: format.format(stats[key] ?? 0) }))
}

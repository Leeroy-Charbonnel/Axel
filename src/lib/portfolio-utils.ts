//PORTFOLIO formatting helpers shared by the home page and the detail blocks.

//Compact number formatter for the animated counters: 1234 -> "1k", 1500000 -> "2M".
type StatKey = "triangles" | "vertices" | "faces" | "edges"

interface StatSource {
  vertices:   number
  edges:      number
  faces?:     number
  triangles?: number
}

export interface StatRow {
  key:   StatKey
  label: string
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
export function statRows(stats: StatSource, lang: string, t: (key: string) => string): StatRow[] {
  const format = new Intl.NumberFormat(lang)
  return STAT_ORDER
    .filter(({ key }) => (stats[key] ?? 0) > 0)
    .map(({ key, labelKey }) => ({ key, label: t(labelKey), count: stats[key] ?? 0, value: format.format(stats[key] ?? 0) }))
}

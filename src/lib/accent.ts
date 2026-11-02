//THE SITE ACCENT AS A CSS COLOUR, read from --primary ("185 65% 51%") so the
//3D viewer lights its wireframe glow with the same cyan as the rest of the site
export function siteAccent(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  const parts = raw.split(/\s+/)
  if (parts.length !== 3) throw new Error(`[accent] --primary is not "H S% L%": "${raw}"`)
  return `hsl(${parts.join(", ")})`
}

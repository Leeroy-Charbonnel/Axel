import type { WireColor } from "./types"

//A WIREFRAME COLOUR is a fixed CSS colour, or the site background, read from
//the --background variable (an HSL triplet, "0 0% 0%") when it is applied.

export const SITE_BACKGROUND = "background"

const TRIPLET = /^(-?\d*\.?\d+)(?:deg)?\s+(\d*\.?\d+)%\s+(\d*\.?\d+)%$/

//"210 40% 8%" to "hsl(210, 40%, 8%)", the form three's Color reads
export function hslTripletToCss(triplet: string): string {
  const m = TRIPLET.exec(triplet.trim())
  if (!m) throw new Error(`--background is "${triplet}", not an HSL triplet`)
  return `hsl(${m[1]}, ${m[2]}%, ${m[3]}%)`
}

export function siteBackgroundColor(): string {
  return hslTripletToCss(getComputedStyle(document.documentElement).getPropertyValue("--background"))
}

export function isSiteBackground(color: WireColor | undefined): boolean {
  return color === SITE_BACKGROUND
}

//the CSS colour to draw with
export function resolveWireColor(color: WireColor): string {
  return isSiteBackground(color) ? siteBackgroundColor() : color
}

//Calls back when the site theme changes the variables on <html>. Returns the stop function.
export function onSiteThemeChange(cb: () => void): () => void {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
  return () => observer.disconnect()
}

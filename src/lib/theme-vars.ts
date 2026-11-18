//Base CSS tokens the admin can change, with their default values

interface ThemeVarBase {
  name:     `--${string}`
  labelKey: string
  //Same value as in style.css
  default:  string
}

//An HSL triplet, "185 65% 51%"
export interface ColorVarDef extends ThemeVarBase {
  type: "color"
}

//A number from min to max
export interface NumberVarDef extends ThemeVarBase {
  type: "number"
  min:  number
  max:  number
  step: number
}

export type ThemeVarDef = ColorVarDef | NumberVarDef

export const THEME_VARS = [
  { name: "--primary",       labelKey: "themeAccent",     type: "color",  default: "185 65% 51%" },
  { name: "--background",    labelKey: "themeBackground", type: "color",  default: "0 0% 0%" },
  { name: "--ink",           labelKey: "themeText",       type: "color",  default: "0 0% 100%" },
  { name: "--foreground",    labelKey: "themeTextBase",   type: "color",  default: "0 0% 65%" },
  { name: "--grain-opacity", labelKey: "themeGrain",      type: "number", default: "0.12", min: 0, max: 1, step: 0.01 },
] as const satisfies readonly ThemeVarDef[]

export type ThemeVar       = (typeof THEME_VARS)[number]
export type ThemeVarName   = ThemeVar["name"]
export type NumberThemeVar = Extract<ThemeVar, { type: "number" }>

//Values by name, a missing name keeps its default
export type ThemeVars = Partial<Record<ThemeVarName, string>>

export const THEME_VALUE_MAX_LENGTH = 32
//WCAG AA for body text
export const MIN_TEXT_CONTRAST = 4.5

//Text colour and the colour under it, that must stay readable
const CONTRAST_PAIRS = [
  { text: "--ink",        ground: "--background" },
  { text: "--foreground", ground: "--background" },
  { text: "--background", ground: "--primary" },
] as const satisfies readonly { text: ThemeVarName; ground: ThemeVarName }[]

export interface ContrastIssue {
  text:   ThemeVarName
  ground: ThemeVarName
  ratio:  number
}

const HUE_TURN    = 360
const HUE_SECTOR  = 60
const SECTORS     = HUE_TURN / HUE_SECTOR
//Sectors where green, then blue, is the strongest channel
const GREEN_SECTOR = 2
const BLUE_SECTOR  = 4
const PERCENT     = 100
const CHANNEL_MAX = 255
const HEX_RADIX   = 16
const HEX_DIGITS  = 2
//One decimal keeps a picked colour on the same hex
const HSL_DECIMALS = 1

//WCAG relative luminance constants
const SRGB_KNEE   = 0.04045
const SRGB_SLOPE  = 12.92
const SRGB_OFFSET = 0.055
const SRGB_GAMMA  = 2.4
const LUMA: Rgb   = [0.2126, 0.7152, 0.0722]
const CONTRAST_FLARE = 0.05

const HSL_PATTERN     = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/
const HEX_PATTERN     = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/

//H in degrees, s and l from 0 to 1
interface Hsl { h: number; s: number; l: number }
//Channels from 0 to 1
type Rgb = [number, number, number]

export function themeVar(name: string): ThemeVarDef {
  const def = THEME_VARS.find((v) => v.name === name)
  if (!def) throw new Error(`[theme] ${name} is not a theme variable`)
  return def
}

function parseHsl(value: string): Hsl | null {
  const match = HSL_PATTERN.exec(value.trim())
  if (!match) return null
  const [h, s, l] = match.slice(1).map(Number) as [number, number, number]
  if (h > HUE_TURN || s > PERCENT || l > PERCENT) return null
  return { h, s: s / PERCENT, l: l / PERCENT }
}

export function isThemeValue(def: ThemeVarDef, value: string): boolean {
  if (def.type === "color") return parseHsl(value) !== null
  if (!DECIMAL_PATTERN.test(value)) return false
  const n = Number(value)
  return n >= def.min && n <= def.max
}

//Two values that draw the same, "185 65% 51%" and "185 65.1% 51%" for a colour
export function sameThemeValue(def: ThemeVarDef, a: string, b: string): boolean {
  return def.type === "color" ? hslToHex(a) === hslToHex(b) : Number(a) === Number(b)
}

function hslToRgb(value: string): Rgb {
  const hsl = parseHsl(value)
  if (!hsl) throw new Error(`[theme] "${value}" is not "H S% L%"`)
  const chroma = (1 - Math.abs(2 * hsl.l - 1)) * hsl.s
  const sector = (hsl.h % HUE_TURN) / HUE_SECTOR
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const base   = hsl.l - chroma / 2
  const sectors: Rgb[] = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second],
  ]
  return sectors[Math.floor(sector)]!.map((c) => c + base) as Rgb
}

export function hslToHex(value: string): string {
  return "#" + hslToRgb(value).map((c) => Math.round(c * CHANNEL_MAX).toString(HEX_RADIX).padStart(HEX_DIGITS, "0")).join("")
}

const roundHsl = (n: number) => Number(n.toFixed(HSL_DECIMALS))

export function hexToHsl(hex: string): string {
  const match = HEX_PATTERN.exec(hex)
  if (!match) throw new Error(`[theme] "${hex}" is not "#rrggbb"`)
  const [r, g, b] = match.slice(1).map((c) => parseInt(c, HEX_RADIX) / CHANNEL_MAX) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const l = (max + min) / 2
  const s = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (chroma !== 0) {
    if (max === r) h = ((g - b) / chroma + SECTORS) % SECTORS
    else if (max === g) h = (b - r) / chroma + GREEN_SECTOR
    else h = (r - g) / chroma + BLUE_SECTOR
    h *= HUE_SECTOR
  }
  return `${roundHsl(h) % HUE_TURN} ${roundHsl(s * PERCENT)}% ${roundHsl(l * PERCENT)}%`
}

function luminance(rgb: Rgb): number {
  const linear = rgb.map((c) => c <= SRGB_KNEE ? c / SRGB_SLOPE : ((c + SRGB_OFFSET) / (1 + SRGB_OFFSET)) ** SRGB_GAMMA)
  return linear.reduce((sum, c, i) => sum + c * LUMA[i]!, 0)
}

//WCAG contrast ratio of two colours, from 1 to 21
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort((x, y) => y - x) as [number, number]
  return (light + CONTRAST_FLARE) / (dark + CONTRAST_FLARE)
}

//First pair under the minimum contrast, a missing name at its default
export function contrastIssue(vars: ThemeVars): ContrastIssue | null {
  const valueOf = (name: ThemeVarName) => vars[name] ?? themeVar(name).default
  for (const { text, ground } of CONTRAST_PAIRS) {
    const ratio = contrastRatio(valueOf(text), valueOf(ground))
    if (ratio < MIN_TEXT_CONTRAST) return { text, ground, ratio }
  }
  return null
}

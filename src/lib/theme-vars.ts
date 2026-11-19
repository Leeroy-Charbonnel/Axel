//The CSS tokens the admin can change, by group, each with its type and default.
//Only what a colour picker or a slider can set: no token that needs typed CSS.

export type ThemeGroup = "colors" | "shape" | "spacing" | "layout" | "type" | "texture"

//Order of the groups in the CSS tab, with the key of their title
export const THEME_GROUPS: readonly { key: ThemeGroup; labelKey: string }[] = [
  { key: "colors",  labelKey: "themeGroupColors" },
  { key: "shape",   labelKey: "themeGroupShape" },
  { key: "spacing", labelKey: "themeGroupSpacing" },
  { key: "layout",  labelKey: "themeGroupLayout" },
  { key: "type",    labelKey: "themeGroupType" },
  { key: "texture", labelKey: "themeGroupTexture" },
]

interface ThemeVarBase {
  name:     `--${string}`
  labelKey: string
  group:    ThemeGroup
  //Same value as in style.css or tokens.css
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

export type LengthUnit = "px" | "rem" | "em"

//A number from min to max followed by its unit, "1.5rem"
export interface LengthVarDef extends ThemeVarBase {
  type: "length"
  unit: LengthUnit
  min:  number
  max:  number
  step: number
}

export type ThemeVarDef = ColorVarDef | NumberVarDef | LengthVarDef

const REM_STEP = 0.05
const EM_STEP  = 0.01

export const THEME_VARS = [
  { name: "--primary",    labelKey: "themeAccent",     group: "colors", type: "color", default: "185 65% 51%" },
  { name: "--background", labelKey: "themeBackground", group: "colors", type: "color", default: "0 0% 0%" },
  { name: "--ink",        labelKey: "themeText",       group: "colors", type: "color", default: "0 0% 100%" },
  { name: "--foreground", labelKey: "themeTextBase",   group: "colors", type: "color", default: "0 0% 65%" },

  { name: "--vsui-radius-sm", labelKey: "themeRadiusSm",    group: "shape", type: "length", unit: "px", default: "4px", min: 0, max: 16, step: 1 },
  { name: "--vsui-radius",    labelKey: "themeRadius",      group: "shape", type: "length", unit: "px", default: "8px", min: 0, max: 32, step: 1 },
  { name: "--border-width",   labelKey: "themeBorderWidth", group: "shape", type: "length", unit: "px", default: "1px", min: 0, max: 4,  step: 1 },

  { name: "--spacing-xxs", labelKey: "themeSpacingXxs", group: "spacing", type: "length", unit: "rem", default: "0.25rem", min: 0, max: 1,   step: REM_STEP },
  { name: "--spacing-xs",  labelKey: "themeSpacingXs",  group: "spacing", type: "length", unit: "rem", default: "0.4rem",  min: 0, max: 1.5, step: REM_STEP },
  { name: "--spacing-sm",  labelKey: "themeSpacingSm",  group: "spacing", type: "length", unit: "rem", default: "0.75rem", min: 0, max: 2,   step: REM_STEP },
  { name: "--spacing-md",  labelKey: "themeSpacingMd",  group: "spacing", type: "length", unit: "rem", default: "1rem",    min: 0, max: 3,   step: REM_STEP },
  { name: "--spacing-lg",  labelKey: "themeSpacingLg",  group: "spacing", type: "length", unit: "rem", default: "1.5rem",  min: 0, max: 4,   step: REM_STEP },
  { name: "--spacing-xl",  labelKey: "themeSpacingXl",  group: "spacing", type: "length", unit: "rem", default: "2rem",    min: 0, max: 6,   step: REM_STEP },
  { name: "--spacing-2xl", labelKey: "themeSpacing2xl", group: "spacing", type: "length", unit: "rem", default: "3rem",    min: 0, max: 8,   step: REM_STEP },
  { name: "--spacing-3xl", labelKey: "themeSpacing3xl", group: "spacing", type: "length", unit: "rem", default: "4rem",    min: 0, max: 12,  step: REM_STEP },

  { name: "--site-max-width",   labelKey: "themeMaxWidth",   group: "layout", type: "length", unit: "px", default: "1280px", min: 960, max: 1920, step: 10 },

  { name: "--site-fs-small", labelKey: "themeFsSmall", group: "type", type: "length", unit: "rem", default: "0.875rem", min: 0.625, max: 1.25, step: 0.025 },
  { name: "--site-fs-label", labelKey: "themeFsLabel", group: "type", type: "length", unit: "rem", default: "0.75rem",  min: 0.625, max: 1.25, step: 0.025 },
  { name: "--site-lh-body",  labelKey: "themeLhBody",  group: "type", type: "number", default: "1.65", min: 1,   max: 2.5, step: 0.05 },
  { name: "--site-lh-tight", labelKey: "themeLhTight", group: "type", type: "number", default: "1.1",  min: 0.8, max: 1.6, step: 0.05 },
  { name: "--site-fw-display",       labelKey: "themeFwDisplay",       group: "type", type: "number", default: "800", min: 100, max: 900, step: 100 },
  { name: "--site-tracking-label",   labelKey: "themeTrackingLabel",   group: "type", type: "length", unit: "em", default: "0.18em", min: 0, max: 0.4, step: EM_STEP },
  { name: "--site-tracking-heading", labelKey: "themeTrackingHeading", group: "type", type: "length", unit: "em", default: "0.08em", min: 0, max: 0.4, step: EM_STEP },

  { name: "--grain-opacity", labelKey: "themeGrain",     group: "texture", type: "number", default: "0.12", min: 0, max: 1, step: 0.01 },
  { name: "--grain-size",    labelKey: "themeGrainSize", group: "texture", type: "length", unit: "px", default: "150px", min: 50, max: 400, step: 10 },
  { name: "--filter-blur",   labelKey: "themeBlur",      group: "texture", type: "length", unit: "px", default: "6px",   min: 0,  max: 24,  step: 1 },
] as const satisfies readonly ThemeVarDef[]

type ThemeVar     = (typeof THEME_VARS)[number]
type ColorVarName = Extract<ThemeVar, { type: "color" }>["name"]

//Values by name, a missing name keeps its default
export type ThemeVars = Record<string, string>

export function isRegistered(name: string): boolean {
  return THEME_VARS.some((v) => v.name === name)
}

//A name of the registry with a value of its type
export function isThemeEntry(name: string, value: string): boolean {
  return isRegistered(name) && isThemeValue(themeVar(name), value)
}
//WCAG AA for body text
export const MIN_TEXT_CONTRAST = 4.5

//Text colour and the colour under it, that must stay readable
const CONTRAST_PAIRS = [
  { text: "--ink",        ground: "--background" },
  { text: "--foreground", ground: "--background" },
  { text: "--background", ground: "--primary" },
] as const satisfies readonly { text: ColorVarName; ground: ColorVarName }[]

export interface ContrastIssue {
  text:   ColorVarName
  ground: ColorVarName
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
const LENGTH_PATTERN  = /^(\d+(?:\.\d+)?)(px|rem|em)$/

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

//The number of a length written in the unit of its token, null for anything else
export function lengthNumber(def: LengthVarDef, value: string): number | null {
  const match = LENGTH_PATTERN.exec(value)
  return match && match[2] === def.unit ? Number(match[1]) : null
}

export function isThemeValue(def: ThemeVarDef, value: string): boolean {
  if (def.type === "color") return parseHsl(value) !== null
  const n = def.type === "length" ? lengthNumber(def, value) : DECIMAL_PATTERN.test(value) ? Number(value) : null
  return n !== null && n >= def.min && n <= def.max
}

//Two values that draw the same, "185 65% 51%" and "185 65.1% 51%" for a colour
export function sameThemeValue(def: ThemeVarDef, a: string, b: string): boolean {
  if (def.type === "color") return hslToHex(a) === hslToHex(b)
  if (def.type === "length") return lengthNumber(def, a) === lengthNumber(def, b)
  return Number(a) === Number(b)
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
  const valueOf = (name: ColorVarName) => vars[name] ?? themeVar(name).default
  for (const { text, ground } of CONTRAST_PAIRS) {
    const ratio = contrastRatio(valueOf(text), valueOf(ground))
    if (ratio < MIN_TEXT_CONTRAST) return { text, ground, ratio }
  }
  return null
}

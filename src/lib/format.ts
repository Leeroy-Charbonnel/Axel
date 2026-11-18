import { useLang } from "../composables/useLang"
import type { Lang } from "./lang"

const BYTES_PER_KB = 1024
const FRACTION_DIGITS = 1
//One Intl unit per power of 1024: "12,3 Mo" in French, "12.3 MB" in English
const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(lang: Lang, unit: (typeof UNITS)[number]): Intl.NumberFormat {
  const key = `${lang}:${unit}`
  let found = formatters.get(key)
  if (!found) {
    //Short English bytes read "281 byte": bytes are spelled out
    const unitDisplay = unit === "byte" ? "long" : "short"
    found = new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay, maximumFractionDigits: FRACTION_DIGITS })
    formatters.set(key, found)
  }
  return found
}

const { lang } = useLang()

//File sizes for the admin screens, in the site language
export function formatBytes(n: number): string {
  let power = 0
  while (power < UNITS.length - 1 && n >= BYTES_PER_KB ** (power + 1)) power++
  return formatter(lang.value, UNITS[power]!).format(n / BYTES_PER_KB ** power)
}

import type { Bilingual } from "../types/portfolio"

//Bilingual fallback chain - prefer the requested lang, fall back to fr,
//then en, then empty string. Used everywhere a translation could be
//missing on one side of the locale split.
export function pickBilingual(t: Partial<Bilingual> | null | undefined, lang: string): string {
  if (!t) return ""
  return (t as Record<string, string>)[lang] || t.fr || t.en || ""
}

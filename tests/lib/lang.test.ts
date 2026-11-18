import { describe, expect, test } from "bun:test"
import { LANG_DEFAULT, LANGS, isLang } from "../../src/lib/lang"

describe("LANGS registry", () => {
  test("every code is unique", () => {
    const codes = LANGS.map((lang) => lang.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  test("every code passes isLang and has a name", () => {
    for (const lang of LANGS) {
      expect(isLang(lang.code)).toBe(true)
      expect(lang.name.trim().length).toBeGreaterThan(0)
    }
  })

  test("the default language is in the registry", () => {
    expect(LANGS.some((lang) => lang.code === LANG_DEFAULT)).toBe(true)
  })

  test("isLang refuses anything outside the registry", () => {
    for (const value of ["", "FR", "de", "fr-FR", null, undefined, 1, {}]) {
      expect(isLang(value)).toBe(false)
    }
  })
})

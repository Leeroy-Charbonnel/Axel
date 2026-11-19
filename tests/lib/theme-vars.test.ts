import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { THEME_GROUPS, THEME_VARS, isThemeEntry, isThemeValue, sameThemeValue, themeVar } from "../../src/lib/theme-vars"

const css = ["src/style.css", "src/tokens.css"].map((path) => readFileSync(path, "utf8")).join("\n")

//The first value a stylesheet gives a variable
function cssValue(name: string): string | null {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css)
  return match ? match[1]!.trim() : null
}

describe("theme registry", () => {
  test("every default is the value of the stylesheets", () => {
    for (const def of THEME_VARS) {
      const value = cssValue(def.name)
      expect(value, def.name).not.toBeNull()
      expect(sameThemeValue(def, def.default, value!), `${def.name}: ${def.default} vs ${value}`).toBe(true)
    }
  })

  test("every default is a valid value on its slider step, in a known group", () => {
    const groups = new Set(THEME_GROUPS.map((group) => group.key))
    for (const def of THEME_VARS) {
      expect(isThemeValue(def, def.default), def.name).toBe(true)
      expect(groups.has(def.group), def.name).toBe(true)
      if (def.type !== "number" && def.type !== "length") continue
      const steps = (parseFloat(def.default) - def.min) / def.step
      expect(Math.abs(steps - Math.round(steps)), def.name).toBeLessThan(1e-6)
    }
  })

  test("a value is checked by the type of its token", () => {
    expect(isThemeEntry("--vsui-radius", "14px")).toBe(true)
    expect(isThemeEntry("--vsui-radius", "99px")).toBe(false)
    expect(isThemeEntry("--vsui-radius", "1rem")).toBe(false)
    expect(isThemeEntry("--spacing-md", "1.25rem")).toBe(true)
    expect(isThemeEntry("--site-fw-display", "700")).toBe(true)
    expect(isThemeEntry("--site-gutter", "clamp(16px, 5vw, 80px)")).toBe(true)
    expect(isThemeEntry("--site-gutter", "url(x)")).toBe(false)
    expect(isThemeEntry("--site-gutter", "1px; color: red")).toBe(false)
    expect(isThemeEntry("--primary", "185 65% 51%")).toBe(true)
    expect(isThemeEntry("--primary", "red")).toBe(false)
  })

  test("a name outside the registry is refused", () => {
    expect(isThemeEntry("--editor-font", "serif")).toBe(false)
    expect(() => themeVar("--editor-font")).toThrow()
  })
})

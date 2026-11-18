import { computed, effectScope, ref, watch } from "vue"
import { apiJson } from "./usePortfolio"
import { useToast } from "./useToast"
import { useTranslations } from "./useTranslations"
import {
  MIN_TEXT_CONTRAST, THEME_VARS, contrastIssue, hslToHex, isCssVarValue, isRegistered, isThemeValue, sameThemeValue, themeVar,
  type ContrastIssue, type ThemeVars,
} from "../lib/theme-vars"

//Site theme: saved and draft values of the base tokens, inline on <html>

const toast = useToast()
const { t } = useTranslations()

//Values the server wrote on <html> for the first paint
function inlineVars(): ThemeVars {
  if (typeof document === "undefined") return {}
  const style = document.documentElement.style
  const vars: ThemeVars = {}
  for (const name of Array.from(style)) {
    if (name.startsWith("--")) vars[name] = style.getPropertyValue(name).trim()
  }
  return vars
}

//Every variable the stylesheets set on :root, with its value there
let sheetVars: ThemeVars | null = null
export function stylesheetVars(): ThemeVars {
  if (sheetVars) return sheetVars
  const vars: ThemeVars = {}
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule) || !/^(:root|html)$/.test(rule.selectorText.trim())) continue
      for (const name of Array.from(rule.style)) {
        if (name.startsWith("--")) vars[name] = rule.style.getPropertyValue(name).trim()
      }
    }
  }
  sheetVars = vars
  return vars
}

const saved = ref<ThemeVars>(inlineVars())
const draft = ref<ThemeVars>({ ...saved.value })

function defaultValue(name: string): string {
  return isRegistered(name) ? themeVar(name).default : stylesheetVars()[name] ?? ""
}

function sameVars(a: ThemeVars, b: ThemeVars): boolean {
  const registered = THEME_VARS.every((def) => sameThemeValue(def, a[def.name] ?? def.default, b[def.name] ?? def.default))
  const others = new Set([...Object.keys(a), ...Object.keys(b)].filter((name) => !isRegistered(name)))
  return registered && [...others].every((name) => (a[name] ?? defaultValue(name)) === (b[name] ?? defaultValue(name)))
}

const dirty      = computed(() => !sameVars(draft.value, saved.value))
const overridden = computed(() => Object.keys(draft.value).length > 0)

//Fresh saved values, a draft being edited stays
export function receiveSavedTheme(vars: ThemeVars): void {
  const editing = dirty.value
  saved.value = { ...vars }
  if (!editing) draft.value = { ...vars }
}

//Names written on <html>, removed again when the draft drops them
const written = new Set<string>()
function writeVars(vars: ThemeVars): void {
  const style = document.documentElement.style
  for (const name of [...written, ...THEME_VARS.map((v) => v.name)]) {
    if (vars[name] === undefined) { style.removeProperty(name); written.delete(name) }
  }
  for (const [name, value] of Object.entries(vars)) {
    style.setProperty(name, value)
    written.add(name)
  }
}

//One writer for the whole page, owned by no component
if (typeof window !== "undefined") {
  effectScope(true).run(() => {
    watch(draft, writeVars, { deep: true, immediate: true })
  })
}

function value(name: string): string {
  return draft.value[name] ?? defaultValue(name)
}

//The accent as "#rrggbb" for the 3D viewers
const accent = computed(() => hslToHex(value("--primary")))

function reset(name: string): void {
  const next = { ...draft.value }
  delete next[name]
  draft.value = next
}

//A value that draws like the default removes the name
function set(name: string, next: string): void {
  if (!isRegistered(name)) return setOther(name, next.trim())
  const def = themeVar(name)
  if (!isThemeValue(def, next)) throw new Error(`[useTheme] "${next}" is not a value for ${name}`)
  if (sameThemeValue(def, next, value(name))) return
  if (sameThemeValue(def, next, defaultValue(name))) reset(name)
  else draft.value = { ...draft.value, [name]: next }
}

//Any other site variable, checked by the plain-value rule
function setOther(name: string, next: string): void {
  if (!isCssVarValue(next)) throw new Error(`[useTheme] "${next}" is not a value for ${name}`)
  if (next === value(name)) return
  if (next === defaultValue(name)) reset(name)
  else draft.value = { ...draft.value, [name]: next }
}

function resetAll(): void {
  draft.value = {}
}

function discard(): void {
  draft.value = { ...saved.value }
}

function snapshot(): ThemeVars {
  return { ...draft.value }
}

function restore(vars: ThemeVars): void {
  draft.value = { ...vars }
}

function contrastMessage(issue: ContrastIssue): string {
  return t("themeContrastLow")
    .replace("{text}", t(themeVar(issue.text).labelKey))
    .replace("{ground}", t(themeVar(issue.ground).labelKey))
    .replace("{ratio}", issue.ratio.toFixed(2))
    .replace("{min}", String(MIN_TEXT_CONTRAST))
}

//Throws on failure after a toast with the reason; the draft stays
async function save(): Promise<void> {
  if (!dirty.value) return
  const issue = contrastIssue(draft.value)
  if (issue) {
    toast.error(contrastMessage(issue))
    throw new Error(`[useTheme] ${issue.text} on ${issue.ground}: contrast ${issue.ratio.toFixed(2)}`)
  }
  const sent = { ...draft.value }
  const row = await apiJson<{ vars: ThemeVars }>("PUT", "/api/theme", { vars: sent })
  saved.value = row.vars
  //A change made during the request stays in the draft
  if (sameVars(draft.value, sent)) draft.value = { ...row.vars }
}

export function useTheme() {
  return { dirty, overridden, accent, value, defaultValue, set, reset, resetAll, save, discard, snapshot, restore }
}

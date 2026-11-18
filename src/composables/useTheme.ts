import { computed, effectScope, ref, watch } from "vue"
import { apiJson } from "./usePortfolio"
import { useToast } from "./useToast"
import { useTranslations } from "./useTranslations"
import {
  MIN_TEXT_CONTRAST, THEME_VARS, contrastIssue, hslToHex, isThemeValue, sameThemeValue, themeVar,
  type ContrastIssue, type ThemeVarName, type ThemeVars,
} from "../lib/theme-vars"

//Site theme: saved and draft values of the base tokens, inline on <html>

const toast = useToast()
const { t } = useTranslations()

//Values the server wrote on <html> for the first paint
function inlineVars(): ThemeVars {
  if (typeof document === "undefined") return {}
  const style = document.documentElement.style
  const vars: ThemeVars = {}
  for (const { name } of THEME_VARS) {
    const value = style.getPropertyValue(name).trim()
    if (value) vars[name] = value
  }
  return vars
}

const saved = ref<ThemeVars>(inlineVars())
const draft = ref<ThemeVars>({ ...saved.value })

function defaultValue(name: ThemeVarName): string {
  return themeVar(name).default
}

function sameVars(a: ThemeVars, b: ThemeVars): boolean {
  return THEME_VARS.every((def) => sameThemeValue(def, a[def.name] ?? def.default, b[def.name] ?? def.default))
}

const dirty      = computed(() => !sameVars(draft.value, saved.value))
const overridden = computed(() => Object.keys(draft.value).length > 0)

//Fresh saved values, a draft being edited stays
export function receiveSavedTheme(vars: ThemeVars): void {
  const editing = dirty.value
  saved.value = { ...vars }
  if (!editing) draft.value = { ...vars }
}

function writeVars(vars: ThemeVars): void {
  const style = document.documentElement.style
  for (const { name } of THEME_VARS) {
    const value = vars[name]
    if (value === undefined) style.removeProperty(name)
    else style.setProperty(name, value)
  }
}

//One writer for the whole page, owned by no component
if (typeof window !== "undefined") {
  effectScope(true).run(() => {
    watch(draft, writeVars, { deep: true, immediate: true })
  })
}

function value(name: ThemeVarName): string {
  return draft.value[name] ?? defaultValue(name)
}

//The accent as "#rrggbb" for the 3D viewers
const accent = computed(() => hslToHex(value("--primary")))

function reset(name: ThemeVarName): void {
  const next = { ...draft.value }
  delete next[name]
  draft.value = next
}

//A value that draws like the default removes the name
function set(name: ThemeVarName, next: string): void {
  const def = themeVar(name)
  if (!isThemeValue(def, next)) throw new Error(`[useTheme] "${next}" is not a value for ${name}`)
  if (sameThemeValue(def, next, value(name))) return
  if (sameThemeValue(def, next, defaultValue(name))) reset(name)
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
  return { dirty, overridden, accent, value, defaultValue, set, resetAll, save, discard, snapshot, restore }
}

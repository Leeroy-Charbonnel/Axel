import { Router } from "express"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db/index"
import { SITE_THEME_ID, siteTheme } from "../../db/schema"
import { parse, requireAdmin } from "../http"
import {
  MAX_THEME_VARS, MIN_TEXT_CONTRAST, contrastIssue, isAnyThemeValue, type ThemeVars,
} from "../../src/lib/theme-vars"

//Site theme: read for the portfolio payload, replaced as a whole by the admin

//Text readable on its ground, checked once every value is valid
const readable = z.custom<ThemeVars>().superRefine((vars, ctx) => {
  const issue = contrastIssue(vars)
  if (issue) ctx.addIssue({ code: "custom", message: `${issue.text} on ${issue.ground}: contrast ${issue.ratio.toFixed(2)}:1, needs ${MIN_TEXT_CONTRAST}:1` })
})

//Registry tokens by their type, any other CSS variable as a plain value
const themeVars = z.record(z.string(), z.string())
  .refine((vars) => Object.keys(vars).length <= MAX_THEME_VARS, { message: `at most ${MAX_THEME_VARS} variables` })
  .superRefine((vars, ctx) => {
    for (const [name, value] of Object.entries(vars)) {
      if (!isAnyThemeValue(name, value)) ctx.addIssue({ code: "custom", message: `${name}: "${value}" is not a valid value` })
    }
  })
  .pipe(readable)
const themeBody = z.object({ vars: themeVars }).strict()

//A stored value the registry refuses is logged and left out
function checkedVars(stored: Record<string, string>): ThemeVars {
  const vars: ThemeVars = {}
  for (const [name, value] of Object.entries(stored)) {
    if (isAnyThemeValue(name, value)) vars[name] = value
    else console.error(`[theme] stored ${name}: "${value}" is not a theme value, left out`)
  }
  return vars
}

//No row means every token keeps its default
export async function readTheme(): Promise<ThemeVars> {
  const [row] = await db.select({ vars: siteTheme.vars }).from(siteTheme).where(eq(siteTheme.id, SITE_THEME_ID))
  return row ? checkedVars(row.vars) : {}
}

export const themeRouter = Router()

themeRouter.put("/api/theme", requireAdmin, async (req, res) => {
  const { vars } = parse(themeBody, req.body)
  const values = { vars: vars as Record<string, string>, updatedAt: new Date() }
  const [row] = await db.insert(siteTheme)
    .values({ id: SITE_THEME_ID, ...values })
    .onConflictDoUpdate({ target: siteTheme.id, set: values })
    .returning({ vars: siteTheme.vars })
  res.json({ vars: checkedVars(row!.vars) })
})

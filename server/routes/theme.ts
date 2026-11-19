import { Router } from "express"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db/index"
import { SITE_THEME_ID, siteTheme } from "../../db/schema"
import { parse, requireAdmin } from "../http"
import {
  MIN_TEXT_CONTRAST, contrastIssue, isThemeEntry, type ThemeVars,
} from "../../src/lib/theme-vars"

//Site theme: read for the portfolio payload, replaced as a whole by the admin

//Text readable on its ground, checked once every value is valid
const readable = z.custom<ThemeVars>().superRefine((vars, ctx) => {
  const issue = contrastIssue(vars)
  if (issue) ctx.addIssue({ code: "custom", message: `${issue.text} on ${issue.ground}: contrast ${issue.ratio.toFixed(2)}:1, needs ${MIN_TEXT_CONTRAST}:1` })
})

//Only the tokens of the registry, each checked by its type
const themeVars = z.record(z.string(), z.string())
  .superRefine((vars, ctx) => {
    for (const [name, value] of Object.entries(vars)) {
      if (!isThemeEntry(name, value)) ctx.addIssue({ code: "custom", message: `${name}: "${value}" is not a theme token with a valid value` })
    }
  })
  .pipe(readable)
const themeBody = z.object({ vars: themeVars }).strict()

//A stored value the registry refuses is logged and left out
function checkedVars(stored: Record<string, string>): ThemeVars {
  const vars: ThemeVars = {}
  for (const [name, value] of Object.entries(stored)) {
    if (isThemeEntry(name, value)) vars[name] = value
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

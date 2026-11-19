import { Router } from "express"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../db/index"
import { settings, translations } from "../../db/schema"
import { HttpError, adminId, parse, requireAdmin } from "../http"
import { settingBody, settingKey } from "../validation"

export const settingsRouter = Router()

//TRANSLATIONS - public read so the auth pages (no session) render in the
//right language. A flat map { id: value } for one language.
settingsRouter.get("/api/translations", async (req, res) => {
  const lang = parse(z.enum(["fr", "en"]), req.query.lang)
  const rows = await db.select({ id: translations.id, value: translations.value })
    .from(translations).where(eq(translations.lang, lang))
  res.json(Object.fromEntries(rows.map((r) => [r.id, r.value])))
})

const TRANSLATION_MAX_LENGTH = 2000
const translationsBody = z.strictObject({
  lang:   z.enum(["fr", "en"]),
  values: z.record(z.string().min(1), z.string().trim().min(1).max(TRANSLATION_MAX_LENGTH)),
})

//The admin rewrites texts of one language; a key that does not exist is refused
settingsRouter.put("/api/translations", requireAdmin, async (req, res) => {
  const { lang, values } = parse(translationsBody, req.body)
  await db.transaction(async (tx) => {
    for (const [id, value] of Object.entries(values)) {
      const updated = await tx.update(translations).set({ value })
        .where(and(eq(translations.id, id), eq(translations.lang, lang)))
        .returning({ id: translations.id })
      if (updated.length === 0) throw new HttpError(400, `${id}: no such translation in ${lang}`)
    }
  })
  res.json(values)
})

//SETTINGS - common shape, consumed by SettingsPage
settingsRouter.get("/api/settings", requireAdmin, async (_req, res) => {
  res.json(await db.select().from(settings).where(eq(settings.userId, adminId(res))))
})

//Upsert: creates the row with its metadata when missing, otherwise updates
//the value only, so a setting's schema stays stable once it exists. Lets the
//composables seed their own settings without a separate endpoint.
settingsRouter.put("/api/settings/:key", requireAdmin, async (req, res) => {
  const userId = adminId(res)
  const key = parse(settingKey, req.params.key)
  const { value, ...meta } = parse(settingBody, req.body)
  const [updated] = await db.update(settings)
    .set({ value, updatedAt: new Date() })
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
    .returning()
  if (updated) {
    res.json(updated)
    return
  }
  const [inserted] = await db.insert(settings).values({ userId, key, value, ...meta }).returning()
  res.json(inserted)
})

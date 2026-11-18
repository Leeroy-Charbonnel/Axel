import { eq, isNull } from "drizzle-orm"
import { db } from "../db/index"
import { file } from "../db/schema"
import { isRaster, measureImage } from "../server/uploads"
import { readObject } from "../server/storage"

//IMAGE SIZES for the rows uploaded before uploads measured them. Runs at boot
//from the entrypoint: once every image has its size it finds nothing to do.
//A file missing from the bucket is logged and left null, it does not stop the boot.
const rows = await db.select({ id: file.id, storedFilename: file.storedFilename })
  .from(file).where(isNull(file.width))
const pending = rows.filter((r) => isRaster(r.storedFilename))

let measured = 0
for (const row of pending) {
  try {
    const size = await measureImage(await readObject(row.storedFilename))
    await db.update(file).set(size).where(eq(file.id, row.id))
    measured++
  } catch (e) {
    console.error(`[image-sizes] ${row.storedFilename} could not be measured:`, e instanceof Error ? e.message : e)
  }
}
console.log(`[image-sizes] ${measured} of ${pending.length} image(s) measured`)
process.exit(0)

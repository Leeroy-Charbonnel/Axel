#!/usr/bin/env bun
//FILES INTO THEIR PROJECT FOLDER, in the database DATABASE_URL points at and
//the bucket STORAGE_BUCKET names. Runs at boot from the entrypoint: once every
//file is in its folder it finds nothing to do. See server/file-projects.ts.
//
//Usage: bun scripts/file-projects.ts          moves the files
//       bun scripts/file-projects.ts --plan   lists the moves, changes nothing

import { fileIntoProjects, planFiling } from "../server/file-projects"

if (process.argv.includes("--plan")) {
  const plan = await planFiling()
  for (const f of plan) console.log(`${f.from} -> ${f.to}`)
  console.log(`[file-projects] ${plan.length} file(s) to move`)
} else {
  //Filing never stops the boot: a file left in place is still served
  try {
    const moved = await fileIntoProjects(console.log)
    console.log(`[file-projects] ${moved} file(s) filed`)
  } catch (e) {
    console.error("[file-projects] filing skipped:", e)
  }
}
process.exit(0)

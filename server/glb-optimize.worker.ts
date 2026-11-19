import { parentPort } from "worker_threads"
import { optimizeGlb, type OptimizeReport, PHONE_MAX_TEXTURE_SIZE } from "./glb-optimize"

//ONE OPTIMIZATION OFF THE MAIN THREAD. model-optimize.ts spawns this worker
//per job, sends the GLB bytes, and terminates it once it has answered. It
//makes the phone copy too, from the same source, when a texture of the full
//copy is larger than a phone gets.

//phone: null when the full copy already fits a phone
export interface Optimized {
  output: Uint8Array
  report: OptimizeReport
  phone:  Uint8Array | null
}

export type OptimizeReply = Optimized | { error: string }

const port = parentPort
if (!port) throw new Error("glb-optimize.worker.ts runs as a worker only")

port.once("message", async (input: Uint8Array) => {
  let reply: Optimized
  try {
    const full = await optimizeGlb(input)
    const phone = full.report.largestTexture > PHONE_MAX_TEXTURE_SIZE
      ? (await optimizeGlb(input, { maxTextureSize: PHONE_MAX_TEXTURE_SIZE })).output
      : null
    reply = { ...full, phone }
  } catch (e) {
    port.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies OptimizeReply)
    return
  }
  const moved = [reply.output.buffer as ArrayBuffer]
  if (reply.phone) moved.push(reply.phone.buffer as ArrayBuffer)
  port.postMessage(reply, moved)
})

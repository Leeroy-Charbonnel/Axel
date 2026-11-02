import { parentPort } from "worker_threads"
import { optimizeGlb, type OptimizeReport } from "./glb-optimize"

//ONE OPTIMIZATION OFF THE MAIN THREAD. model-optimize.ts spawns this worker
//per job, sends the GLB bytes, and terminates it once it has answered.

export type OptimizeReply = { output: Uint8Array; report: OptimizeReport } | { error: string }

const port = parentPort
if (!port) throw new Error("glb-optimize.worker.ts runs as a worker only")

port.once("message", async (input: Uint8Array) => {
  let reply: OptimizeReply
  try {
    reply = await optimizeGlb(input)
  } catch (e) {
    port.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies OptimizeReply)
    return
  }
  port.postMessage(reply, [reply.output.buffer as ArrayBuffer])
})

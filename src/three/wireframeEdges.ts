import type { BufferGeometry } from "three"
import type { EdgeJob, EdgeRequest, EdgeResponse } from "./edgeSegments"

//Plain xyz floats, whatever the attribute's storage: interleaved, quantized
//(KHR_mesh_quantization) or normalized.
export function readPositions(geometry: BufferGeometry): Float32Array {
  const attr = geometry.getAttribute("position")
  const out = new Float32Array(attr.count * 3)
  for (let i = 0; i < attr.count; i++) {
    out[3 * i]     = attr.getX(i)
    out[3 * i + 1] = attr.getY(i)
    out[3 * i + 2] = attr.getZ(i)
  }
  return out
}

//Every mesh of a model in one worker run, off the main thread. The worker is
//spawned for the job and terminated after it.
export function computeEdgesInWorker(geometries: BufferGeometry[]): Promise<Float32Array[]> {
  const jobs: EdgeJob[] = geometries.map((g) => {
    const index = g.getIndex()
    return {
      positions: readPositions(g),
      index: index ? (index.array as Uint32Array | Uint16Array).slice() : null,
    }
  })
  const transfer: ArrayBuffer[] = []
  for (const job of jobs) {
    transfer.push(job.positions.buffer as ArrayBuffer)
    if (job.index) transfer.push(job.index.buffer as ArrayBuffer)
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./edges.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<EdgeResponse>) => {
      worker.terminate()
      if ("error" in e.data) reject(new Error(e.data.error))
      else resolve(e.data.segments)
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(`edge worker failed: ${e.message}`))
    }
    worker.onmessageerror = () => {
      worker.terminate()
      reject(new Error("edge worker sent an answer that could not be deserialized"))
    }
    const request: EdgeRequest = { jobs }
    worker.postMessage(request, transfer)
  })
}

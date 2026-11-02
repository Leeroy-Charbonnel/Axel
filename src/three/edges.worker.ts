import { computeEdgeSegments, type EdgeRequest, type EdgeResponse } from "./edgeSegments"

self.onmessage = (e: MessageEvent<EdgeRequest>) => {
  let response: EdgeResponse
  const transfer: ArrayBuffer[] = []
  try {
    const segments = e.data.jobs.map((job) => computeEdgeSegments(job.positions, job.index))
    for (const s of segments) transfer.push(s.buffer as ArrayBuffer)
    response = { segments }
  } catch (err) {
    response = { error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(response, { transfer })
}

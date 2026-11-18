import { derivativeUrl } from "./media"

//ONE IMAGE LOADS AT A TIME. Every public image waits its turn here: the ones
//on screen first, then the rest of the page in order, then the prefetched
//images of other pages. A small copy each, so the queue moves fast.

//One entry of a `sizes` value: an optional media condition, then a width in px or vw
const SIZES_ENTRY = /^\s*(?:(\(.+\))\s+)?(\d+(?:\.\d+)?)(px|vw)\s*$/

//The width in CSS pixels that a `sizes` value gives at the current viewport
export function sizesWidth(sizes: string): number {
  for (const entry of sizes.split(",")) {
    const match = SIZES_ENTRY.exec(entry)
    if (!match) throw new Error(`[image] cannot read the sizes entry "${entry}" of "${sizes}"`)
    const [, media, amount, unit] = match
    if (media && !window.matchMedia(media).matches) continue
    return unit === "vw" ? Number(amount) * window.innerWidth / 100 : Number(amount)
  }
  throw new Error(`[image] no entry of "${sizes}" matches this viewport`)
}

interface Job {
  start:   () => void
  //The <img> waiting, null for a prefetch
  el:      Element | null
  visible: boolean
}

const jobs: Job[] = []
let running: Job | null = null
let observer: IntersectionObserver | null = null

function watcher(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const job = jobs.find((j) => j.el === entry.target)
      if (job) job.visible = entry.isIntersecting
    }
  })
  return observer
}

function next(): Job | undefined {
  return jobs.find((j) => j.visible) ?? jobs.find((j) => j.el) ?? jobs[0]
}

function pump(): void {
  if (running) return
  const job = next()
  if (!job) return
  jobs.splice(jobs.indexOf(job), 1)
  if (job.el) observer?.unobserve(job.el)
  running = job
  job.start()
}

//Queues a load. The answer frees the turn: call it once the image loaded,
//failed or left the page. Calling it again does nothing.
export function enqueue(start: () => void, el: Element | null): () => void {
  const job: Job = { start, el, visible: false }
  jobs.push(job)
  if (el) watcher().observe(el)
  queueMicrotask(pump)
  return () => {
    if (running === job) {
      running = null
      queueMicrotask(pump)
      return
    }
    const i = jobs.indexOf(job)
    if (i === -1) return
    jobs.splice(i, 1)
    if (el) observer?.unobserve(el)
  }
}

//The widest copy of each stored image this page has loaded, by width step
const loaded = new Map<string, number>()

export function loadedStep(stored: string): number | undefined {
  return loaded.get(stored)
}

export function markLoaded(stored: string, step: number): void {
  if ((loaded.get(stored) ?? 0) < step) loaded.set(stored, step)
}

//Prefetches already queued, by stored image and step
const prefetching = new Map<string, number>()

//Loads a copy in the background, after every image of the page
export function prefetch(stored: string, step: number): void {
  if ((loaded.get(stored) ?? 0) >= step || (prefetching.get(stored) ?? 0) >= step) return
  prefetching.set(stored, step)
  const done = enqueue(() => {
    //the page may have loaded it in the meantime
    if ((loaded.get(stored) ?? 0) >= step) return done()
    const url = derivativeUrl(stored, step)
    const img = new Image()
    img.onload = () => { markLoaded(stored, step); done() }
    img.onerror = () => { console.error(`[image] prefetch of ${url} failed`); done() }
    img.src = url
  }, null)
}

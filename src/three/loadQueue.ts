//ONE MODEL LOADS AT A TIME, AND NEVER WHILE THE PAGE SCROLLS. Every viewer of
//the page queues its load here; each one starts once the visitor has stopped
//scrolling for a moment, so the heavy work never lands in a scroll.
let queue: Promise<unknown> = Promise.resolve()

//The heavy steps wait for this long without a scroll
const SCROLL_PAUSE_MS = 250
let lastScroll = 0
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => { lastScroll = performance.now() }, { passive: true })
}

export async function untilScrollIdle(): Promise<void> {
  for (;;) {
    const wait = lastScroll + SCROLL_PAUSE_MS - performance.now()
    if (wait <= 0) return
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}

export function inLoadTurn<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(untilScrollIdle).then(job)
  //the next load waits for this one, whatever its outcome
  queue = run.then(() => undefined, () => undefined)
  return run
}

//ONE MODEL LOADS AT A TIME, AND NEVER WHILE THE PAGE SCROLLS. Every viewer of
//the page queues its load here; each one starts once the visitor has stopped
//scrolling for a moment, so the heavy work never lands in a scroll. A load is
//cut in steps (one texture upload, one part of the first frame): each step is
//a task of its own, so the page answers between two of them.
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

//Ends the current task. A message, not a timer: a hidden tab slows its timers to one a second
function endTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

//Between two heavy steps: the browser takes input and paints, and a scroll goes first
export async function nextStep(): Promise<void> {
  await endTask()
  await untilScrollIdle()
}

export function inLoadTurn<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(untilScrollIdle).then(job)
  //the next load waits for this one, whatever its outcome
  queue = run.then(() => undefined, () => undefined)
  return run
}

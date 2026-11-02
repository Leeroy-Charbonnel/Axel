//ONE MODEL LOADS AT A TIME. Every viewer of the page queues its load here, so
//the first model on screen gets the whole bandwidth and the next one starts
//when it is done. The caller still receives its own result or error.
let queue: Promise<unknown> = Promise.resolve()

export function inLoadTurn<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  //the next load waits for this one, whatever its outcome
  queue = run.then(() => undefined, () => undefined)
  return run
}

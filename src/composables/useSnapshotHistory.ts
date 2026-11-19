import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"

//UNDO / REDO OVER ONE PIECE OF STATE. Every change lands in the history,
//whatever made it (a drag, a panel field, inline typing): the state is
//watched, and changes closer together than SETTLE_MS make one step, so a
//sentence typed is one step and a drop is another. Each step keeps the time
//of its last change, so the edit bar can undo it in turn with the editor's own.

const SETTLE_MS = 600
const LIMIT     = 100

interface Step {
  //The state before the change
  json: string
  //When the change was made
  at:   number
}

export function useSnapshotHistory<T>(source: Ref<T>, onStep?: () => void) {
  const past    = shallowRef<Step[]>([])
  const future  = shallowRef<string[]>([])
  const pending = ref(false)
  let current = JSON.stringify(source.value)
  let changedAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer() {
    if (timer) clearTimeout(timer)
    timer = null
    pending.value = false
  }

  //closes the step in progress now instead of after the pause
  function commit() {
    //A change written just before this call has not been seen by the watcher yet
    const at = pending.value ? changedAt : Date.now()
    stopTimer()
    const next = JSON.stringify(source.value)
    if (next === current) return
    past.value = [...past.value, { json: current, at }].slice(-LIMIT)
    future.value = []
    current = next
    onStep?.()
  }

  watch(source, () => {
    //An undo, a redo or a reset writes the state it already holds: no step
    if (JSON.stringify(source.value) === current) return stopTimer()
    if (timer) clearTimeout(timer)
    pending.value = true
    changedAt = Date.now()
    timer = setTimeout(commit, SETTLE_MS)
  }, { deep: true })

  function restore(json: string) {
    current = json
    source.value = JSON.parse(json) as T
  }

  function undo() {
    commit()
    const prev = past.value[past.value.length - 1]
    if (prev === undefined) return
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, current]
    restore(prev.json)
  }

  //A step done again is the newest one
  function redo() {
    commit()
    const next = future.value[future.value.length - 1]
    if (next === undefined) return
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, { json: current, at: Date.now() }]
    restore(next)
  }

  //the present becomes the starting point: after a load, a save or a discard
  function reset() {
    stopTimer()
    past.value = []
    future.value = []
    current = JSON.stringify(source.value)
  }

  //When the newest step was made, 0 without one
  function lastStepAt(): number {
    if (pending.value) return changedAt
    return past.value[past.value.length - 1]?.at ?? 0
  }

  function dropRedo() {
    future.value = []
  }

  onBeforeUnmount(stopTimer)

  return {
    undo, redo, reset, commit, lastStepAt, dropRedo,
    canUndo: computed(() => past.value.length > 0 || pending.value),
    canRedo: computed(() => future.value.length > 0),
  }
}

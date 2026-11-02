import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"

//UNDO / REDO OVER ONE PIECE OF STATE. Every change lands in the history,
//whatever made it (a drag, a panel field, inline typing): the state is
//watched, and changes closer together than SETTLE_MS make one step, so a
//sentence typed is one step and a drop is another.

const SETTLE_MS = 600
const LIMIT     = 100

export function useSnapshotHistory<T>(source: Ref<T>) {
  const past    = shallowRef<string[]>([])
  const future  = shallowRef<string[]>([])
  const pending = ref(false)
  let current = JSON.stringify(source.value)
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer() {
    if (timer) clearTimeout(timer)
    timer = null
    pending.value = false
  }

  //closes the step in progress now instead of after the pause
  function commit() {
    stopTimer()
    const next = JSON.stringify(source.value)
    if (next === current) return
    past.value = [...past.value, current].slice(-LIMIT)
    future.value = []
    current = next
  }

  watch(source, () => {
    if (timer) clearTimeout(timer)
    pending.value = true
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
    restore(prev)
  }

  function redo() {
    commit()
    const next = future.value[future.value.length - 1]
    if (next === undefined) return
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, current]
    restore(next)
  }

  //the present becomes the starting point: after a load, a save or a discard
  function reset() {
    stopTimer()
    past.value = []
    future.value = []
    current = JSON.stringify(source.value)
  }

  onBeforeUnmount(stopTimer)

  return {
    undo, redo, reset, commit,
    canUndo: computed(() => past.value.length > 0 || pending.value),
    canRedo: computed(() => future.value.length > 0),
  }
}

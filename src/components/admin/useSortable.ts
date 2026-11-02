import { computed, nextTick, ref, type Ref } from "vue"

//DRAG TO REORDER - pointer events, so mouse, pen and touch behave the same. The
//handle captures the pointer; the list previews the new order while dragging
//and reports one move on release. Arrow keys on a handle move by one.
//Rows must be keyed by index so the captured handle stays in the document.

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function useSortable(list: Ref<HTMLElement | null>, onMove: (from: number, to: number) => void) {
  const from = ref<number | null>(null)
  const over = ref<number | null>(null)

  function rows(): HTMLElement[] {
    return Array.from(list.value?.children ?? []) as HTMLElement[]
  }

  function indexAt(y: number): number {
    const all = rows()
    const hit = all.findIndex((row) => {
      const r = row.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return hit < 0 ? all.length - 1 : hit
  }

  function onPointerDown(index: number, e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    from.value = index
    over.value = index
  }

  function onPointerMove(e: PointerEvent) {
    if (from.value === null) return
    over.value = indexAt(e.clientY)
  }

  function onPointerUp() {
    const start = from.value
    const end   = over.value
    from.value = null
    over.value = null
    if (start !== null && end !== null && start !== end) onMove(start, end)
  }

  async function onKeydown(index: number, e: KeyboardEvent) {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0
    const target = index + delta
    if (!delta || target < 0 || target >= rows().length) return
    e.preventDefault()
    onMove(index, target)
    //keep the keyboard on the row that moved
    await nextTick()
    rows()[target]?.querySelector<HTMLElement>(".ed-handle")?.focus()
  }

  function preview<T>(items: readonly T[]): readonly T[] {
    if (from.value === null || over.value === null) return items
    return moveItem(items, from.value, over.value)
  }

  const draggingIndex = computed(() => over.value)

  function handleProps(index: number) {
    return {
      class:           "ed-handle",
      onPointerdown:   (e: PointerEvent) => onPointerDown(index, e),
      onPointermove:   onPointerMove,
      onPointerup:     onPointerUp,
      onPointercancel: onPointerUp,
      onKeydown:       (e: KeyboardEvent) => onKeydown(index, e),
    }
  }

  return { preview, draggingIndex, handleProps }
}

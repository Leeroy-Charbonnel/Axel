import { onBeforeUnmount, ref } from "vue"

//INSPECTOR RESIZE - the left edge is dragged, or moved with the arrow keys.
//The wanted width goes to --editor-inspector-drag on <html>; style.css clamps
//it between the min and max tokens, so a smaller window never overflows.

const SIZED_CLASS    = "editor-inspector-sized"
const RESIZING_CLASS = "editor-resizing"
const DRAG_VAR       = "--editor-inspector-drag"
const KEY_STEP_REM   = 1
const PERCENT        = 100
const END_EVENTS     = ["pointerup", "pointercancel", "lostpointercapture"] as const

export function useInspectorResize(panel: () => HTMLElement | null) {
  //Panel width as a share of the window, for the separator value
  const percent = ref(0)
  let drag: AbortController | null = null
  let frame = 0
  //Last pointer width not yet applied
  let pending: number | null = null

  function measure() {
    const el = panel()
    percent.value = el ? Math.round((el.offsetWidth / window.innerWidth) * PERCENT) : 0
  }

  function setWidth(px: number) {
    const root = document.documentElement
    root.style.setProperty(DRAG_VAR, `${Math.round(px)}px`)
    root.classList.add(SIZED_CLASS)
    requestAnimationFrame(measure)
  }

  function stop() {
    drag?.abort()
    drag = null
    cancelAnimationFrame(frame)
    if (pending !== null) setWidth(pending)
    pending = null
    document.documentElement.classList.remove(RESIZING_CLASS)
  }

  function start(e: PointerEvent) {
    if (e.button !== 0) return
    stop()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture(e.pointerId)
    document.documentElement.classList.add(RESIZING_CLASS)
    drag = new AbortController()
    const { signal } = drag
    //One width per frame, from the last pointer position
    handle.addEventListener("pointermove", (ev) => {
      pending = window.innerWidth - ev.clientX
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (pending !== null) setWidth(pending)
        pending = null
      })
    }, { signal })
    for (const type of END_EVENTS) handle.addEventListener(type, stop, { signal })
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    const el = panel()
    if (!el) return
    e.preventDefault()
    const step = KEY_STEP_REM * parseFloat(getComputedStyle(document.documentElement).fontSize)
    setWidth(el.offsetWidth + (e.key === "ArrowLeft" ? step : -step))
  }

  onBeforeUnmount(() => {
    stop()
    document.documentElement.style.removeProperty(DRAG_VAR)
    document.documentElement.classList.remove(SIZED_CLASS)
  })

  return { percent, start, stop, onKey, measure }
}

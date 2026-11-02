import { ref, watch } from "vue"

//A TYPED VALUE BEHIND A TEXT BOX. What the admin types stays on screen; only a
//value that parses is committed, and anything else shows its error instead of
//being dropped or coerced.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export function useValidatedInput<T>(
  source: () => T,
  format: (value: T) => string,
  parse:  (text: string) => Parsed<T>,
  commit: (value: T) => void,
) {
  const text  = ref(format(source()))
  const error = ref<string | null>(null)

  //an outside change (undo, discard) replaces the text, unless it is what we just committed
  watch(source, (value) => {
    const current = parse(text.value)
    if (current.ok && JSON.stringify(current.value) === JSON.stringify(value)) return
    text.value  = format(value)
    error.value = null
  })

  function onInput(next: string) {
    text.value = next
    const result = parse(next)
    if (result.ok) {
      error.value = null
      commit(result.value)
    } else {
      error.value = result.error
    }
  }

  return { text, error, onInput }
}

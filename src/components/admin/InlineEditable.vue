<script lang="ts">
//Firefox before 136 has no plaintext-only: it gets a rich field that pastes plain text
function supportsPlaintextOnly(): boolean {
  const probe = document.createElement("span")
  probe.setAttribute("contenteditable", "plaintext-only")
  return probe.contentEditable === "plaintext-only"
}
const PLAINTEXT_ONLY = supportsPlaintextOnly()

//One highlight holds the accent of every inline text; without the API the accent is not drawn while typing
const accentHighlight = "highlights" in CSS ? new Highlight() : null
if (accentHighlight) CSS.highlights.set("inline-text-accent", accentHighlight)

const BLOCK_TAGS = new Set(["DIV", "P"])

interface Point { node: Node; offset: number }
interface Reading {
  text:       string
  at:         number | null
  lineOpen:   boolean
  blockEnded: boolean
}

function addText(r: Reading, data: string) {
  if (data === "") return
  if (r.blockEnded) r.text += "\n"
  r.blockEnded = false
  r.text += data
  r.lineOpen = !data.endsWith("\n")
}

//A <br> ends a line, a block (div, p) is a line of its own, and the last line
//break of a block only holds its last line open
function readInto(container: Node, r: Reading, point: Point | null, block: boolean) {
  const start = r.text.length
  container.childNodes.forEach((child, i) => {
    if (point?.node === container && point.offset === i) r.at = r.text.length
    if (child.nodeType === Node.TEXT_NODE) {
      const data = child.textContent ?? ""
      addText(r, data)
      if (point?.node === child) r.at = r.text.length - data.length + point.offset
    } else if (child.nodeName === "BR") {
      addText(r, "\n")
    } else if (BLOCK_TAGS.has(child.nodeName)) {
      if (r.lineOpen || r.blockEnded) r.text += "\n"
      r.lineOpen = false
      r.blockEnded = false
      readInto(child, r, point, true)
      r.blockEnded = true
    } else {
      readInto(child, r, point, false)
    }
  })
  if (point?.node === container && point.offset === container.childNodes.length) r.at = r.text.length
  if (!block || r.text.length === start || !r.text.endsWith("\n")) return
  r.text = r.text.slice(0, -1)
  if (r.at !== null && r.at > r.text.length) r.at = r.text.length
}

//The text the field shows, and where a point of its DOM falls in that text
function readText(root: HTMLElement, point: Point | null = null): { text: string; at: number | null } {
  const r: Reading = { text: "", at: null, lineOpen: false, blockEnded: false }
  readInto(root, r, point, true)
  return { text: r.text, at: r.at }
}

//The DOM point at an offset of the text held by the root's text nodes
function pointAt(root: HTMLElement, offset: number): Point {
  let left = offset
  for (const node of root.childNodes) {
    const length = node.textContent?.length ?? 0
    if (left <= length) return { node, offset: left }
    left -= length
  }
  return { node: root, offset: root.childNodes.length }
}

function caretIn(root: HTMLElement): Point | null {
  const selection = window.getSelection()
  if (document.activeElement !== root || !selection?.focusNode || !root.contains(selection.focusNode)) return null
  return { node: selection.focusNode, offset: selection.focusOffset }
}

//One text node; a last newline gets a second one so its empty line shows
function write(root: HTMLElement, text: string, caret: number | null) {
  root.textContent = text.endsWith("\n") ? `${text}\n` : text
  if (caret === null) return
  const point = pointAt(root, Math.min(caret, text.length))
  window.getSelection()?.collapse(point.node, point.offset)
}

//Plain text from the clipboard or a drop, at the caret
function insertPlain(text: string) {
  document.execCommand("insertText", false, text)
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue"

//A PLAIN TEXT BOX DRAWN AS THE TEXT OF THE PAGE. It shows its value, sends
//each typed change, and takes a new value (an undo, the inspector, another
//language) without moving the caret.

interface TextPart { start: number; end: number }

const props = withDefaults(defineProps<{
  modelValue:  string
  //Its accessible name
  label:       string
  placeholder: string
  multiline?:  boolean
  //Keeps the digits only
  digits?:     boolean
  //The language of the text, when it has one
  lang?:       string
  //The part drawn in the accent while typing, as the read mode draws it
  accent?:     (text: string) => TextPart | null
}>(), { multiline: false, digits: false, lang: undefined, accent: undefined })

const emit = defineEmits<{ "update:modelValue": [text: string]; focus: []; blur: [] }>()

const el = ref<HTMLElement | null>(null)

function clean(text: string): string {
  const flat = text.replace(/\r/g, "")
  if (props.digits) return flat.replace(/\D/g, "")
  return props.multiline ? flat : flat.replace(/\n+/g, " ")
}

const accentRange = new Range()

function drawAccent(root: HTMLElement | null, text: string) {
  if (!accentHighlight) return
  accentHighlight.delete(accentRange)
  const part = root && props.accent?.(text)
  if (!part) return
  const start = pointAt(root, part.start)
  const end = pointAt(root, part.end)
  accentRange.setStart(start.node, start.offset)
  accentRange.setEnd(end.node, end.offset)
  accentHighlight.add(accentRange)
}

//Only a value that differs from the shown text touches the DOM
function render() {
  const root = el.value
  if (root) {
    const shownNow = readText(root, caretIn(root))
    if (shownNow.text !== props.modelValue) write(root, props.modelValue, shownNow.at)
  }
  drawAccent(root, props.modelValue)
}

watch([el, () => props.modelValue], render, { flush: "post" })
onBeforeUnmount(() => drawAccent(null, ""))

//Markup a browser slipped in (blocks, <br>) becomes plain text again
function onInput() {
  const root = el.value
  if (!root) return
  const typed = readText(root, caretIn(root))
  const text = clean(typed.text)
  //An empty field holds no node, so its placeholder shows
  if (root.childElementCount > 0 || text !== typed.text || (text === "" && root.hasChildNodes())) {
    write(root, text, typed.at === null ? null : clean(typed.text.slice(0, typed.at)).length)
  }
  drawAccent(root, text)
  emit("update:modelValue", text)
}

//A last empty line is not kept
function onBlur() {
  const text = props.modelValue.replace(/\n+$/, "")
  if (text !== props.modelValue) emit("update:modelValue", text)
  emit("blur")
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (e.key === "Escape" || (e.key === "Enter" && !props.multiline)) {
    e.preventDefault()
    //The key ends the typing and nothing else: no click on a button around it
    e.stopPropagation()
    el.value?.blur()
  }
}

function onPaste(e: ClipboardEvent) {
  if (PLAINTEXT_ONLY || !e.clipboardData) return
  e.preventDefault()
  insertPlain(e.clipboardData.getData("text/plain"))
}

function onDrop(e: DragEvent) {
  if (PLAINTEXT_ONLY || !e.dataTransfer) return
  e.preventDefault()
  const at = document.caretPositionFromPoint(e.clientX, e.clientY)
  if (at) window.getSelection()?.collapse(at.offsetNode, at.offset)
  insertPlain(e.dataTransfer.getData("text/plain"))
}
</script>

<template>
  <span
    ref="el"
    class="inline-text"
    :contenteditable="PLAINTEXT_ONLY ? 'plaintext-only' : 'true'"
    role="textbox"
    :inputmode="digits ? 'numeric' : undefined"
    :aria-label="label"
    :aria-multiline="multiline"
    :aria-placeholder="placeholder"
    :lang="lang"
    :data-placeholder="placeholder"
    @focus="emit('focus')"
    @blur="onBlur"
    @input="onInput"
    @keydown="onKeydown"
    @paste="onPaste"
    @drop="onDrop"
  />
</template>

<style scoped>
.inline-text {
  display: block;
  cursor: text;
  white-space: pre-wrap;
  outline: none;
  scroll-margin-top: var(--site-chrome-top);
  transition: box-shadow var(--transition-fast) ease;
}

.inline-text:hover { box-shadow: 0 0 0 var(--border-width) var(--editor-accent-line); }
.inline-text:focus { box-shadow: 0 0 0 var(--editor-outline-width) var(--editor-accent); }

/*The placeholder is drawn, not read as the value*/
.inline-text:empty::before {
  content: attr(data-placeholder);
  content: attr(data-placeholder) / "";
  color: var(--editor-text-muted);
  pointer-events: none;
}

.inline-text::highlight(inline-text-accent) { color: var(--site-accent); }

/*A focused text scrolls above the bottom sheet*/
@media (max-width: 1024px) {
  html.editor-inspector-open .inline-text {
    scroll-margin-bottom: calc(var(--editor-sheet-height) + var(--editor-bar-offset));
  }
}
</style>

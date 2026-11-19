import { marked } from "marked"
import DOMPurify from "dompurify"

//pickBilingual lives in bilingual.ts: a page that renders no markdown imports
//it from there and does not load the parser and the sanitizer
export { pickBilingual } from "./bilingual"

//MARKDOWN - single renderer shared by the detail-page blocks (text,
//accordion bodies) so view mode, edit mode and panel previews all parse
//with the same options. The HTML goes through v-html, so it is sanitized:
//no script, no event handler, no javascript: link.
export function renderMd(src: string): string {
  if (!src) return ""
  const html = marked.parse(src, { async: false, breaks: true, gfm: true })
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

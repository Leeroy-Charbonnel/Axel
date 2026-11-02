//SAFE URL for href / src attributes built from stored content. Only http(s)
//and mailto pass; anything else (javascript:, data:, a typo) returns null and
//is logged, so the caller renders no link and the reason is in the console.
//"" is no link at all and returns null without a warning.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"])

export function safeUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (!URL.canParse(value)) {
    console.warn(`[safeUrl] refused a value that is not an absolute URL: ${value}`)
    return null
  }
  const url = new URL(value)
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    console.warn(`[safeUrl] refused protocol ${url.protocol} in: ${value}`)
    return null
  }
  return url.href
}

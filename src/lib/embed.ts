import { safeUrl } from "./safe-url"

//EMBEDS - a pasted page link becomes the provider's player address. Only the
//providers allowed by frame-src in server.ts are accepted: any other site
//would be blocked by the browser and leave an empty frame.
const PROVIDERS: { match: RegExp; src: (id: string) => string }[] = [
  { match: /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/, src: (id) => `https://www.youtube-nocookie.com/embed/${id}` },
  { match: /vimeo\.com\/(?:video\/)?(\d+)/,                                                src: (id) => `https://player.vimeo.com/video/${id}` },
  { match: /sketchfab\.com\/(?:3d-)?models\/(?:[\w-]*-)?([0-9a-f]{32})/,                   src: (id) => `https://sketchfab.com/models/${id}/embed` },
]

//null for an empty value, a refused URL or a site that cannot be embedded
export function embedSrc(raw: string): string | null {
  const url = safeUrl(raw)
  if (!url) return null
  for (const p of PROVIDERS) {
    const id = url.match(p.match)?.[1]
    if (id) return p.src(id)
  }
  return null
}

//the attributes every embed frame carries: scripts for the player, no top
//navigation, no forms
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-presentation allow-popups"
export const EMBED_ALLOW   = "autoplay; fullscreen; picture-in-picture; xr-spatial-tracking"

import { watch } from "vue"
import { usePortfolio } from "../composables/usePortfolio"
import { gridOf } from "./detail-grid"
import { prefetch, sizesWidth } from "./image-queue"
import { IMAGE_SIZES, blockSizes, stepFor, storedImage, type ImageSizes } from "./media"
import type { PortfolioDto } from "../types/portfolio"

//THE PROJECT PAGES' IMAGES, fetched in the background from the first page
//shown, after that page's own images, at the copy each page will ask for:
//opening a project then finds its images already there. A visitor whose
//browser asks to save data gets none of it.

//Every stored image URL inside a block's content, at any depth
function imageUrls(value: unknown, out: string[]): string[] {
  if (typeof value === "string") {
    if (storedImage(value)) out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) imageUrls(item, out)
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) imageUrls(item, out)
  }
  return out
}

function queue(url: string, sizes: string, images: ImageSizes): void {
  const stored = storedImage(url)
  if (stored) prefetch(stored, stepFor(sizesWidth(sizes), images[url]?.[0] ?? null))
}

function prefetchAll(pf: PortfolioDto): void {
  for (const project of pf.mainProjects.filter((p) => p.published)) {
    for (const thumb of project.thumbnails) {
      for (const url of [thumb.url, thumb.wireframeUrl]) if (url) queue(url, IMAGE_SIZES.thumb, pf.images)
    }
    const cols = gridOf(project.detailPage).cols
    const blocks = [...project.detailPage.blocks].sort((a, b) => a.y - b.y || a.x - b.x)
    for (const block of blocks) {
      for (const url of imageUrls(block.content, [])) queue(url, blockSizes(block.w, cols), pf.images)
    }
  }
}

export function startProjectPrefetch(): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return
  const { data } = usePortfolio()
  if (data.value) return prefetchAll(data.value)
  const stop = watch(data, (pf) => {
    if (!pf) return
    stop()
    prefetchAll(pf)
  }, { flush: "post" })
}

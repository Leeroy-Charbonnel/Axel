import type { Component } from "vue"
import {
  Box, Columns2, Film, GalleryHorizontalEnd, Hash, Heading1, ImageIcon, Images,
  ListCollapse, ListOrdered, MonitorPlay, MousePointerClick, Palette, Quote, Rows3, Table, Type,
} from "lucide-vue-next"
import { embedSrc } from "../../../lib/embed"
import { SHEET_COLS } from "../../../lib/project-sheet"
import { pickBilingual } from "../../../lib/markdown"
import { safeUrl } from "../../../lib/safe-url"
import type { Lang } from "../../../lib/lang"
import type {
  AccordionBlockContent, ButtonBlockContent, CarouselBlockContent, CompareBlockContent,
  CountersBlockContent, DetailBlock, DetailBlockContent, DetailBlockType, EmbedBlockContent,
  ImageBlockContent, LegendBlockContent, MarqueeBlockContent, MaterialsBlockContent, Model3dDto,
  SequenceBlockContent, SpecsBlockContent, TextBlockContent, VideoBlockContent, Viewer3dBlockContent,
} from "../../../types/portfolio"

//BLOCK TYPE REGISTRY - one entry per type: label key, the key of the text
//that says what it is for, icon, the size a new block gets on the desktop
//grid, and its starting content.
export interface BlockTypeDef {
  type:     DetailBlockType
  labelKey: string
  helpKey:  string
  icon:     Component
  //Width on the sheet's columns, scaled to the page's own: the whole sheet is the full width
  size:     { w: number; h: number }
  create:   () => DetailBlockContent
}

const empty = () => ({ fr: "", en: "" })

export const BLOCK_TYPES: BlockTypeDef[] = [
  { type: "text",      labelKey: "blockTypeText",      helpKey: "blockHelpText",      icon: Type,      size: { w: 1, h: 2 }, create: () => ({ text: empty() }) },
  { type: "heading",   labelKey: "blockTypeHeading",   helpKey: "blockHelpHeading",   icon: Heading1,   size: { w: SHEET_COLS, h: 1 }, create: () => ({ text: { fr: "Section", en: "Section" } }) },
  { type: "quote",     labelKey: "blockTypeQuote",     helpKey: "blockHelpQuote",     icon: Quote,     size: { w: 2, h: 1 }, create: () => ({ text: empty(), author: "" }) },
  { type: "image",     labelKey: "blockTypeImage",     helpKey: "blockHelpImage",     icon: ImageIcon,     size: { w: 2, h: 2 }, create: () => ({ fileId: null, url: null, alt: empty(), fit: "cover" }) },
  { type: "video",     labelKey: "blockTypeVideo",     helpKey: "blockHelpVideo",     icon: Film,     size: { w: 2, h: 2 }, create: () => ({ fileId: null, url: null, autoplay: true, loop: true, muted: true, controls: false }) },
  { type: "carousel",  labelKey: "blockTypeCarousel",  helpKey: "blockHelpCarousel",  icon: Images,  size: { w: SHEET_COLS, h: 2 }, create: () => ({ items: [], intervalMs: 0 }) },
  { type: "marquee",   labelKey: "blockTypeMarquee",   helpKey: "blockHelpMarquee",   icon: GalleryHorizontalEnd,   size: { w: SHEET_COLS, h: 1 }, create: () => ({ items: [], speedPxs: 60 }) },
  { type: "compare",   labelKey: "blockTypeCompare",   helpKey: "blockHelpCompare",   icon: Columns2,   size: { w: 2, h: 2 }, create: () => ({
      beforeFileId: null, beforeUrl: null, afterFileId: null, afterUrl: null,
      beforeLabel: { fr: "Avant", en: "Before" }, afterLabel: { fr: "Après", en: "After" }, followMouse: false,
    }) },
  { type: "accordion", labelKey: "blockTypeAccordion", helpKey: "blockHelpAccordion", icon: ListCollapse, size: { w: 1, h: 2 }, create: () => ({ items: [{ title: empty(), body: empty() }] }) },
  { type: "specs",     labelKey: "blockTypeSpecs",     helpKey: "blockHelpSpecs",     icon: Table,     size: { w: 1, h: 2 }, create: () => ({ rows: [{ label: empty(), value: empty() }] }) },
  { type: "counters",  labelKey: "blockTypeCounters",  helpKey: "blockHelpCounters",  icon: Hash,  size: { w: SHEET_COLS, h: 1 }, create: () => ({ items: [{ label: empty(), value: 0 }] }) },
  { type: "button",    labelKey: "blockTypeButton",    helpKey: "blockHelpButton",    icon: MousePointerClick,    size: { w: 1, h: 1 }, create: () => ({ label: empty(), url: "", newTab: true }) },
  { type: "embed",     labelKey: "blockTypeEmbed",     helpKey: "blockHelpEmbed",     icon: MonitorPlay,     size: { w: 2, h: 2 }, create: () => ({ url: "" }) },
  { type: "viewer3d",  labelKey: "blockTypeViewer3d",  helpKey: "blockHelpViewer3d",  icon: Box,  size: { w: SHEET_COLS, h: 2 }, create: () => ({ model3dId: null, desktopView: "", mobileView: "", look: "render" }) },
  { type: "legend",    labelKey: "blockTypeLegend",    helpKey: "blockHelpLegend",    icon: ListOrdered, size: { w: 1, h: 2 }, create: () => ({ marker: "number", items: [empty()] }) },
  { type: "sequence",  labelKey: "blockTypeSequence",  helpKey: "blockHelpSequence",  icon: Rows3,  size: { w: SHEET_COLS, h: 1 }, create: () => ({ numbered: true, items: [] }) },
  { type: "materials", labelKey: "blockTypeMaterials", helpKey: "blockHelpMaterials", icon: Palette, size: { w: 1, h: 2 }, create: () => ({ items: [] }) },
]

export function blockType(type: DetailBlockType): BlockTypeDef {
  const def = BLOCK_TYPES.find((d) => d.type === type)
  if (!def) throw new Error(`[detail] unknown block type: ${type}`)
  return def
}

//The element id of a section heading on the public page, for the rail to reach it
export function sectionAnchor(blockId: string): string {
  return `section-${blockId}`
}

export function newBlockId(): string {
  return crypto.randomUUID().slice(0, 8)
}

//The content as stored: file ids are the truth, the urls next to them are
//re-resolved by the server on every read, and list items without a file go
export function storedContent(b: DetailBlock): DetailBlockContent {
  switch (b.type) {
    case "image": {
      const c = b.content as ImageBlockContent
      return { ...c, url: null }
    }
    case "video": {
      const c = b.content as VideoBlockContent
      return { ...c, url: null }
    }
    case "carousel": {
      const c = b.content as CarouselBlockContent
      return { ...c, items: c.items.filter((i) => i.fileId).map((i) => ({ ...i, url: null })) }
    }
    case "marquee": {
      const c = b.content as MarqueeBlockContent
      return { ...c, items: c.items.filter((i) => i.fileId).map((i) => ({ ...i, url: null })) }
    }
    case "sequence": {
      const c = b.content as SequenceBlockContent
      return { ...c, items: c.items.filter((i) => i.fileId).map((i) => ({ ...i, url: null })) }
    }
    case "materials": {
      const c = b.content as MaterialsBlockContent
      return { ...c, items: c.items.filter((i) => i.fileId).map((i) => ({ ...i, url: null })) }
    }
    case "compare": {
      const c = b.content as CompareBlockContent
      return { ...c, beforeUrl: null, afterUrl: null }
    }
    default:
      return b.content
  }
}

//The blocks whose media takes the size of the cell; every other block is
//text, and its cell grows to fit it
export const FILL_TYPES: ReadonlySet<DetailBlockType> = new Set([
  "image", "video", "carousel", "marquee", "compare", "embed", "viewer3d",
])

//Whether a visitor has anything to see in this block: an unfinished one is
//left out of the public page, and only the editor shows its placeholder
export function hasContent(b: DetailBlock, lang: Lang, models: Model3dDto[]): boolean {
  const filled = (t: Parameters<typeof pickBilingual>[0]) => pickBilingual(t, lang).trim() !== ""
  switch (b.type) {
    case "text":
    case "heading":
    case "quote":
      return filled((b.content as TextBlockContent).text)
    case "image":
      return Boolean((b.content as ImageBlockContent).url)
    case "video":
      return Boolean((b.content as VideoBlockContent).url)
    case "carousel":
      return (b.content as CarouselBlockContent).items.some((i) => i.url)
    case "marquee":
      return (b.content as MarqueeBlockContent).items.some((i) => i.url)
    case "compare": {
      const c = b.content as CompareBlockContent
      return Boolean(c.beforeUrl && c.afterUrl)
    }
    case "accordion":
      return (b.content as AccordionBlockContent).items.some((i) => filled(i.title) || filled(i.body))
    case "specs":
      return (b.content as SpecsBlockContent).rows.some((r) => filled(r.label) || filled(r.value))
    case "counters":
      return (b.content as CountersBlockContent).items.length > 0
    case "button": {
      const c = b.content as ButtonBlockContent
      return filled(c.label) && safeUrl(c.url) !== null
    }
    case "embed":
      return embedSrc((b.content as EmbedBlockContent).url) !== null
    case "viewer3d": {
      const id = (b.content as Viewer3dBlockContent).model3dId
      return models.some((m) => m.id === id && m.glbUrl)
    }
    case "legend":
      return (b.content as LegendBlockContent).items.some(filled)
    case "sequence":
      return (b.content as SequenceBlockContent).items.some((i) => i.url)
    case "materials":
      return (b.content as MaterialsBlockContent).items.some((i) => i.url)
  }
}

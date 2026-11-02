import type { Component } from "vue"
import {
  Box, Columns2, Film, GalleryHorizontalEnd, Hash, Heading1, ImageIcon, Images,
  ListCollapse, MonitorPlay, MousePointerClick, Quote, Table, Type,
} from "lucide-vue-next"
import type {
  CarouselBlockContent, CompareBlockContent, DetailBlock, DetailBlockContent, DetailBlockType,
  ImageBlockContent, MarqueeBlockContent, VideoBlockContent,
} from "../../../types/portfolio"

//BLOCK TYPE REGISTRY - one entry per type: label key, icon, the size a new
//block gets on the desktop grid, and its starting content. inline: the block
//holds one bilingual `text` the author can type on the canvas.
export interface BlockTypeDef {
  type:     DetailBlockType
  labelKey: string
  icon:     Component
  size:     { w: number; h: number }
  inline:   boolean
  create:   () => DetailBlockContent
}

const empty = () => ({ fr: "", en: "" })

export const BLOCK_TYPES: BlockTypeDef[] = [
  { type: "text",      labelKey: "blockTypeText",      icon: Type,      size: { w: 1, h: 2 }, inline: true,  create: () => ({ text: empty() }) },
  { type: "heading",   labelKey: "blockTypeHeading",   icon: Heading1,   size: { w: 3, h: 1 }, inline: true,  create: () => ({ text: { fr: "Section", en: "Section" } }) },
  { type: "quote",     labelKey: "blockTypeQuote",     icon: Quote,     size: { w: 2, h: 1 }, inline: true,  create: () => ({ text: empty(), author: "" }) },
  { type: "image",     labelKey: "blockTypeImage",     icon: ImageIcon,     size: { w: 2, h: 2 }, inline: false, create: () => ({ fileId: null, url: null, alt: empty(), fit: "cover" }) },
  { type: "video",     labelKey: "blockTypeVideo",     icon: Film,     size: { w: 2, h: 2 }, inline: false, create: () => ({ fileId: null, url: null, autoplay: true, loop: true, muted: true, controls: false }) },
  { type: "carousel",  labelKey: "blockTypeCarousel",  icon: Images,  size: { w: 3, h: 2 }, inline: false, create: () => ({ items: [], intervalMs: 0 }) },
  { type: "marquee",   labelKey: "blockTypeMarquee",   icon: GalleryHorizontalEnd,   size: { w: 3, h: 1 }, inline: false, create: () => ({ items: [], speedPxs: 60 }) },
  { type: "compare",   labelKey: "blockTypeCompare",   icon: Columns2,   size: { w: 2, h: 2 }, inline: false, create: () => ({
      beforeFileId: null, beforeUrl: null, afterFileId: null, afterUrl: null,
      beforeLabel: { fr: "Avant", en: "Before" }, afterLabel: { fr: "Après", en: "After" }, followMouse: false,
    }) },
  { type: "accordion", labelKey: "blockTypeAccordion", icon: ListCollapse, size: { w: 1, h: 2 }, inline: false, create: () => ({ items: [{ title: empty(), body: empty() }] }) },
  { type: "specs",     labelKey: "blockTypeSpecs",     icon: Table,     size: { w: 1, h: 2 }, inline: false, create: () => ({ rows: [{ label: empty(), value: empty() }] }) },
  { type: "counters",  labelKey: "blockTypeCounters",  icon: Hash,  size: { w: 3, h: 1 }, inline: false, create: () => ({ items: [{ label: empty(), value: 0 }] }) },
  { type: "button",    labelKey: "blockTypeButton",    icon: MousePointerClick,    size: { w: 1, h: 1 }, inline: false, create: () => ({ label: empty(), url: "", newTab: true }) },
  { type: "embed",     labelKey: "blockTypeEmbed",     icon: MonitorPlay,     size: { w: 2, h: 2 }, inline: false, create: () => ({ url: "" }) },
  { type: "viewer3d",  labelKey: "blockTypeViewer3d",  icon: Box,  size: { w: 3, h: 2 }, inline: false, create: () => ({ model3dId: null, desktopView: "", mobileView: "" }) },
]

export function blockType(type: DetailBlockType): BlockTypeDef {
  const def = BLOCK_TYPES.find((d) => d.type === type)
  if (!def) throw new Error(`[detail] unknown block type: ${type}`)
  return def
}

export function newBlockId(): string {
  return crypto.randomUUID().slice(0, 8)
}

//the content as stored: file ids are the truth, the urls next to them are
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
    case "compare": {
      const c = b.content as CompareBlockContent
      return { ...c, beforeUrl: null, afterUrl: null }
    }
    default:
      return b.content
  }
}

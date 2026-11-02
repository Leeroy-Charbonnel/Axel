import type { Bilingual, ExperienceDto, GalleryProjectDto, MainProjectDto, PortfolioDto, ProfileDto } from "../../types/portfolio"
import { apiJson } from "../../composables/usePortfolio"
import type { Lang } from "../../lib/lang"

//REGISTRY OF THE EDITABLE ENTITIES. The editor, the inspector, the order list
//and the add buttons all read this one table: where a kind lives in the
//portfolio, how it is titled, and how its draft becomes a request body.

export interface EntityOf {
  profile:     ProfileDto
  mainProject: MainProjectDto
  galleryItem: GalleryProjectDto
  experience:  ExperienceDto
}

//file ids travel next to the url the page renders: the DTO only carries urls
interface ExtraOf {
  profile:     object
  mainProject: { mainImageFileId: string | null; mainWireframeFileId: string | null }
  galleryItem: { imageFileId: string | null }
  experience:  object
}

export type EntityKind = keyof EntityOf
//the profile is a singleton: its id is null
export type EntityId   = number | null
export type DraftOf<K extends EntityKind> = Partial<EntityOf[K] & ExtraOf[K]>

export interface KindDef<K extends EntityKind> {
  labelKey:   string
  list:       (data: PortfolioDto) => EntityOf[K][]
  idOf:       (entity: EntityOf[K]) => EntityId
  title:      (entity: EntityOf[K], lang: Lang) => string
  //draft key -> the key it travels with; dropped together when the pair matches the saved value
  linked:     Record<string, string>
  //collections have create / order / delete routes and a published flag
  collection: { base: string; addKey: string } | null
  save:       (id: EntityId, patch: DraftOf<K>) => Promise<void>
}

export function entityKey(kind: EntityKind, id: EntityId): string {
  return id === null ? kind : `${kind}:${id}`
}

export function pickLang(text: Bilingual | undefined, lang: Lang): string {
  if (!text) return ""
  return text[lang] || text[lang === "fr" ? "en" : "fr"] || ""
}

const nonEmpty = (list: string[]) => list.filter((s) => s.trim() !== "")

//what an empty site edits before the profile row exists; PUT /api/profile creates it
const EMPTY_PROFILE: ProfileDto = {
  name:         "",
  headline:     { fr: "", en: "" },
  pitch:        { fr: "", en: "" },
  location:     "",
  available:    false,
  availability: { fr: "", en: "" },
  about:        { fr: "", en: "" },
  contact:      { phone: "", email: "" },
  links:        { instagram: "", artstation: "", sketchfab: "", linkedin: "", website: "" },
  interests:    { games: [], art: [] },
  avatarUrl:    "",
  cvUrl:        null,
}

export const KINDS: { [K in EntityKind]: KindDef<K> } = {
  profile: {
    labelKey:   "editorKindProfile",
    list:       (data) => [data.profile ?? EMPTY_PROFILE],
    idOf:       () => null,
    title:      (p) => p.name,
    linked:     {},
    collection: null,
    save: async (_id, patch) => {
      const body: Record<string, unknown> = { ...patch }
      if (patch.interests) body.interests = { games: nonEmpty(patch.interests.games), art: nonEmpty(patch.interests.art) }
      await apiJson("PUT", "/api/profile", body)
    },
  },
  mainProject: {
    labelKey:   "editorKindMainProject",
    list:       (data) => data.mainProjects,
    idOf:       (p) => p.id,
    title:      (p, lang) => pickLang(p.title, lang),
    linked:     { mainImageFileId: "mainImageUrl", mainWireframeFileId: "mainWireframeUrl" },
    collection: { base: "/api/main-project", addKey: "editorAddMainProject" },
    save: async (id, patch) => {
      const { software, mainImageUrl: _image, mainWireframeUrl: _wireframe, thumbnails, ...rest } = patch
      const body: Record<string, unknown> = { ...rest }
      //the jsonb column stores ids only; urls are resolved on read
      if (thumbnails) {
        body.thumbnails = thumbnails.map((t) => ({ fileId: t.fileId, wireframeFileId: t.wireframeFileId, description: t.description }))
      }
      if (Object.keys(body).length) await apiJson("PUT", `/api/main-project/${id}`, body)
      if (software) await apiJson("PUT", `/api/main-project/${id}/software`, { softwareIds: software.map((s) => s.id) })
    },
  },
  galleryItem: {
    labelKey:   "editorKindGalleryItem",
    list:       (data) => data.galleryProjects,
    idOf:       (g) => g.id,
    title:      (g, lang) => pickLang(g.title, lang),
    linked:     { imageFileId: "imageUrl" },
    collection: { base: "/api/gallery-project", addKey: "editorAddGalleryItem" },
    save: async (id, patch) => {
      const { imageUrl: _image, ...body } = patch
      await apiJson("PUT", `/api/gallery-project/${id}`, body)
    },
  },
  experience: {
    labelKey:   "editorKindExperience",
    list:       (data) => data.experiences,
    idOf:       (e) => e.id,
    title:      (e, lang) => [pickLang(e.title, lang), e.company].filter(Boolean).join(" - "),
    linked:     {},
    collection: { base: "/api/experience", addKey: "editorAddExperience" },
    save: async (id, patch) => {
      const body: Record<string, unknown> = { ...patch }
      if (patch.description) body.description = { fr: nonEmpty(patch.description.fr), en: nonEmpty(patch.description.en) }
      await apiJson("PUT", `/api/experience/${id}`, body)
    },
  },
}

//KIND-AGNOSTIC ACCESS for code that only knows the kind at run time. The
//registry is typed per kind; these widen it once, here.
type AnyEntity = EntityOf[EntityKind]

export function listOf(kind: EntityKind, data: PortfolioDto): AnyEntity[] {
  return KINDS[kind].list(data)
}

export function idOf(kind: EntityKind, entity: AnyEntity): EntityId {
  return (KINDS[kind].idOf as (e: AnyEntity) => EntityId)(entity)
}

export function titleOf(kind: EntityKind, entity: AnyEntity, lang: Lang): string {
  return (KINDS[kind].title as (e: AnyEntity, l: Lang) => string)(entity, lang)
}

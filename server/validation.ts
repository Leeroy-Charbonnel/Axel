import { z } from "zod"
import { GRID_SETTINGS, gridOf, type GridSettingDef } from "../src/lib/detail-grid"

//BODY ALLOW-LISTS. Every POST / PUT body goes through one of these: strict
//objects, so an unknown key is a 400 instead of a column written by accident.
//The shapes mirror src/types/portfolio.ts.

const bilingual = z.strictObject({ en: z.string(), fr: z.string() })
const fileId    = z.uuid()

//"" or an absolute http(s) URL: links end up in href attributes
export const httpUrl = z.string().trim().refine(
  (v) => v === "" || (/^https?:\/\//i.test(v) && URL.canParse(v)),
  "must be empty or an http(s) URL",
)

const stats = z.strictObject({
  vertices:  z.number(),
  edges:     z.number(),
  faces:     z.number().optional(),
  triangles: z.number().optional(),
})

const uniqueInts = z.array(z.int().positive()).refine(
  (ids) => new Set(ids).size === ids.length,
  "ids must be unique",
)

export const orderBody = z.strictObject({ ids: uniqueInts })

export const projectSoftwareBody = z.strictObject({ softwareIds: uniqueInts })

//DETAIL BLOCKS - one content shape per type, as src/types/portfolio.ts and
//the block editors write them. The urls next to file ids are resolved on
//read and stored as null (storedContent in block-types.ts).
const storedUrl = z.null()
const imageItem = z.strictObject({ fileId, url: storedUrl })

const BLOCK_CONTENT = {
  text:      z.strictObject({ text: bilingual }),
  heading:   z.strictObject({ text: bilingual }),
  quote:     z.strictObject({ text: bilingual, author: z.string() }),
  image:     z.strictObject({
               fileId: fileId.nullable(),
               url:    storedUrl,
               alt:    bilingual.optional(),
               fit:    z.enum(["cover", "contain", "fill", "none"]).optional(),
             }),
  video:     z.strictObject({
               fileId:   fileId.nullable(),
               url:      storedUrl,
               autoplay: z.boolean(),
               loop:     z.boolean(),
               muted:    z.boolean(),
               controls: z.boolean(),
             }),
  carousel:  z.strictObject({
               items:      z.array(imageItem.extend({ caption: bilingual.optional() })),
               intervalMs: z.number().nonnegative(),
             }),
  marquee:   z.strictObject({ items: z.array(imageItem), speedPxs: z.number().positive() }),
  compare:   z.strictObject({
               beforeFileId: fileId.nullable(),
               beforeUrl:    storedUrl,
               afterFileId:  fileId.nullable(),
               afterUrl:     storedUrl,
               beforeLabel:  bilingual,
               afterLabel:   bilingual,
               followMouse:  z.boolean().optional(),
             }),
  accordion: z.strictObject({ items: z.array(z.strictObject({ title: bilingual, body: bilingual })) }),
  specs:     z.strictObject({ rows: z.array(z.strictObject({ label: bilingual, value: bilingual })) }),
  counters:  z.strictObject({ items: z.array(z.strictObject({ label: bilingual, value: z.number() })) }),
  //the two contents that become a link or an iframe src
  button:    z.strictObject({ label: bilingual, url: httpUrl, newTab: z.boolean() }),
  embed:     z.strictObject({ url: httpUrl }),
  viewer3d:  z.strictObject({
               model3dId:   fileId.nullable(),
               desktopView: z.string(),
               mobileView:  z.string(),
               look:        z.enum(["render", "blueprint", "exploded"]).optional(),
             }),
  legend:    z.strictObject({ marker: z.enum(["number", "letter"]), items: z.array(bilingual) }),
  sequence:  z.strictObject({ numbered: z.boolean(), items: z.array(imageItem.extend({ caption: bilingual })) }),
  materials: z.strictObject({
               items: z.array(imageItem.extend({
                 name: bilingual,
                 rows: z.array(z.strictObject({ label: bilingual, value: z.string() })),
               })),
             }),
} as const

const blockFrame = {
  id:      z.string().min(1),
  x:       z.int().nonnegative(),
  y:       z.int().nonnegative(),
  w:       z.int().positive(),
  h:       z.int().positive(),
  mobileY: z.int().nonnegative().optional(),
  mobileH: z.int().positive().optional(),
  style:   z.strictObject({
    borderSides: z.enum(["none", "all", "top", "bottom", "left", "right", "top-bottom", "left-right"]).optional(),
    borderWidth: z.number().nonnegative().optional(),
    borderStyle: z.enum(["solid", "dashed", "dotted", "dash-dot", "double"]).optional(),
  }).optional(),
}

//Each grid setting within the limits and on the step of its registry entry
export const detailGrid = z.strictObject(Object.fromEntries(
  GRID_SETTINGS.map((g) => [g.key, z.int().min(g.min).max(g.max).multipleOf(g.step)]),
) as Record<GridSettingDef["key"], z.ZodInt>)

type BlockType = keyof typeof BLOCK_CONTENT
const blockOf = <T extends BlockType>(type: T) =>
  z.strictObject({ ...blockFrame, type: z.literal(type), content: BLOCK_CONTENT[type] })

export const detailBlock = z.discriminatedUnion("type", [
  blockOf("text"), blockOf("heading"), blockOf("quote"), blockOf("image"), blockOf("video"),
  blockOf("carousel"), blockOf("marquee"), blockOf("compare"), blockOf("accordion"), blockOf("specs"),
  blockOf("counters"), blockOf("button"), blockOf("embed"), blockOf("viewer3d"),
  blockOf("legend"), blockOf("sequence"), blockOf("materials"),
])

//Every block ends within the page's columns
const detailPage = z.strictObject({ blocks: z.array(detailBlock), grid: detailGrid.optional() }).superRefine((page, ctx) => {
  const cols = gridOf(page).cols
  page.blocks.forEach((b, i) => {
    if (b.x + b.w > cols) ctx.addIssue({ code: "custom", path: ["blocks", i], message: `block ${b.id} ends past column ${cols}` })
  })
})

export const mainProjectPatch = z.strictObject({
  title:              bilingual,
  description:        bilingual,
  published:          z.boolean(),
  role:               bilingual,
  year:               z.string().trim().max(20),
  mainImageFileId:    fileId.nullable(),
  mainWireframeFileId: fileId.nullable(),
  model3dId:          fileId.nullable(),
  model3dDesktopView: z.string(),
  model3dMobileView:  z.string(),
  thumbnails:         z.array(z.strictObject({
                        fileId:          fileId.nullable(),
                        wireframeFileId: fileId.nullable(),
                        description:     bilingual,
                      })),
  detailPage:         detailPage,
  stats,
}).partial()

export const galleryProjectPatch = z.strictObject({
  title:       bilingual,
  link:        httpUrl,
  imageFileId: fileId.nullable(),
  stats,
  published:   z.boolean(),
}).partial()

export const experiencePatch = z.strictObject({
  period:      bilingual,
  title:       bilingual,
  company:     z.string(),
  location:    z.string(),
  summary:     bilingual,
  description: z.strictObject({ en: z.array(z.string()), fr: z.array(z.string()) }),
  published:   z.boolean(),
}).partial()

//multipart fields of POST /api/software, the logo travels as the file
export const softwareCreate = z.strictObject({
  key: z.string().trim().min(1, "key is required"),
  url: httpUrl,
})

export const softwarePatch = z.strictObject({
  key:        z.string().trim().min(1, "key is required"),
  url:        httpUrl,
  logoFileId: fileId,
}).partial()

export const profilePatch = z.strictObject({
  name:         z.string().trim(),
  headline:     bilingual,
  pitch:        bilingual,
  location:     z.string().trim(),
  available:    z.boolean(),
  availability: bilingual,
  about:        bilingual,
  contact:      z.strictObject({ phone: z.string().trim(), email: z.union([z.literal(""), z.email()]) }),
  links:        z.strictObject({
                  instagram:  httpUrl,
                  artstation: httpUrl,
                  sketchfab:  httpUrl,
                  linkedin:   httpUrl,
                  website:    httpUrl,
                }),
  interests:    z.strictObject({ games: z.array(z.string()), art: z.array(z.string()) }),
  //an uploaded file: the CSP serves images from this origin only
  avatarUrl:    z.string().trim().refine(
                  (v) => v === "" || v.startsWith("/media/"),
                  "must be empty or a /media/ path",
                ),
  cvFileId:     fileId.nullable(),
}).partial()

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const modelView = z.strictObject({
  name:      z.string().min(1),
  position:  vec3,
  target:    vec3,
  zoom:      z.number().optional(),
  wireframe: z.boolean(),
  aspect:    z.number().positive().optional(),
})

//the model's picture is not a field: PUT /api/models/:id/thumbnail stores a render
export const modelCreate = z.strictObject({
  name:            z.string().trim().min(1, "name is required"),
  glbFileId:       fileId,
  views:           z.array(modelView).optional(),
})

export const modelPatch = z.strictObject({
  name:            z.string().trim().min(1, "name is required"),
  glbFileId:       fileId,
  sourceGlbFileId: fileId.nullable(),
  views:           z.array(modelView),
}).partial()

//the editor snapshot is the viewer's own format; only its envelope is checked
export const viewerSettingsBody = z.record(z.string(), z.unknown())

export const settingKey = z.string().min(1).max(100)

export const settingBody = z.strictObject({
  value:       z.string(),
  description: z.string().optional(),
  type:        z.string().optional(),
  group:       z.string().optional(),
  options:     z.string().optional(),
})

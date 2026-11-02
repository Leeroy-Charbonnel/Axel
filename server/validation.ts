import { z } from "zod"

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

const DETAIL_BLOCK_TYPES = [
  "text", "heading", "quote", "image", "video", "carousel", "marquee",
  "compare", "accordion", "specs", "counters", "button", "embed", "viewer3d",
] as const

const detailBlock = z.strictObject({
  id:      z.string().min(1),
  type:    z.enum(DETAIL_BLOCK_TYPES),
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
  content: z.record(z.string(), z.unknown()),
}).superRefine((block, ctx) => {
  //the two block types whose content becomes a link or an iframe src
  if (block.type !== "button" && block.type !== "embed") return
  if (!httpUrl.safeParse(block.content.url ?? "").success) {
    ctx.addIssue({ code: "custom", path: ["content", "url"], message: `${block.type} url must be empty or an http(s) URL` })
  }
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
  detailPage:         z.strictObject({ blocks: z.array(detailBlock) }),
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

export const modelCreate = z.strictObject({
  name:            z.string().trim().min(1, "name is required"),
  glbFileId:       fileId,
  thumbnailFileId: fileId.nullable().optional(),
  views:           z.array(modelView).optional(),
})

export const modelPatch = z.strictObject({
  name:            z.string().trim().min(1, "name is required"),
  glbFileId:       fileId,
  thumbnailFileId: fileId.nullable(),
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

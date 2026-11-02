import type { Bilingual, DetailBlock, DetailBlockContent, DetailBlockType, ProjectStats } from "../types/portfolio"

//SHOWCASE CONTENT - sample case studies that use every block type in varied
//layouts. scripts/seed-showcase.ts writes them as unpublished projects; the
//styleguide renders one block of each type from them. Media are existing
//files, passed in by the caller.

export interface ShowcaseFile { id: string; url: string | null }

export interface ShowcaseModel { id: string; name: string; view: string }

export interface ShowcaseMedia {
  images: ShowcaseFile[]
  videos: ShowcaseFile[]
  models: ShowcaseModel[]
}

//the model whose name matches, else the first one, else none
function pickModel(m: ShowcaseMedia, hint: RegExp): ShowcaseModel | null {
  return m.models.find((x) => hint.test(x.name)) ?? m.models[0] ?? null
}

export interface ShowcaseProject {
  title:       Bilingual
  description: Bilingual
  role:        Bilingual
  year:        string
  stats:       ProjectStats
  blocks:      DetailBlock[]
}

//every showcase title starts with this, which is how the seed finds its rows
export const SHOWCASE_PREFIX = "Showcase"

const bi = (fr: string, en: string): Bilingual => ({ fr, en })

function builder(prefix: string, m: ShowcaseMedia) {
  let n = 0
  const blocks: DetailBlock[] = []
  if (!m.images.length) throw new Error("[showcase] at least one image is needed")
  const img = (i: number) => m.images[i % m.images.length]!

  function add(type: DetailBlockType, [x, y, w, h]: [number, number, number, number], content: DetailBlockContent) {
    blocks.push({ id: `${prefix}${++n}`, type, x, y, w, h, content })
  }
  //the phone layout in reading order, with the spans that differ from desktop
  function authorPhone(spans: Record<number, number> = {}) {
    let y = 0
    const ordered = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)
    ordered.forEach((b) => {
      const index = blocks.indexOf(b) + 1
      b.mobileY = y
      b.mobileH = spans[index] ?? b.h
      y += b.mobileH
    })
  }
  const image = (i: number, alt: Bilingual, fit: "cover" | "contain" = "cover") =>
    ({ fileId: img(i).id, url: img(i).url, alt, fit })
  const strip = (from: number, count: number) =>
    Array.from({ length: count }, (_, k) => ({ fileId: img(from + k).id, url: img(from + k).url }))

  return { blocks, add, authorPhone, image, strip, img }
}

//PROJECT 1 - furniture, every row a different split, phone layout authored
function armchair(m: ShowcaseMedia): ShowcaseProject {
  const b = builder("sc1-", m)
  b.add("heading", [0, 0, 3, 1], { text: bi("Le brief", "The brief") })
  b.add("image", [0, 1, 2, 2], b.image(0, bi("Le fauteuil Atelier de trois quarts, rendu studio", "The Atelier armchair in three-quarter view, studio render")))
  b.add("text", [2, 1, 1, 2], { text: bi(
    "Un éditeur de mobilier lyonnais voulait **des vues produit** pour son catalogue et un modèle assez léger pour son configurateur en ligne.\n\nTrois contraintes :\n- dimensions exactes, au millimètre près\n- un seul jeu de textures pour toutes les finitions\n- moins de 100 000 triangles",
    "A furniture brand from Lyon needed **product shots** for its catalogue and a model light enough for its online configurator.\n\nThree constraints:\n- exact dimensions, down to the millimetre\n- one texture set for every finish\n- under 100,000 triangles",
  ) })
  b.add("counters", [0, 3, 3, 1], { items: [
    { label: bi("Heures de travail", "Hours of work"), value: 38 },
    { label: bi("Textures 4K", "4K textures"), value: 6 },
    { label: bi("Triangles", "Triangles"), value: 95640 },
  ] })
  b.add("carousel", [0, 4, 3, 2], { intervalMs: 5000, items: [0, 1, 2, 3].map((i) => ({
    fileId: b.img(i + 1).id, url: b.img(i + 1).url,
    caption: [bi("Blocking des volumes", "Volume blocking"), bi("Coutures du cuir", "Leather stitching"), bi("Veinage du noyer", "Walnut grain"), bi("Rendu final", "Final render")][i],
  })) })
  b.add("heading", [0, 6, 3, 1], { text: bi("Matériaux", "Materials") })
  b.add("compare", [0, 7, 2, 2], {
    beforeFileId: b.img(2).id, beforeUrl: b.img(2).url, afterFileId: b.img(3).id, afterUrl: b.img(3).url,
    beforeLabel: bi("Argile", "Clay"), afterLabel: bi("Texturé", "Textured"), followMouse: false,
  })
  b.add("specs", [2, 7, 1, 2], { rows: [
    { label: bi("Logiciels", "Software"),        value: bi("Blender, Substance Painter", "Blender, Substance Painter") },
    { label: bi("Rendu", "Renderer"),            value: bi("Cycles", "Cycles") },
    { label: bi("Textures", "Textures"),         value: bi("6 x 4K, PBR", "6 x 4K, PBR") },
    { label: bi("Livrables", "Deliverables"),    value: bi("GLB, FBX, 12 rendus", "GLB, FBX, 12 renders") },
    { label: bi("Échelle", "Scale"),             value: bi("Réelle, en centimètres", "Real world, in centimetres") },
  ] })
  b.add("quote", [0, 9, 3, 1], {
    text: bi("Le modèle est entré dans le configurateur sans retouche, et les mêmes rendus ont servi au catalogue papier.", "The model went into the configurator untouched, and the same renders were used for the printed catalogue."),
    author: "Direction artistique du client",
  })
  b.add("accordion", [0, 10, 1, 2], { items: [
    { title: bi("Blocking", "Blocking"), body: bi("Volumes posés sur les cotes du fabricant, validés en une journée.", "Volumes built on the maker's measurements, signed off in a day.") },
    { title: bi("Détails", "Details"), body: bi("Coutures en courbes suivies, plis du cuir sculptés puis bakés.", "Stitching along curves, leather folds sculpted then baked.") },
    { title: bi("UV et textures", "UVs and textures"), body: bi("Un seul set UDIM, finitions pilotées par masques.", "One UDIM set, finishes driven by masks.") },
  ] })
  b.add("text", [1, 10, 1, 2], { text: bi(
    "### Livraison\nLe GLB pèse **3,2 Mo** après compression meshopt. Les finitions noyer, chêne et noir sont des variantes de matériau, sans géométrie dupliquée.",
    "### Delivery\nThe GLB weighs **3.2 MB** after meshopt compression. The walnut, oak and black finishes are material variants, with no duplicated geometry.",
  ) })
  b.add("button", [2, 10, 1, 1], { label: bi("Voir la planche ArtStation", "See the ArtStation board"), url: "https://www.artstation.com/", newTab: true })
  b.add("image", [2, 11, 1, 1], b.image(4, bi("Détail de l'accoudoir", "Armrest detail")))
  const model = pickModel(m, /chaise|chair|table/i)
  if (model) b.add("viewer3d", [0, 12, 3, 2], { model3dId: model.id, desktopView: model.view, mobileView: model.view })
  b.add("marquee", [0, 14, 3, 1], { speedPxs: 60, items: b.strip(0, 6) })
  //phone: longer text, counters and specs get the room they need
  b.authorPhone({ 3: 3, 4: 2, 8: 3, 10: 3, 11: 3 })
  return {
    title:       bi(`${SHOWCASE_PREFIX} 1 : Fauteuil Atelier, du brief au rendu`, `${SHOWCASE_PREFIX} 1: Atelier armchair, from brief to render`),
    description: bi(
      "Page de test. Un fauteuil lounge en noyer et cuir, modélisé pour le catalogue d'un éditeur de mobilier et pour son configurateur web.",
      "Test page. A walnut and leather lounge chair, modelled for a furniture brand's catalogue and for its web configurator.",
    ),
    role:  bi("Modélisation, UV, texturing, rendu", "Modelling, UVs, texturing, rendering"),
    year:  "2025",
    stats: { vertices: 48210, edges: 96030, faces: 47880, triangles: 95640 },
    blocks: b.blocks,
  }
}

//PROJECT 2 - game prop, a tall block and three columns, phone left automatic
function lantern(m: ShowcaseMedia): ShowcaseProject {
  const b = builder("sc2-", m)
  b.add("image", [0, 0, 1, 3], b.image(5, bi("La lanterne en pied, vue de face", "The lantern full height, front view"), "contain"))
  b.add("text", [1, 0, 2, 2], { text: bi(
    "## Contexte\nUn studio indépendant cherchait du mobilier urbain pour un jeu d'aventure en vue à la troisième personne. La lanterne revient **des centaines de fois** dans chaque niveau : chaque triangle compte.\n\nJ'ai partagé une texture 2K avec les bancs et les grilles du même kit, pour ne coûter qu'un seul appel de rendu.",
    "## Context\nAn independent studio needed street furniture for a third-person adventure game. The lantern appears **hundreds of times** in every level: every triangle counts.\n\nI shared one 2K texture with the benches and railings of the same kit, so it costs a single draw call.",
  ) })
  b.add("quote", [1, 2, 2, 1], { text: bi("Lisible à vingt mètres, propre à un mètre.", "Readable at twenty metres, clean at one."), author: "Brief du lead artist" })
  b.add("heading", [0, 3, 3, 1], { text: bi("Trois niveaux de détail", "Three levels of detail") })
  b.add("image", [0, 4, 1, 2], b.image(6, bi("LOD 0, 2 980 triangles", "LOD 0, 2,980 triangles")))
  b.add("image", [1, 4, 1, 2], b.image(7, bi("LOD 1, 1 200 triangles", "LOD 1, 1,200 triangles")))
  b.add("image", [2, 4, 1, 2], b.image(8, bi("LOD 2, 400 triangles", "LOD 2, 400 triangles")))
  const video = m.videos[0]
  if (video) b.add("video", [0, 6, 2, 2], { fileId: video.id, url: video.url, autoplay: true, loop: true, muted: true, controls: false })
  else b.add("image", [0, 6, 2, 2], b.image(9, bi("Turntable de la lanterne", "Lantern turntable")))
  b.add("specs", [2, 6, 1, 2], { rows: [
    { label: bi("Budget", "Budget"),   value: bi("3 000 triangles", "3,000 triangles") },
    { label: bi("LOD", "LODs"),        value: bi("3 niveaux", "3 levels") },
    { label: bi("Texture", "Texture"), value: bi("2K partagée", "Shared 2K") },
    { label: bi("Moteur", "Engine"),   value: bi("Unreal Engine 5", "Unreal Engine 5") },
  ] })
  b.add("embed", [0, 8, 2, 2], { url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" })
  b.add("accordion", [2, 8, 1, 2], { items: [
    { title: bi("Contraintes", "Constraints"), body: bi("Collision simplifiée en 12 triangles, pivot au pied.", "Simplified 12-triangle collision, pivot at the base.") },
    { title: bi("Lumière", "Lighting"), body: bi("Le verre émissif est masqué en LOD 2.", "The emissive glass is masked out at LOD 2.") },
  ] })
  b.add("counters", [0, 10, 3, 1], { items: [
    { label: bi("Triangles", "Triangles"), value: 2980 },
    { label: bi("Pixels de texture", "Texture pixels"), value: 2048 },
    { label: bi("Appel de rendu", "Draw call"), value: 1 },
  ] })
  b.add("button", [1, 11, 1, 1], { label: bi("Voir le kit complet", "See the full kit"), url: "https://www.artstation.com/", newTab: true })
  return {
    title:       bi(`${SHOWCASE_PREFIX} 2 : Lanterne de rue, prop de jeu vidéo`, `${SHOWCASE_PREFIX} 2: Street lantern, game prop`),
    description: bi(
      "Page de test. Une lanterne en fonte pour un jeu d'aventure, tenue dans un budget de 3 000 triangles. Sur téléphone, les blocs s'empilent automatiquement.",
      "Test page. A cast-iron lantern for an adventure game, kept within a 3,000-triangle budget. On phones the blocks stack automatically.",
    ),
    role:  bi("Prop artist, low et high poly, baking", "Prop artist, low and high poly, baking"),
    year:  "2024",
    stats: { vertices: 1620, edges: 3180, faces: 0, triangles: 2980 },
    blocks: b.blocks,
  }
}

//PROJECT 3 - organic sculpt around the 3D viewer, phone layout authored
function dragon(m: ShowcaseMedia): ShowcaseProject {
  const b = builder("sc3-", m)
  const model = pickModel(m, /dragon/i)
  if (model) b.add("viewer3d", [0, 0, 2, 3], { model3dId: model.id, desktopView: model.view, mobileView: model.view })
  else b.add("image", [0, 0, 2, 3], b.image(10, bi("Le dragon, rendu final", "The dragon, final render")))
  b.add("specs", [2, 0, 1, 2], { rows: [
    { label: bi("Sculpt", "Sculpt"),       value: bi("12 M de polygones", "12 M polygons") },
    { label: bi("Retopologie", "Retopo"),  value: bi("76 000 quads", "76,000 quads") },
    { label: bi("Textures", "Textures"),   value: bi("4 x 4K", "4 x 4K") },
    { label: bi("Rig", "Rig"),             value: bi("Prêt pour l'animation", "Animation ready") },
  ] })
  b.add("button", [2, 2, 1, 1], { label: bi("Discuter d'un projet", "Talk about a project"), url: "https://www.artstation.com/", newTab: false })
  b.add("marquee", [0, 3, 3, 1], { speedPxs: 30, items: b.strip(3, 5) })
  b.add("text", [0, 4, 1, 2], { text: bi(
    "### Sculpt\nAnatomie posée d'abord en volumes simples, puis écailles en trois passes de brosses alpha. Les plis de la membrane des ailes suivent la tension du squelette.",
    "### Sculpt\nAnatomy blocked in simple volumes first, then scales in three passes of alpha brushes. The wing membrane folds follow the tension of the skeleton.",
  ) })
  b.add("compare", [1, 4, 2, 2], {
    beforeFileId: b.img(11).id, beforeUrl: b.img(11).url, afterFileId: b.img(12).id, afterUrl: b.img(12).url,
    beforeLabel: bi("Sculpt", "Sculpt"), afterLabel: bi("Retopologie", "Retopology"), followMouse: true,
  })
  b.add("heading", [0, 6, 3, 1], { text: bi("Retopologie pour l'animation", "Retopology for animation") })
  b.add("carousel", [0, 7, 2, 2], { intervalMs: 0, items: [13, 14, 15].map((i, k) => ({
    fileId: b.img(i).id, url: b.img(i).url,
    caption: [bi("Boucles autour des yeux", "Loops around the eyes"), bi("Épaules et ailes", "Shoulders and wings"), bi("Queue en anneaux", "Ringed tail")][k],
  })) })
  b.add("accordion", [2, 7, 1, 2], { items: [
    { title: bi("Pourquoi des quads", "Why quads"), body: bi("Les boucles suivent les muscles : les déformations restent propres en animation.", "The loops follow the muscles, so deformations stay clean when animated.") },
    { title: bi("Densité", "Density"), body: bi("Plus dense aux articulations, plus léger sur le dos.", "Denser at the joints, lighter along the back.") },
    { title: bi("Baking", "Baking"), body: bi("Normales et cavité bakées depuis le sculpt complet.", "Normals and cavity baked from the full sculpt.") },
  ] })
  b.add("text", [0, 9, 3, 1], { text: bi(
    "Le modèle final garde le détail du sculpt dans ses textures tout en restant **léger à animer**.",
    "The final model keeps the sculpt's detail in its textures while staying **light to animate**.",
  ) })
  b.add("image", [0, 10, 3, 2], b.image(16, bi("Le dragon en vol, rendu final", "The dragon in flight, final render")))
  //phone: the viewer first and tall, the carousel and the closing text roomier
  b.authorPhone({ 1: 3, 2: 3, 5: 3, 6: 2, 8: 2, 9: 3, 10: 2 })
  return {
    title:       bi(`${SHOWCASE_PREFIX} 3 : Dragon, sculpt et retopologie`, `${SHOWCASE_PREFIX} 3: Dragon, sculpt and retopology`),
    description: bi(
      "Page de test. Une créature sculptée puis retopologisée pour l'animation, autour de la visionneuse 3D, avec une mise en page mobile dédiée.",
      "Test page. A creature sculpted then retopologised for animation, built around the 3D viewer, with a dedicated phone layout.",
    ),
    role:  bi("Sculpt, retopologie, texturing", "Sculpt, retopology, texturing"),
    year:  "2023",
    stats: { vertices: 152400, edges: 304200, faces: 151900, triangles: 303800 },
    blocks: b.blocks,
  }
}

export function showcaseProjects(m: ShowcaseMedia): ShowcaseProject[] {
  return [armchair(m), lantern(m), dragon(m)]
}

import type {
  AccordionBlockContent, Bilingual, DetailBlock, ExperienceDto, ImageBlockContent, MainProjectDto, PortfolioDto,
  ProfileDto, QuoteBlockContent, SpecsBlockContent, TextBlockContent,
} from "../src/types/portfolio"
import type { Lang } from "../src/lib/lang"
import { derivativeUrl, storedImage, type ImageFormat } from "../src/lib/media"

//SEO AND AI DISCOVERABILITY. Crawlers, social scrapers and AI search tools
//mostly do not run JavaScript, so every public page is served with its real
//content: meta tags, JSON-LD and a semantic HTML snapshot that Vue's mount
//replaces. Everything here is a pure function of the public portfolio.

export type Page = {
  status: number
  lang:   Lang
  head:   string
  body:   string
}

const LABELS = {
  fr: {
    projects: "Projets", gallery: "Galerie", experience: "Expérience", about: "À propos",
    contact: "Contact", software: "Logiciels", role: "Rôle", year: "Année", cv: "CV (PDF)",
    viewProject: "Voir le projet", back: "Retour au portfolio", previous: "Projet précédent",
    next: "Projet suivant", notFound: "Page introuvable",
    notFoundText: "Cette page n'existe pas ou n'est plus publiée.", available: "Disponible", colon: " : ",
  },
  en: {
    projects: "Projects", gallery: "Gallery", experience: "Experience", about: "About",
    contact: "Contact", software: "Software", role: "Role", year: "Year", cv: "Resume (PDF)",
    viewProject: "View project", back: "Back to the portfolio", previous: "Previous project",
    next: "Next project", notFound: "Page not found",
    notFoundText: "This page does not exist or is no longer published.", available: "Available", colon: ": ",
  },
} as const

const LINK_NAMES = {
  instagram: "Instagram", artstation: "ArtStation", sketchfab: "Sketchfab", linkedin: "LinkedIn", website: "Website",
} as const

const DESCRIPTION_MAX = 160

//social cards and JSON-LD get a 1200px JPEG (scrapers handle WebP poorly), the
//snapshot <img> a WebP the size the page draws it at
const SHARE_WIDTH = 1200
const SNAPSHOT_WIDTH = 960

//the requested language, else the other one: a project written in one
//language only is still described rather than left blank
function pick(text: Bilingual, lang: Lang): string {
  return (lang === "fr" ? text.fr || text.en : text.en || text.fr).trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

//paragraphs from plain or markdown text, escaped
function paragraphs(text: string): string {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
}

function absolute(site: string, url: string | null): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `${site}${url}`
}

type SizedImage = { url: string; width: number | null; height: number | null }

//an upload as one resized copy, with the size that copy comes out at (the
//server never enlarges); anything else as it is
function resized(data: PortfolioDto, url: string, width: number, format: ImageFormat): SizedImage {
  const stored = storedImage(url)
  if (!stored) return { url, width: null, height: null }
  const size = data.images[url]
  if (!size) return { url: derivativeUrl(stored, width, format), width: null, height: null }
  const w = Math.min(width, size[0])
  return { url: derivativeUrl(stored, width, format), width: w, height: Math.round(size[1] * w / size[0]) }
}

function shareImage(data: PortfolioDto, site: string, url: string | null): SizedImage | null {
  if (!url) return null
  const image = resized(data, url, SHARE_WIDTH, "jpeg")
  return { ...image, url: absolute(site, image.url)! }
}

function snapshotImg(data: PortfolioDto, url: string, alt: string): string {
  const image = resized(data, url, SNAPSHOT_WIDTH, "webp")
  const size = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ""
  return `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(alt)}"${size} loading="lazy">`
}

//JSON-LD inside a <script>: "<" escaped so a value can never close the tag
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
}

function profileLinks(profile: ProfileDto): Array<{ name: string; url: string }> {
  return (Object.keys(LINK_NAMES) as Array<keyof typeof LINK_NAMES>)
    .filter((k) => profile.links[k])
    .map((k) => ({ name: LINK_NAMES[k], url: profile.links[k] }))
}

function projectSoftware(projects: MainProjectDto[]): string[] {
  return [...new Set(projects.flatMap((p) => p.software.map((s) => s.key)))]
}

function experienceSkills(experiences: ExperienceDto[], lang: Lang): string[] {
  return [...new Set(experiences.map((e) => pick(e.title, lang)).filter(Boolean))]
}

function siteName(data: PortfolioDto): string {
  return data.profile?.name || "Portfolio"
}

function homeDescription(data: PortfolioDto, lang: Lang): string {
  const p = data.profile
  if (!p) return ""
  return truncate(pick(p.pitch, lang) || pick(p.about, lang) || pick(p.headline, lang), DESCRIPTION_MAX)
}

function metaTags(o: {
  title: string; description: string; canonical: string; image: SizedImage | null
  lang: Lang; type: "website" | "profile" | "article"; siteName: string
}): string {
  const tags = [
    `<title>${escapeHtml(o.title)}</title>`,
    `<meta name="description" content="${escapeHtml(o.description)}">`,
    `<link rel="canonical" href="${escapeHtml(o.canonical)}">`,
    `<meta property="og:type" content="${o.type}">`,
    `<meta property="og:site_name" content="${escapeHtml(o.siteName)}">`,
    `<meta property="og:title" content="${escapeHtml(o.title)}">`,
    `<meta property="og:description" content="${escapeHtml(o.description)}">`,
    `<meta property="og:url" content="${escapeHtml(o.canonical)}">`,
    `<meta property="og:locale" content="${o.lang === "fr" ? "fr_FR" : "en_US"}">`,
    `<meta name="twitter:card" content="${o.image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(o.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(o.description)}">`,
  ]
  if (o.image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(o.image.url)}">`,
      `<meta name="twitter:image" content="${escapeHtml(o.image.url)}">`,
    )
    if (o.image.width && o.image.height) {
      tags.push(
        `<meta property="og:image:width" content="${o.image.width}">`,
        `<meta property="og:image:height" content="${o.image.height}">`,
      )
    }
  }
  return tags.join("\n    ")
}

function personLd(data: PortfolioDto, site: string, lang: Lang): Record<string, unknown> {
  const p = data.profile
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id":   `${site}/#person`,
    name:    siteName(data),
    url:     `${site}/`,
  }
  if (!p) return person
  const headline = pick(p.headline, lang)
  const description = pick(p.pitch, lang) || pick(p.about, lang)
  if (headline)    person.jobTitle = headline
  if (description) person.description = description
  if (p.avatarUrl) person.image = shareImage(data, site, p.avatarUrl)!.url
  if (p.contact.email) person.email = `mailto:${p.contact.email.toLowerCase()}`
  if (p.location)  person.address = { "@type": "PostalAddress", addressLocality: p.location }
  const sameAs = profileLinks(p).map((l) => l.url)
  if (sameAs.length) person.sameAs = sameAs
  const knowsAbout = [...projectSoftware(data.mainProjects), ...experienceSkills(data.experiences, lang)]
  if (knowsAbout.length) person.knowsAbout = knowsAbout
  return person
}

//SNAPSHOT PIECES

function contactList(data: PortfolioDto, lang: Lang): string {
  const p = data.profile
  if (!p) return ""
  const items: string[] = []
  if (p.contact.email) {
    const email = p.contact.email.toLowerCase()
    items.push(`<li><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></li>`)
  }
  for (const l of profileLinks(p)) {
    items.push(`<li><a href="${escapeHtml(l.url)}" rel="me">${escapeHtml(l.name)}</a></li>`)
  }
  if (p.cvUrl) items.push(`<li><a href="${escapeHtml(p.cvUrl)}">${LABELS[lang].cv}</a></li>`)
  return items.length ? `<ul>${items.join("")}</ul>` : ""
}

function projectFacts(p: MainProjectDto, lang: Lang): string {
  const L = LABELS[lang]
  const facts: string[] = []
  if (p.year) facts.push(`<li>${L.year}${L.colon}${escapeHtml(p.year)}</li>`)
  const role = pick(p.role, lang)
  if (role) facts.push(`<li>${L.role}${L.colon}${escapeHtml(role)}</li>`)
  if (p.software.length) facts.push(`<li>${L.software}${L.colon}${escapeHtml(p.software.map((s) => s.key).join(", "))}</li>`)
  return facts.length ? `<ul>${facts.join("")}</ul>` : ""
}

//The public portfolio only carries blocks that passed their schema
//(portfolio.ts): the required fields are there, the optional ones may not be.
function blockHtml(data: PortfolioDto, block: DetailBlock, lang: Lang): string {
  switch (block.type) {
    case "heading": return `<h2>${escapeHtml(pick((block.content as TextBlockContent).text, lang))}</h2>`
    case "text":    return paragraphs(pick((block.content as TextBlockContent).text, lang))
    case "quote":   return `<blockquote>${paragraphs(pick((block.content as QuoteBlockContent).text, lang))}</blockquote>`
    case "accordion":
      return (block.content as AccordionBlockContent).items
        .map((it) => `<h3>${escapeHtml(pick(it.title, lang))}</h3>${paragraphs(pick(it.body, lang))}`).join("")
    case "specs":
      return `<dl>${(block.content as SpecsBlockContent).rows
        .map((r) => `<dt>${escapeHtml(pick(r.label, lang))}</dt><dd>${escapeHtml(pick(r.value, lang))}</dd>`).join("")}</dl>`
    case "image": {
      const c = block.content as ImageBlockContent
      if (!c.url) return ""
      return snapshotImg(data, c.url, c.alt ? pick(c.alt, lang) : "")
    }
    default: return ""
  }
}

//detail blocks in reading order: top to bottom, then left to right
function orderedBlocks(p: MainProjectDto): DetailBlock[] {
  return [...p.detailPage.blocks].sort((a, b) => a.y - b.y || a.x - b.x)
}

//PAGES

export function homePage(data: PortfolioDto, site: string, lang: Lang): Page {
  const L = LABELS[lang]
  const p = data.profile
  const name = siteName(data)
  const headline = p ? pick(p.headline, lang) : ""
  const title = headline ? `${name} - ${headline}` : name
  const description = homeDescription(data, lang)
  const image = shareImage(data, site, data.mainProjects.find((x) => x.mainImageUrl)?.mainImageUrl ?? p?.avatarUrl ?? null)

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type":      "ProfilePage",
        "@id":        `${site}/#profilepage`,
        url:          `${site}/`,
        name:         title,
        inLanguage:   lang,
        mainEntity:   { "@id": `${site}/#person` },
      },
      personLd(data, site, lang),
      {
        "@type": "ItemList",
        name:    L.projects,
        itemListElement: data.mainProjects.map((x, i) => ({
          "@type":  "ListItem",
          position: i + 1,
          url:      `${site}/project/${x.id}`,
          name:     pick(x.title, lang),
        })),
      },
    ],
  }

  const projects = data.mainProjects.map((x) => `
      <li><article>
        <h3><a href="/project/${x.id}">${escapeHtml(pick(x.title, lang))}</a></h3>
        ${projectFacts(x, lang)}
        ${paragraphs(pick(x.description, lang))}
        <p><a href="/project/${x.id}">${L.viewProject}</a></p>
      </article></li>`).join("")

  const gallery = data.galleryProjects.map((g) => {
    const t = escapeHtml(pick(g.title, lang))
    return `<li>${g.link ? `<a href="${escapeHtml(g.link)}">${t}</a>` : t}</li>`
  }).join("")

  const experience = data.experiences.map((e) => `
      <li>
        <h3>${escapeHtml(pick(e.title, lang))} - ${escapeHtml(e.company)}</h3>
        <p>${escapeHtml(pick(e.period, lang))}${e.location ? `, ${escapeHtml(e.location)}` : ""}</p>
        ${paragraphs(pick(e.summary, lang))}
        ${e.description[lang].length ? `<ul>${e.description[lang].map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` : ""}
      </li>`).join("")

  const availability = p ? pick(p.availability, lang) || (p.available ? L.available : "") : ""

  const body = `
    <main class="seo-snapshot">
      <header>
        <h1>${escapeHtml(name)}</h1>
        ${headline ? `<p>${escapeHtml(headline)}</p>` : ""}
        ${p ? paragraphs(pick(p.pitch, lang)) : ""}
        ${availability ? `<p>${escapeHtml(availability)}</p>` : ""}
      </header>
      ${projects ? `<section><h2>${L.projects}</h2><ul>${projects}</ul></section>` : ""}
      ${gallery ? `<section><h2>${L.gallery}</h2><ul>${gallery}</ul></section>` : ""}
      ${experience ? `<section><h2>${L.experience}</h2><ul>${experience}</ul></section>` : ""}
      ${p && pick(p.about, lang) ? `<section><h2>${L.about}</h2>${paragraphs(pick(p.about, lang))}</section>` : ""}
      <section><h2>${L.contact}</h2>${contactList(data, lang)}</section>
    </main>`

  return {
    status: 200,
    lang,
    head: `${metaTags({ title, description, canonical: `${site}/`, image, lang, type: "profile", siteName: name })}
    ${jsonLd(ld)}`,
    body,
  }
}

export function projectPage(data: PortfolioDto, site: string, lang: Lang, id: number): Page {
  const index = data.mainProjects.findIndex((x) => x.id === id)
  if (index === -1) return notFoundPage(data, lang)
  const L = LABELS[lang]
  const project = data.mainProjects[index]!
  const name = siteName(data)
  const projectTitle = pick(project.title, lang)
  const title = `${projectTitle} - ${name}`
  const canonical = `${site}/project/${project.id}`
  const description = truncate(pick(project.description, lang), DESCRIPTION_MAX)
  const images = [project.mainImageUrl, ...project.thumbnails.map((t) => t.url)]
    .filter((u): u is string => Boolean(u))
    .map((u) => shareImage(data, site, u)!)

  const work: Record<string, unknown> = {
    "@context":  "https://schema.org",
    "@type":     "CreativeWork",
    "@id":       `${canonical}#work`,
    name:        projectTitle,
    url:         canonical,
    inLanguage:  lang,
    creator:     { "@type": "Person", "@id": `${site}/#person`, name, url: `${site}/` },
  }
  const fullDescription = pick(project.description, lang)
  if (fullDescription)          work.description = fullDescription
  if (images.length)            work.image = images.map((i) => i.url)
  if (project.year)             work.dateCreated = project.year
  if (project.software.length)  work.keywords = project.software.map((s) => s.key).join(", ")

  const prev = data.mainProjects[index - 1]
  const next = data.mainProjects[index + 1]
  const nav = [
    prev ? `<a href="/project/${prev.id}" rel="prev">${L.previous}${L.colon}${escapeHtml(pick(prev.title, lang))}</a>` : "",
    next ? `<a href="/project/${next.id}" rel="next">${L.next}${L.colon}${escapeHtml(pick(next.title, lang))}</a>` : "",
    `<a href="/">${L.back}</a>`,
  ].filter(Boolean).map((a) => `<li>${a}</li>`).join("")

  const body = `
    <main class="seo-snapshot">
      <article>
        <header>
          <p><a href="/">${escapeHtml(name)}</a></p>
          <h1>${escapeHtml(projectTitle)}</h1>
          ${projectFacts(project, lang)}
          ${paragraphs(fullDescription)}
          ${project.mainImageUrl ? snapshotImg(data, project.mainImageUrl, projectTitle) : ""}
        </header>
        ${orderedBlocks(project).map((b) => blockHtml(data, b, lang)).join("\n        ")}
      </article>
      <nav><ul>${nav}</ul></nav>
    </main>`

  return {
    status: 200,
    lang,
    head: `${metaTags({ title, description, canonical, image: images[0] ?? null, lang, type: "article", siteName: name })}
    ${jsonLd(work)}`,
    body,
  }
}

export function notFoundPage(data: PortfolioDto, lang: Lang): Page {
  const L = LABELS[lang]
  return {
    status: 404,
    lang,
    head: `<title>${escapeHtml(`${L.notFound} - ${siteName(data)}`)}</title>
    <meta name="robots" content="noindex">`,
    body: `
    <main class="seo-snapshot">
      <h1>${L.notFound}</h1>
      <p>${L.notFoundText}</p>
      <p><a href="/">${L.back}</a></p>
    </main>`,
  }
}

//screens for the admin: the app only, kept out of every index
export function appOnlyPage(data: PortfolioDto, lang: Lang): Page {
  return {
    status: 200,
    lang,
    head: `<title>${escapeHtml(siteName(data))}</title>
    <meta name="robots" content="noindex">`,
    body: "",
  }
}

//TEXT FILES

export function robotsTxt(site: string): string {
  const aiAgents = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot",
    "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot",
  ]
  const disallow = ["/api/", "/settings", "/edit-3d/", "/login", "/forgot-password", "/reset-password"]
    .map((p) => `Disallow: ${p}`).join("\n")
  const group = (agent: string) => `User-agent: ${agent}\nAllow: /\n${disallow}\n`
  return `${["*", ...aiAgents].map(group).join("\n")}\nSitemap: ${site}/sitemap.xml\n`
}

export function sitemapXml(site: string, entries: Array<{ path: string; lastmod: Date | null }>): string {
  const urls = entries.map((e) =>
    `  <url><loc>${escapeHtml(`${site}${e.path}`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
}

//both languages, French first, on one line
function both(text: Bilingual): string {
  const fr = text.fr.trim()
  const en = text.en.trim()
  if (fr && en && fr !== en) return `${fr} | ${en}`
  return fr || en
}

function oneLine(text: string): string {
  return truncate(text, 200)
}

function llmsHeader(data: PortfolioDto, site: string): string[] {
  const p = data.profile
  const name = siteName(data)
  const lines = [`# ${name}`, ""]
  if (!p) return lines
  const summary = [both(p.headline), p.location].filter(Boolean).join(", ")
  lines.push(`> ${summary}. Portfolio : ${site}/`, "")
  if (p.pitch.fr || p.pitch.en) {
    if (p.pitch.fr) lines.push(p.pitch.fr.trim(), "")
    if (p.pitch.en && p.pitch.en !== p.pitch.fr) lines.push(p.pitch.en.trim(), "")
  }
  if (p.about.fr) lines.push(`## À propos`, "", p.about.fr.trim(), "")
  if (p.about.en && p.about.en !== p.about.fr) lines.push(`## About`, "", p.about.en.trim(), "")

  const availability = both(p.availability)
  lines.push(
    "## Disponibilité / Availability", "",
    `- ${p.available ? "Disponible pour des missions freelance / Available for freelance work" : "Pas disponible actuellement / Not available at the moment"}`,
  )
  if (availability) lines.push(`- ${availability}`)
  lines.push("")

  const software = projectSoftware(data.mainProjects)
  const roles = [...new Set(data.experiences.map((e) => both(e.title)).filter(Boolean))]
  if (software.length || roles.length) {
    lines.push("## Compétences / Skills", "")
    if (software.length) lines.push(`- Logiciels / Software : ${software.join(", ")}`)
    for (const r of roles) lines.push(`- ${r}`)
    lines.push("")
  }

  lines.push("## Contact", "")
  if (p.contact.email) lines.push(`- Email : ${p.contact.email.toLowerCase()}`)
  for (const l of profileLinks(p)) lines.push(`- ${l.name} : ${l.url}`)
  if (p.cvUrl) lines.push(`- CV (PDF) : ${site}${p.cvUrl}`)
  lines.push("")
  return lines
}

function llmsExperience(data: PortfolioDto): string[] {
  if (data.experiences.length === 0) return []
  return [
    "## Expérience / Experience", "",
    ...data.experiences.map((e) => `- ${both(e.title)}, ${e.company}${e.location ? ` (${e.location})` : ""}, ${both(e.period)}`),
    "",
  ]
}

export function llmsTxt(data: PortfolioDto, site: string): string {
  const lines = llmsHeader(data, site)
  if (data.mainProjects.length) {
    lines.push("## Projets / Projects", "")
    for (const p of data.mainProjects) {
      const facts = [p.year, both(p.role)].filter(Boolean).join(", ")
      const desc = oneLine(p.description.fr || p.description.en)
      lines.push(`- [${both(p.title)}](${site}/project/${p.id})${facts ? ` (${facts})` : ""}${desc ? ` : ${desc}` : ""}`)
    }
    lines.push("")
  }
  lines.push(...llmsExperience(data))
  lines.push("## Optional", "", `- [Version complète / Full version](${site}/llms-full.txt)`, "")
  return lines.join("\n")
}

function blockText(block: DetailBlock, lang: Lang): string {
  switch (block.type) {
    case "heading": return `#### ${pick((block.content as TextBlockContent).text, lang)}`
    case "text":    return pick((block.content as TextBlockContent).text, lang)
    case "quote":   return pick((block.content as QuoteBlockContent).text, lang).split("\n").map((l) => `> ${l}`).join("\n")
    case "accordion":
      return (block.content as AccordionBlockContent).items
        .map((it) => `**${pick(it.title, lang)}**\n\n${pick(it.body, lang)}`).join("\n\n")
    case "specs":
      return (block.content as SpecsBlockContent).rows
        .map((r) => `- ${pick(r.label, lang)} : ${pick(r.value, lang)}`).join("\n")
    default: return ""
  }
}

export function llmsFullTxt(data: PortfolioDto, site: string): string {
  const lines = llmsHeader(data, site)
  lines.push(...llmsExperience(data))
  for (const e of data.experiences) {
    const summary = e.summary.fr || e.summary.en
    const bullets = e.description.fr.length ? e.description.fr : e.description.en
    if (!summary && bullets.length === 0) continue
    lines.push(`### ${both(e.title)}, ${e.company}`, "")
    if (summary) lines.push(summary.trim(), "")
    for (const b of bullets) lines.push(`- ${b}`)
    lines.push("")
  }
  if (data.mainProjects.length) lines.push("## Projets / Projects", "")
  for (const p of data.mainProjects) {
    lines.push(`### ${both(p.title)}`, "", `URL : ${site}/project/${p.id}`)
    if (p.year) lines.push(`Année / Year : ${p.year}`)
    if (both(p.role)) lines.push(`Rôle / Role : ${both(p.role)}`)
    if (p.software.length) lines.push(`Logiciels / Software : ${p.software.map((s) => s.key).join(", ")}`)
    lines.push("")
    const text = (lang: Lang) => [p.description[lang].trim(), ...orderedBlocks(p).map((b) => blockText(b, lang).trim())]
      .filter(Boolean).join("\n\n")
    const fr = text("fr")
    const en = text("en")
    if (fr) lines.push("#### Français", "", fr, "")
    if (en && en !== fr) lines.push("#### English", "", en, "")
  }
  return lines.join("\n")
}

# Overhaul plan

Branch `overhaul`, local only. Nothing is pushed, deployed or written to the
production database or the Dokploy env. Dev database = copy of prod (2026-11-02).
Media are local in `storage/files`. Request text: `.claude/backlog.md`.

## Design direction (keep the art direction, make it professional)

Keep: black background, film grain, cyan accent (`--primary: 185 65% 51%`),
Montserrat, uppercase tracked headings, hairline frames and rules, the vertical
side nav labels on desktop, near-monochrome UI so the renders bring the colour.

Change:
- Editorial grid: content max width 1280px, 12 columns, gutters 64px desktop,
  32px tablet, 16px phone. Generous but consistent section spacing, no dead
  black screens between sections.
- One fluid type scale (clamp): display, h1, h2, h3, body, small, label.
  Headings near-white, body 70%, captions 50% of white, all AA on black.
- Restrained motion: short fade + 12px rise, content visible by default if the
  observer never fires, everything off under `prefers-reduced-motion`.
- Self-hosted Montserrat (no Google Fonts request), no render-blocking script.
- Grain as a small tile, not a 4.8 MB image.
- Breakpoints: phone <= 640, tablet 641-1024, desktop > 1024. No horizontal
  scroll, touch targets >= 44px, the side nav becomes a top bar + menu below 1025.

Home, in order: hero (name, headline, availability, pitch, CTAs "Projets" and
"Contact", social links, featured render) -> selected work (case-study cards:
large still first, title, year, role, spec strip with full labels, software,
"Voir le projet", "Voir en 3D") -> gallery (grid + lightbox, readable stats) ->
experience timeline -> about (avatar, bio, software, interests) -> contact
(big mailto CTA, availability, socials, CV) -> footer.

Detail page: case-study header (title, year, role, summary, spec strip,
software), the blocks, then previous / next project and back link.

## Shared contracts

Types: `src/types/portfolio.ts` (committed in cc02dc4). New fields:
`MainProjectDto.published/role/year`, `GalleryProjectDto.published`,
`ExperienceDto.published`, `ProfileDto.name/headline/pitch/location/available/
availability/links/cvUrl`, `ProfileDto.contact` is `{phone, email}`, instagram
moved to `links.instagram`.

API additions (server, W1):
- `PUT /api/main-project/order`, `PUT /api/gallery-project/order`,
  `PUT /api/experience/order`, body `{ ids: number[] }`, answers 204.
- `published` is accepted by the existing PUT routes. `/api/portfolio` drops
  unpublished rows for visitors and keeps them for the admin session.
- Every PUT body goes through an allow-list (zod).

Editing model (W3): one edit bar, one save model = drafts + explicit save.
- `useEditor()` (module scoped): `editMode`, `editLang` ("fr" | "en"),
  `selection`, `select(kind, id)`, `clear()`, `draft(kind, id)`,
  `patch(kind, id, partial)`, `display(kind, entity)` (entity with its draft
  applied, so the page previews unsaved edits), `dirty`, `saveAll()`,
  `discardAll()`, `undo()`, `redo()`, a `beforeunload` and router-leave guard.
- Kinds: `profile`, `mainProject`, `galleryItem`, `experience`.
- `<EditableRegion kind id label>`: in edit mode draws a hover outline and a
  label, click or Enter selects; outside edit mode renders its slot untouched.
- `<Inspector>`: right panel on desktop, bottom sheet on tablet and phone,
  renders the form of the selected kind.
- Public components render `display(kind, entity)` and wrap items in
  `EditableRegion`. No contenteditable on the home page any more.

3D (W2): `src/three/` core shared by the viewer and the editor, loaders with
meshopt + KTX2 + Draco, `computeAutoSetup(scene)` (pure), viewer props stay
compatible with `useProjectCard` / `useEffectiveViewerSettings`.

## Phases

1. Parallel, one worktree each:
   - W1 server: security, performance, validation, schema + migration, SEO and
     AI discoverability (served HTML with content and meta, JSON-LD, sitemap,
     robots, llms.txt).
   - W2 3D core + public viewer + auto setup + GLB optimizer module.
   - W3 editing infrastructure (new files only).
2. Parallel after merge:
   - W4a public home redesign + responsive.
   - W4b detail page + bento editor + styleguide + showcase test pages.
   - W5 model editor rewrite on the 3D core, with the Auto setup button.
3. Integration: legacy removal (Sketchfab, legacy project viewer fields,
   CssVarsPanel), wire the GLB optimizer, browser pass desktop / tablet /
   phone, fresh-eyes design audit, fixes, final audit.

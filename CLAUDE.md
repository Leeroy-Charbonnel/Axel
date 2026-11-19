# Project rules (read every time before writing code)

These rules apply to this project and every project that descends from this template (it's copied to new repos along with the rest of the template). Treat them as a contract: violating any of them is a regression even if the code "works".

---

## Code style

1. **All code comments in English.** Even when chatting in French, comments stay English. No mixed-language files.

2. **Never combine `border-left` (or any single-side border) with `border-radius`** on the same element. They render ugly corners. Pick one: full border + radius, or single-side border + no radius.

3. **CSS variables for every meaningful value.** No hardcoded hex/px/rem in component CSS. If a token doesn't exist yet, add it to the canonical scale (shadcn HSL vars + `--vsui-space-*` / `--vsui-radius` / etc.) and reuse it. The only allowed hardcoded values: `0`, `100%`, `auto`, fully transparent.

4. **No silent fallbacks.** If something fails, surface it: throw, toast, log loudly. Don't `?? default`, don't `try/catch { /*ignore*/ }`, don't return a placeholder hoping the user won't notice. Empty data is fine, hidden errors are not.

## Architecture

5. **If a value lives in the DB, it does NOT live in localStorage.** Pick one source of truth. The settings table is the canonical store for user preferences (theme, language, accent_color, etc.).

6. **Settings table schema is FIXED across projects:** `key / value / description / type / group / options / userId`. `SettingsPage.vue` reads this exact shape. Adding a setting = inserting a row, not changing the schema.

7. **Prefer module-scoped composables over `provide`/`inject` for shared state.** Inject is fragile (Symbol identity bugs across reloads, optimizer caches, etc.). `useAuth`, `useTheme`, `useLang`, `useSettings` etc. are all module-level refs - import and use directly.

8. **One CSS color system: shadcn-vue HSL (`--primary`, `--background`, `--foreground`, etc.).** Every other token (`--color-primary`, `--text-main`, `--vsui-*`) must DERIVE from these. Changing one HSL var should flow through the whole UI.

9. **`useAccent()` writes to `--primary` in HSL.** The accent_color setting is the single knob that retints the whole app.

## Behavior

10. **No speculative features.** Don't add a flag, env var, helper, or abstraction "in case we need it later". If a real requirement appears, add it then.

11. **Fix the root cause, not the symptom.** Don't `git checkout .` the broken file, don't `--no-verify` past a failing hook, don't catch and ignore the error. Find why it broke.

12. **Secrets never in committed files.** No tokens, no passwords, no API keys in `package.json`, `.env.example`, source code, or comments. Real `.env` is gitignored; `.env.example` shows the keys with empty values only.

12. **The template is copied, not linked.** There is no shared UI package. Auth pages, composables, tokens and the nav live in this repo, duplicated from the template. That is deliberate: the shared package meant a private registry, an `.npmrc`, a `GITHUB_TOKEN` build arg in Dokploy, and a version bump to ship a one-line fix. The cost is real - a fix to `LoginPage` has to be copied per project - and it is the cheaper side. It was also where the privilege escalation lived.

13. **When in doubt, ask. When sure, ship.** Don't ask three confirmations for a small reversible change. Don't push twenty commits trying to rebuild a feature that the user already validated once.

---

## Tech baseline

- Vue 3 + TypeScript (strict mode, no `any` unless explicitly justified)
- Bun as runtime + package manager
- Express + Drizzle ORM + Postgres
- Better Auth (email + password, and Google sign-in for the existing account), configured in `auth.ts`
- Resend for transactional email
- Tailwind + shadcn-vue (HSL color tokens)
- Shipped in-repo: useToast, useAuth, useLang, useSettings, useTranslations, ToastHost, Login/Forgot/Reset/Settings pages, structural CSS variables in `src/tokens.css`. The site is dark only: there is no theme toggle and no accent setting, the palette lives in `src/style.css`.
- Editing: `useEditor` (drafts, save, undo, guards) drives the edit bar and the inspector in `src/components/admin/`; pages with their own state register through `registerPageActions`. The 3D core shared by the public viewer and `/edit-3d` is `src/three/`.

## Anti-patterns spotted in past work

- Auto-seeding random "example" rows in the DB at user request - we removed that, only `accent_color`/`theme`/`language` self-seed via their composables.
- Two parallel theme stores (localStorage + DB) - resolved: DB only.
- Provide/inject for cross-package state - resolved: module composables.
- Custom postinstall to fetch private deps - resolved: GitHub Packages + `.npmrc`.

---

## Where to put what (file locations)

When you (or Claude) extend this template, drop new code in the right place. The full how-to with copy-pasteable snippets is in `SETUP.md` under "How to extend". Quick reference:

| What you're adding | Where it goes |
|---|---|
| A new route / page | New file in `src/pages/`, wire it in `src/router/index.ts`, link from `src/App.vue` nav |
| A translatable string | `src/locales/seed-translations.json` (fr + en) then `bun run seed:i18n` |
| A new DB table or column | `db/schema.ts`, then `bun run db:generate` (add any data move to the generated SQL) and `bun run db:migrate` on dev. The entrypoint applies it in production |
| An API route | `server/routes/<resource>.ts`, behind `requireAdmin` unless deliberately public, its body through a strict schema in `server/validation.ts` |
| A user setting | Call `useSettings().update(key, value, {type, description, group, options})` once anywhere - it self-seeds. Add the `SETTING_<key>_LABEL` and `SETTING_<key>_DESC` translations |
| A composable | `src/composables/`. If it is reusable across projects, add it to the template so future clones get it |
| A reusable Vue component | `src/components/` for cross-page pieces, `src/components/portfolio/` for the site itself |
| A shadcn-vue component the template doesn't ship yet | Copy the component folder from a fit-tracker / trading-bot installation, or run `npx shadcn-vue add <name>` |
| A chart | Add `chart.js + vue-chartjs` to deps if needed; chart components live in `src/components/charts/` per project (not shared - too domain-specific) |
| A modal / dialog | `src/components/ConfirmDialog.vue` for a confirmation. There are no shadcn primitives in this repo: `src/components/ui/` was removed because nothing imported it. |
| A toast | `useToast()` from `src/composables/useToast`. `<ToastHost />` is already mounted in `src/App.vue`. |
| A new env var | `.env.example` (with empty / placeholder value), then your local `.env`, then production env in Dokploy. Never commit a real value. |

## What NOT to add to the template

These belong in the consuming project, not in the template:
- Charts (only fit-tracker and trading-bot use them today)
- Three.js / 3D rendering (geo-quizz only)
- Background polling loops (trading-bot only)
- File upload handlers
- Domain-specific composables (`useExercises`, `usePortfolios`, `useQuiz`)
- Project-specific DB tables (`exercise`, `portfolio`, `question`)

The template stays minimal so cloning it for a new app means deleting nothing.

## What NOT to do when extending

- Don't add a new composable for theme/lang/accent - they already exist and are DB-backed
- Don't add a new localStorage key for user preferences - use the `settings` table
- Don't add provide/inject for cross-page state - use a module-scoped ref in a composable
- Don't duplicate translations across locale files manually - the seed JSON is the single source
- Don't add `border-left: ...; border-radius: ...` on the same element (rule #2)
- Don't catch errors silently. Surface them via a toast or `console.warn` at minimum (rule #4)

---

# One account, one role

This site has exactly one account and it is the admin. No invite, no role
granted through the app, no auth mode.

The sign-up form on /login stays: it is how the first account is created, once.
It answers 400 to everyone from the moment an account exists, so it is a door
that closes behind the person who walks through it.

- `emailAndPassword` is on, but a `before` hook on `/sign-up/email` refuses the
  request as soon as one account exists. The first registration is the only one.
- Google is a `socialProviders` entry with `disableSignUp: true`. It signs in
  the account whose email matches, linking Google on first use, and sends every
  other Google address back to `/login?error=signup_disabled`.
- `role` is declared `input: false`. Without that line better-auth accepts the
  field from the client on sign-up and on `/update-user`, which is exactly how
  the shared package let anyone make themselves an admin.
- The `create.before` database hook forces `role: "user"`. Nothing in the app
  writes `"admin"`. Promotion is one statement, run by hand:
  `UPDATE "user" SET role = 'admin' WHERE email = '...';`
- `enforceSingleAccount()` runs at boot: once an admin exists, every other
  account is deleted. Sessions, accounts and settings cascade with the row.
- Nothing links to `/login`. It is reached by typing the address.
- `pending` and `banned` are gone with the roles. A role that is not `admin` can
  do nothing, and the next boot removes it.

`/` and `/project/:id` are public: the detail page renders read-only for
everyone and only becomes an editor when `useAdmin().editMode` is on.
`/settings` and `/edit-3d/:id` carry `requiresAdmin`.

# Server layout

`server.ts` wires the middleware and mounts the modules under `server/`:
`http.ts` (admin guard, errors, param and body parsing), `validation.ts` (one
strict zod schema per body: an unknown key or a wrong type is a 400 with the
reason), `uploads.ts`, `portfolio.ts`, `routes/*.ts`, and `seo.ts` + `site.ts`
for the built app.

- JSON bodies are capped at 1mb, except `PUT /api/models/:id/viewer-settings`
  (10mb), mounted before the global parser.
- `GET /api/portfolio` hides unpublished rows from visitors, and every 3D model
  no published project shows. Visitors get a memo that each successful admin
  write invalidates; an anonymous or refused request leaves it alone. The admin
  session gets every row, uncached.
- Each detail block type has its own content schema in `validation.ts`. A
  stored block that fails it is logged on every portfolio build and left out
  of the visitors' payload.
- `requireAdmin` refuses a non-GET request whose `Origin` is not in
  `ALLOWED_ORIGINS` (403), so a sibling subdomain cannot ride the cookie.
- GLB optimization runs in a worker (`server/glb-optimize.worker.ts`), one job
  at a time, stopped after 5 minutes. It makes the full copy and the phone copy.
- Helmet sends a CSP. A new third-party origin (an embed, a CDN) fails until it
  is added to the directives in `server.ts`.

# Uploads

No file lives on the machine running the app. Every upload is an object in an
S3 bucket (`server/storage.ts`, Bun's S3 client) served by rclone in the stack:
one volume, one folder per environment (`prod/`, `dev/`), the same layout in
both. Text stays in the database, the `file` table holds one row per object.

    projects/{mainProjectId}/images|models|hdri/{uuid}{ext}   files of one main project
    shared/images|models|hdri|docs/{uuid}{ext}                everything else
    .cache/{format}/{width}/{stored}.{format}                 resized copies
    .cache/thumb/{side}/{stored}.webp                         thumbnail of a model, an HDRI, a video

`server/uploads.ts` receives files on the admin-only routes (multer writes a
temp file, it is measured, sent to the bucket, then removed); `/media` streams
from the bucket with Range, ETag and immutable cache headers. Three things are
load-bearing:

- the file filter checks the extension against a list AND the declared type
  against a prefix list. `.svg` and `.html` are not on it: `/media` serves from
  the site's own origin, so either one would run its script as if the site had
  written it. PDF is accepted by `POST /api/profile/cv` and nowhere else.
- the stored name is `{folder}/{subdir}/{uuid}{ext}`, generated here, never
  the client's; `/media` answers that shape only (no `..`, no `.cache`).
- `/media` sends `X-Content-Type-Options: nosniff`.

`POST /api/files?project=<id>` files an upload in that project's folder,
without it the file goes to `shared/`. `server/file-projects.ts` (run at boot
by `scripts/file-projects.ts`, and at the end of `import-renders`) moves each
file to the folder of the one project that uses it, or to `shared/`; a file
nothing uses keeps its folder.

Deleting a file deletes its row, its bytes and its resized copies. The sweep
(`DELETE /api/files/orphans`, `?project=<id>` for one folder) deletes the
unreferenced rows (HDRs and models excepted: the pickers swap between them)
and every object no row names. `GET /api/files/storage` gives the total, the
cache share and what the sweep would free. Never run the sweep while
`file-projects` moves files: a copied object is row-less until its row moves.

A file that is not an image gets its thumbnail from the admin's browser
(`src/components/admin/media/thumbnails.ts`: one job at a time, only for tiles
on screen): a render of the GLB, a tone-mapped HDR or EXR, a frame of the video.
`PUT /api/files/:id/thumbnail` decodes it and encodes it again (`server/picture.ts`),
stores it as a derived object of the file and `/media/thumb/{side}/{stored}`
serves it. It moves and is deleted with its file (`server/derived.ts` names
every derived object). A PDF keeps its icon.

A 3D model's picture is always a render from its start view, never a chosen
image: a `file` row of kind `thumbnail` in `thumbnail_file_id`, sent by the
editor to `PUT /api/models/:id/thumbnail`. Saving the model's settings, a new
GLB or deleting the model drops it; the next admin screen that shows the model
renders it again. These rows are not listed in `GET /api/files`.

Resized images (`/media/{format}/{width}/{stored}`, `server/images.ts`) are
encoded once into `.cache` in the bucket. The cache is only reached through
the resize route and the thumbnail route, never raw. Deleting `.cache` is always
safe: copies are encoded again, the library makes the thumbnails again. At most two
encodes run at once, and a source sharp cannot read answers 404 until the
process restarts, without a new attempt. A row cannot be deleted while
`fileRefCountSql` in `server/routes/files.ts` counts a reference to it; every
new place that holds a file id or a `/media` URL is added there and in
`server/file-projects.ts`.

# Pages carry their content

Crawlers and AI tools mostly do not run JavaScript. In production Express
serves `/` and `/project/:id` with the title, description, canonical, Open
Graph tags, JSON-LD and a static HTML snapshot inside `#app`, all built from the
public portfolio in the visitor's language cookie (French by default). Vue's
mount replaces the snapshot. Unknown paths and unpublished projects answer 404.
`/robots.txt`, `/sitemap.xml`, `/llms.txt` and `/llms-full.txt` are generated
from the database. `server/site.ts` refuses to boot when `dist/index.html` lost
one of the markers it fills (`<html lang>`, `<title>`, the description, the
empty `#app`).

# The i18n seed inserts, it does not overwrite

`scripts/seed-i18n.ts` runs on every boot and the `translations` table is edited
from the admin screens. It uses `onConflictDoNothing`: the JSON file seeds keys
that do not exist yet, the database owns their text. An upsert there handed
every edited label back to the file, once per deploy.

# One stack, two databases

ONE Dokploy compose service named `stack` holds the app, the production database
and the dev database. Rule 10 is kept - one service per project, no standalone
database on the shared dokploy-network - and the second database costs a host
port instead of a second service.

| Service | Reached by | Host port |
|---|---|---|
| `app` | Traefik, through the Dokploy domain | none, `expose: 3000` |
| `db` | the app, by service name | `127.0.0.1:5449`, for the SSH tunnel |
| `db-dev` | nothing inside the stack | `127.0.0.1:5450`, for the SSH tunnel |
| `storage` | the app, by service name (bucket `prod`) | none, `expose: 8080` |
| `storage-dev` | nothing inside the stack (bucket `dev`) | `127.0.0.1:5460`, for the SSH tunnel |

The app is wired to `db` and `storage` and must stay that way. The standalone
database this replaced published `0.0.0.0:5440`, which put it on the internet;
every port here is bound to loopback. The `storage` volume holds `prod/` and
`dev/`; each rclone mounts its own folder (compose `volume.subpath`), so the
dev keys cannot reach production files.

postgres:18 matches what production ran, and the volume is mounted at
`/var/lib/postgresql`, not `.../data`: 18 stores the cluster in a version
subdirectory and refuses to start when the mount sits on the old path.

# Local dev signs the admin in

With `DEV_AUTO_LOGIN=true` in `.env`, `src/main.ts` calls `GET /api/dev/login`
(`server/dev-login.ts`) when the dev site loads signed out, then reloads once.
The route answers only a request whose socket, every forwarded hop and every
host name are this machine, and only on a database whose name ends in `_dev`.
The server refuses to boot when the flag is set with `NODE_ENV=production`, and
the production bundle holds no trace of it. Turn it off before exposing the dev
server (tunnel, `vite --host`).

# The editor

One edit mode, one Save. Every edit is a draft: entity fields, site labels and
the theme in `useEditor`, the blocks and the grid of a project page in that
page's own state (`registerPageActions`). Nothing is sent before Save, and
Discard restores all of it.

- Three things are written at once and stay invisible to visitors: a new item
  is a hidden row (Save publishes it, Discard deletes it), an uploaded file is
  an object nothing uses yet, and the FR / EN switch saves the admin's language.
- Undo and redo are one history. The editor's steps and the page's
  (`useSnapshotHistory`) each keep the time of their change: the newest is
  undone first, and a new step in either one ends the redo of both.
- The language being edited is the site language (`useEditor().editLang` wraps
  `useLang()`): one field per text, the FR / EN switch changes both.
- On the home page the inspector stays open for the whole edit mode, with tabs
  Properties (the selected item, or the site labels when nothing is selected),
  Files and CSS. It is resizable; the width is clamped by the
  `--editor-inspector-min` / `--editor-inspector-max` tokens. At most 1024px
  wide it is a bottom sheet: folded until an item is selected, left as it is
  while a text is typed in place, and the page keeps room under its end for it.
- The project page panel has tabs: Add, Properties (the selected block, or the
  page grid when nothing is selected), Files (this project's folder only) and
  CSS (the site theme).

# Texts are typed on the page

`src/components/admin/InlineEditable.vue` is the text box: a `contenteditable`
in `plaintext-only` mode (a paste or a drop is plain text in every browser),
one line unless `multiline`, digits only for a count. Three components bind it:

| Component | Text | Written to |
|---|---|---|
| `admin/InlineText.vue` | a field of an entity, in the site language | `editor.patch` |
| `admin/InlineLabel.vue` | a fixed text of the site | `editor.setLabel` |
| `portfolio/detail/BlockText.vue` | a text of a block | the block, through `@write` |

Each one shares its value with its panel field, so both follow each other and
share one history; on the home page the field of the text being typed is
marked in the panel.
Outside edit mode all three render the plain element and its text, nothing
else: a visitor gets no editor markup.

# Site labels

The fixed texts of the home page the admin can retype are the translation keys
listed in `LABEL_GROUPS` (`src/components/admin/labels.ts`). They are typed in
place (`InlineLabel`) or in the panel (`forms/LabelsForm.vue`), drafted per
language, and written on Save by `PUT /api/translations`: `{ lang, values }`,
admin only, one transaction, a 400 for a key that does not exist or an empty
text. A label left empty gets its saved text back; an empty one is never saved.
A new editable label is its key in `LABEL_GROUPS` and an `InlineLabel` on the
page. The server HTML snapshot does not read them: `server/seo.ts` names its
sections with its own `LABELS`.

# Each project page has its own grid

`detail_page.grid` holds the desktop column count, minimum row height and gap.
`src/lib/detail-grid.ts` is the registry (defaults, limits, CSS variables) read
by the public grid, the editor, the panel and the server validator. A new column
count refits every block (`fitToCols`); full-width blocks and sections follow it.

In the editor (`detail/BentoEditor.vue`, `useBentoGrid`):

- the selected block has a handle on each edge and each corner (`resizeRect` in
  `src/lib/bento-layout.ts`); the phone stack has the bottom one only. Arrows
  move the block, Shift + arrows resize it.
- a gesture only moves a preview: the blocks are written once, on release, and
  Escape cancels it. What a block lands on moves down, so a drop is never refused.
- a click on a text of a block types there (`BlockText`); Enter on a block types
  in its first text.
- deleting a block asks nothing: a toast names it and undo brings it back.
- every block type and section preset has a "?" in the Add tab: `HelpDialog.vue`
  shows a drawing (`BlockSketch.vue`, `SectionSketch.vue`) and the text of its
  `helpKey`. A new block type needs both.

# One theme for the whole site

The CSS tab edits the tokens of `THEME_VARS` (`src/lib/theme-vars.ts`): 26
tokens in 6 groups, each with a type (`color`, `number`, `length`), its limits
and a default equal to the stylesheet's (`tests/lib/theme-vars.test.ts` fails
when they differ). `theme/ThemeEditor.vue` draws a colour picker or a slider.
A token whose value is typed CSS (`clamp(...)`) is not in the registry: the tab
has no text box. `PUT /api/theme` replaces the whole map: only registered
names, each value checked by its type, and text colours at 4.5:1 or more on
their ground.

The film grain (`.grain-overlay`) sits at z -1 inside `.vsui-app`: over the
page background, under every text, picture and 3D model.

The saved map lives in the single-row `site_theme` table, is sent in the public
portfolio payload and in the server HTML, and is applied as CSS variables on
`<html>` for every visitor. Every other colour token derives from the base
colours. A new editable token is one line in `THEME_VARS` and its label.

# The 3D viewer loads in steps

`src/three/` is the viewer core (`modelViewer.ts`, `core.ts`), shared by the
public `ThreeViewer.vue` and the editor. What loads when:

- every viewer of a page starts 1.5 s after it mounts, or when it comes near the
  screen, and never for a visitor who asked to save data. One model at a time
  (`loadQueue.ts`), in page order. A scroll pauses the next step.
- a load is cut in steps, each a task of its own (`nextStep`): the studio probe,
  the GLB parse, the shader compile, one texture upload per step, then the
  first frame, then each post-processing pass. A step that would hold the page
  for more than 100 ms gets cut again.
- nothing is drawn before `core.warmUp()` ends. The first frame is drawn off
  screen with its shadows: a shader that reads a shadow map needs one.
- shaders compile off the main thread (`core.compile`), once per target they
  draw into: the canvas, or a buffer when ambient occlusion or a see-through
  material is there. A program compiled for the wrong target is compiled again
  on the first frame, on the main thread.
- the studio light is filtered by the first viewer and read back; the others
  upload its pixels (`environment.ts`). The EXR loader, Draco and KTX2 are
  fetched only for a file that needs them.
- the shadow type stays three's default. `PCFSoftShadowMap` is deprecated: three
  swaps it on the first frame, and every program is built twice.
- dev only: three reads each shader log on first use (`checkShaderErrors`), so
  first frames are slower there than in production.

A touch device or a slow computer loads the light copy of a model:
`model_3d.phone_glb_file_id`, textures capped at 1024 px, made by the optimizer
with the full copy. A slow computer is one at the lowest quality level
(`src/three/quality.ts`: weak GPU, under 4 GB or under 4 cores), or one where a
viewer dropped to it earlier in the visit. `ThreeViewer` picks the copy once its
renderer exists. It equals
`glb_file_id` when no texture is larger, and is empty until made:
`bun scripts/optimize-models.ts` makes the missing ones. A new GLB on a model
empties it. It is counted in `fileRefCountSql` and moved by `file-projects`.

# The home page stays alive

`App.vue` keeps `HomePage` alive (`KeepAlive`): opening a project and coming
back shows the same page, its models loaded, at the scroll position it had.
While it is aside, a model still loading gives its turn back and starts again
on return. A touch device frees every model of the page aside: its memory is
short, and a phone browser keeps few WebGL contexts.

The router restores a saved position and opens a new page at its top at once.
Only a jump to a section glides.

# The viewer takes the wheel only on intent

In `ThreeViewer.vue`, outside fullscreen:

- the wheel zooms once the pointer rested 0.6 s on the viewer without a wheel or
  a page scroll, or after a press on it. Before that the page scrolls.
- a finger moving up or down scrolls the page (`touch-action: pan-y`); sideways
  it turns the model, two fingers zoom.

Fullscreen and the 3D editor take every wheel and every touch at once.

# Wireframe colours belong to the model

`viewerSettings.wireframeMode.surfaceColor` and `lineColor`: a fixed colour, or
`"background"`, the site background read from `--background`
(`src/three/wireColor.ts`). Missing: white surfaces, black lines. A surface in
`"background"` is left clear, the page shows through it. A line in
`"background"` is read again when the theme changes.

Shared by every model, from the admin's `editor3d_*` settings: the glow colour,
the line width and how the swept surfaces take the light. The blueprint look of
a `viewer3d` block gives grey lines over clear surfaces to a model without
colours of its own.

# The 3D editor

`/edit-3d/:id`, tabs Scene, Lights, Materials, Wireframe, Model. One document
(`useModelEditor.ts`): nothing is written before Save, Discard restores the
saved copy, every control is one undo step.

- lights are handles in the viewport while the Lights tab is open
  (`model-editor/lightGizmo.ts`, three's TransformControls): a click picks a
  light or the target of a sun, the arrows move it, one undo step per drag. A
  moved light is updated in place, its shadow map kept.
- each look (render, wireframe) has its environment: a map, its strength, its
  rotation, and whether it is drawn behind the model. A map is made opaque when
  it loads: some files carry an alpha channel.

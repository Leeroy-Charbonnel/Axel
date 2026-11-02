# Portfolio Axel - setup

Vue 3 · TypeScript · Tailwind · Express · Drizzle ORM · PostgreSQL · Better Auth · Resend · Three.js

The public site is a portfolio. The content behind it lives in the database and
is edited in place, on the page itself, by the single admin account.

---

## Run it locally

```bash
bun install
cp .env.example .env
```

Fill `DATABASE_URL` (the dev database, through the SSH tunnel) and
`BETTER_AUTH_SECRET` (`openssl rand -base64 32`). Then:

```bash
bun run db:migrate     # apply drizzle/ to the dev database, as the entrypoint does in prod
bun run seed:i18n      # interface labels, inserts the missing keys only
bun run dev            # vite on 5173, express on 3001
bun test               # unit tests: 3D auto setup, viewer, editor drafts, block validation
```

Vite proxies `/api` and `/media` to the Express server on 3001. The dev server
serves and writes files in the local `storage/files`, so a dev database copied
from prod also needs the prod files copied there (see "Refreshing dev from prod").

`bun scripts/import-renders.ts <folder> --main=a,b,c [--retire]` turns render
folders into projects in the dev database. The folders named in `--main`, in
that order, become main projects: the model is optimized like an upload and the
page is a case study built by `src/lib/case-study.ts` from the views the folder
has. Every other folder with a `card.jpg` becomes a gallery card. Each folder
carries a `manifest.json`. Re-running updates the same rows, matched by French
title, and reuses the files already imported. `--retire` unpublishes every
other project and card. `/styleguide` (admin) shows the tokens, the fields
and one block of each type taken from those pages.

There is no `GITHUB_TOKEN` and no `.npmrc`. The shared package this used to
install from a private registry is gone: the template is copied into the repo,
never linked.

---

## The single account

This site has exactly one account and it is the admin.

1. Open `/login` and register. Nothing links to that address; you type it.
   Google sign-in on the same page only opens an existing account with the
   same email: it never creates one.
2. Promote the row by hand, which is the only way in:
   ```sql
   UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
   ```
3. Restart the app. `enforceSingleAccount()` runs at boot and deletes every
   account that is not the admin.

From the moment one account exists, `/sign-up/email` answers 400 to everyone.
Sign-up cannot grant the admin role, `/update-user` cannot set it, and no API
route accepts it as a value.

Forgot the password: `/forgot-password` sends a reset link through Resend. With
`RESEND_API_KEY` empty the link is printed to the server log instead.
`EMAIL_FROM` must be on a domain verified in Resend - the sandbox sender is
refused at boot, since it only ever delivers to the Resend account owner.

---

## Content

Everything on the page is a row: `main_project`, `gallery_project`,
`experience`, `software`, `model_3d`, `profile`. There is no JSON file to edit -
sign in, switch on edit mode from the edit bar, click an item on the page and
change it in the inspector, then Save. Projects, gallery items and experiences
can be unpublished: visitors, the sitemap and llms.txt no longer see them.

Images, models and HDRIs go through the media library, stored at
`storage/files/{uuid}{ext}` and served from `/media`. Resized WebP/JPEG copies
are made on demand under `storage/files/.cache` (never served raw, safe to
delete). An uploaded `.glb` is optimized (meshopt + WebP textures) and the
original is kept. Rows in the `file` table can be removed; the bytes stay.

Uploads accept raster images, video, `.glb` / `.gltf`, `.hdr` / `.exr`, and a
PDF for the CV only.
`.svg` and `.html` are refused on purpose: `/media` serves from the site's own
origin, so either one would run its script as if the site had written it.

---

## Deploy

ONE Dokploy compose service named `stack` holds everything.

| Service | Reached by | Host port |
|---|---|---|
| `app` | Traefik, through the Dokploy domain | none, `expose: 3000` |
| `db` | the app, by service name | `127.0.0.1:$DB_HOST_PORT` |
| `db-dev` | nothing inside the stack | `127.0.0.1:$DB_DEV_HOST_PORT` |

Both database ports are bound to 127.0.0.1, so an SSH tunnel is the only way in.
Pick two ports no other project uses - read the list, do not guess:

```bash
ssh vps "ss -tlnp | grep :54"
```

`docker-entrypoint.sh` applies the migrations and seeds the interface labels
before serving. Generate and commit a migration whenever `db/schema.ts` changes:

```bash
bun run db:generate
```

The `storage` volume holds the uploads at `/app/storage/files`. Dokploy's managed
database backups only cover its own database service type, so set up a Volume
Backup on this compose service instead.

Take a `pg_dump` of prod before deploying a migration that drops columns.

Local commands go through the tunnel: `db:migrate` and `db:studio` reach `db-dev`
via `DATABASE_URL`, `db:studio:prod` reaches `db` via `PROD_DATABASE_URL`.

### Refreshing dev from prod

```bash
ssh vps "docker exec axel-stack-<suffix>-db-1 pg_dump -U axel -Fc axel > /root/prod.dump"
ssh vps "docker cp /root/prod.dump axel-stack-<suffix>-db-dev-1:/tmp/prod.dump"
ssh vps "docker exec axel-stack-<suffix>-db-dev-1 pg_restore -U axel -d axel_dev --no-owner --clean --if-exists /tmp/prod.dump"
```

Run these from PowerShell: the ssh in Git Bash does not see the Windows key
agent, and the failed attempts get the IP banned by fail2ban.

Then copy the files the rows point at into the local `storage/files`, keeping
each `stored_filename` path: download every row of the `file` table from
`https://<domain>/media/<stored_filename>` (a missing file answers 404).

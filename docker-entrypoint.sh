#!/bin/sh
#The production database lives inside the compose stack and publishes its port on
#127.0.0.1 only, so it cannot be reached from a laptop without a tunnel. Schema
#changes are applied here, at boot, rather than by running db:push by hand.
#
#Every step is idempotent and none overwrites: migrate applies only the files it
#has not seen, the image backfill measures only rows without a size, and
#seed-i18n inserts the missing keys, leaving edited labels alone.
set -e

echo "[entrypoint] applying migrations"
bunx drizzle-kit migrate --config=drizzle.config.ts

echo "[entrypoint] filing each file into its project folder"
bun scripts/file-projects.ts

echo "[entrypoint] measuring images uploaded before their size was stored"
bun scripts/backfill-image-sizes.ts

echo "[entrypoint] seeding interface labels"
bun scripts/seed-i18n.ts

echo "[entrypoint] starting server"
exec bun server.ts

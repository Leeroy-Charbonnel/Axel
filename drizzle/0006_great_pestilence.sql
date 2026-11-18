DELETE FROM "site_theme" WHERE "id" <> 1;--> statement-breakpoint
ALTER TABLE "site_theme" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "site_theme" ALTER COLUMN "id" SET DEFAULT 1;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "site_theme_id_seq";--> statement-breakpoint
ALTER TABLE "site_theme" ADD CONSTRAINT "site_theme_single_row" CHECK ("site_theme"."id" = 1);

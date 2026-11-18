CREATE TABLE "site_theme" (
	"id" serial PRIMARY KEY NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "experience" ADD COLUMN "published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gallery_project" ADD COLUMN "published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "main_project" ADD COLUMN "published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "main_project" ADD COLUMN "role" jsonb DEFAULT '{"en":"","fr":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "main_project" ADD COLUMN "year" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "model_3d" ADD COLUMN "source_glb_file_id" uuid;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "headline" jsonb DEFAULT '{"en":"","fr":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pitch" jsonb DEFAULT '{"en":"","fr":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "availability" jsonb DEFAULT '{"en":"","fr":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "links" jsonb DEFAULT '{"instagram":"","artstation":"","sketchfab":"","linkedin":"","website":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "cv_file_id" uuid;--> statement-breakpoint
ALTER TABLE "model_3d" ADD CONSTRAINT "model_3d_source_glb_file_id_file_id_fk" FOREIGN KEY ("source_glb_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_cv_file_id_file_id_fk" FOREIGN KEY ("cv_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_uploaded_by_idx" ON "file" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "gallery_project_image_file_id_idx" ON "gallery_project" USING btree ("image_file_id");--> statement-breakpoint
CREATE INDEX "main_project_model_3d_id_idx" ON "main_project" USING btree ("model_3d_id");--> statement-breakpoint
CREATE INDEX "main_project_main_image_file_id_idx" ON "main_project" USING btree ("main_image_file_id");--> statement-breakpoint
CREATE INDEX "main_project_main_wireframe_file_id_idx" ON "main_project" USING btree ("main_wireframe_file_id");--> statement-breakpoint
CREATE INDEX "main_project_glb_file_id_idx" ON "main_project" USING btree ("glb_file_id");--> statement-breakpoint
CREATE INDEX "main_project_video_file_id_idx" ON "main_project" USING btree ("video_file_id");--> statement-breakpoint
CREATE INDEX "main_project_software_software_id_idx" ON "main_project_software" USING btree ("software_id");--> statement-breakpoint
CREATE INDEX "model_3d_glb_file_id_idx" ON "model_3d" USING btree ("glb_file_id");--> statement-breakpoint
CREATE INDEX "model_3d_thumbnail_file_id_idx" ON "model_3d" USING btree ("thumbnail_file_id");--> statement-breakpoint
CREATE INDEX "model_3d_source_glb_file_id_idx" ON "model_3d" USING btree ("source_glb_file_id");--> statement-breakpoint
CREATE INDEX "profile_cv_file_id_idx" ON "profile" USING btree ("cv_file_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "software_logo_file_id_idx" ON "software" USING btree ("logo_file_id");--> statement-breakpoint
UPDATE "profile" SET
  "links" = jsonb_set("links", '{instagram}', to_jsonb(CASE
    WHEN coalesce(trim("contact"->>'instagram'), '') = '' THEN ''
    WHEN "contact"->>'instagram' ~* '^https?://' THEN trim("contact"->>'instagram')
    ELSE 'https://www.instagram.com/' || lower(ltrim(trim("contact"->>'instagram'), '@')) || '/'
  END)),
  "contact" = "contact" - 'instagram';--> statement-breakpoint
UPDATE "profile" SET "links" = jsonb_set("links", '{sketchfab}', '"https://sketchfab.com/Obambulatesart"')
  WHERE "links"->>'sketchfab' = '';--> statement-breakpoint
UPDATE "profile" SET
  "name" = coalesce(initcap(lower((SELECT "value" FROM "translations" WHERE "id" = 'homeName' AND "lang" = 'fr'))), ''),
  "headline" = jsonb_build_object(
    'en', coalesce((SELECT "value" FROM "translations" WHERE "id" = 'homeSubtitle' AND "lang" = 'en'), ''),
    'fr', coalesce((SELECT "value" FROM "translations" WHERE "id" = 'homeSubtitle' AND "lang" = 'fr'), '')
  );

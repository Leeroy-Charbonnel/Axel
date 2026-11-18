ALTER TABLE "file" ADD COLUMN "main_project_id" integer;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_main_project_id_main_project_id_fk" FOREIGN KEY ("main_project_id") REFERENCES "public"."main_project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_main_project_id_idx" ON "file" USING btree ("main_project_id");
ALTER TABLE "model_3d" ADD COLUMN "phone_glb_file_id" uuid;--> statement-breakpoint
ALTER TABLE "model_3d" ADD CONSTRAINT "model_3d_phone_glb_file_id_file_id_fk" FOREIGN KEY ("phone_glb_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_3d_phone_glb_file_id_idx" ON "model_3d" USING btree ("phone_glb_file_id");
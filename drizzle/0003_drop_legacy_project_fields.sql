ALTER TABLE "main_project" DROP CONSTRAINT "main_project_glb_file_id_file_id_fk";
--> statement-breakpoint
ALTER TABLE "main_project" DROP CONSTRAINT "main_project_video_file_id_file_id_fk";
--> statement-breakpoint
DROP INDEX "main_project_glb_file_id_idx";--> statement-breakpoint
DROP INDEX "main_project_video_file_id_idx";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "model_id";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "layout";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "glb_file_id";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "viewer_settings";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "video_file_id";--> statement-breakpoint
ALTER TABLE "main_project" DROP COLUMN "wireframe_parameters";
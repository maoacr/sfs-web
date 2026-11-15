ALTER TABLE "usuarios" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "google_sub" varchar(255);--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_google_sub_unique" UNIQUE("google_sub");
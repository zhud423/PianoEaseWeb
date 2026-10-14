ALTER TABLE "practice_sessions" ADD COLUMN "required_note_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "hit_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "miss_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "wrong_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "completion_pct" integer;
CREATE TYPE "public"."practice_hand" AS ENUM('left', 'right', 'both');--> statement-breakpoint
CREATE TYPE "public"."practice_mode" AS ENUM('game', 'follow');--> statement-breakpoint
CREATE TYPE "public"."practice_variant" AS ENUM('original', 'lv1', 'lv2', 'lv3');--> statement-breakpoint
CREATE TABLE "practice_measure_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_session_id" uuid NOT NULL,
	"measure_index" integer NOT NULL,
	"hand" "practice_hand" NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"avg_timing_offset_ms" integer
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" text NOT NULL,
	"variant" "practice_variant" DEFAULT 'lv1' NOT NULL,
	"mode" "practice_mode" DEFAULT 'game' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"right_accuracy_pct" integer,
	"left_accuracy_pct" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_measure_stats" ADD CONSTRAINT "practice_measure_stats_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_measure_stats_session_idx" ON "practice_measure_stats" USING btree ("practice_session_id");--> statement-breakpoint
CREATE INDEX "practice_sessions_user_id_idx" ON "practice_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "practice_sessions_song_id_idx" ON "practice_sessions" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");
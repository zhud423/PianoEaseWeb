CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"bpm" integer NOT NULL,
	"duration_label" text NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "midi_event_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "note_on_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "note_off_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;
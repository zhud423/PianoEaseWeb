import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const practiceVariantEnum = pgEnum("practice_variant", ["original", "lv1", "lv2", "lv3"]);
export const practiceModeEnum = pgEnum("practice_mode", ["game", "follow"]);
export const handEnum = pgEnum("practice_hand", ["left", "right", "both"]);

export const songs = pgTable("songs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  bpm: integer("bpm").notNull(),
  durationLabel: text("duration_label").notNull(),
  level: text("level").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
  ]
);

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    songId: text("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "restrict" }),
    variant: practiceVariantEnum("variant").notNull().default("lv1"),
    mode: practiceModeEnum("mode").notNull().default("game"),
    score: integer("score").notNull().default(0),
    midiEventCount: integer("midi_event_count").notNull().default(0),
    noteOnCount: integer("note_on_count").notNull().default(0),
    noteOffCount: integer("note_off_count").notNull().default(0),
    rightAccuracyPct: integer("right_accuracy_pct"),
    leftAccuracyPct: integer("left_accuracy_pct"),
    requiredNoteCount: integer("required_note_count").notNull().default(0),
    hitCount: integer("hit_count").notNull().default(0),
    missCount: integer("miss_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    completionPct: integer("completion_pct"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("practice_sessions_user_id_idx").on(table.userId), index("practice_sessions_song_id_idx").on(table.songId)]
);

export const practiceMeasureStats = pgTable(
  "practice_measure_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    measureIndex: integer("measure_index").notNull(),
    hand: handEnum("hand").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    missCount: integer("miss_count").notNull().default(0),
    avgTimingOffsetMs: integer("avg_timing_offset_ms"),
  },
  (table) => [index("practice_measure_stats_session_idx").on(table.practiceSessionId)]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  practiceSessions: many(practiceSessions),
}));

export const songsRelations = relations(songs, ({ many }) => ({
  practiceSessions: many(practiceSessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const practiceSessionsRelations = relations(practiceSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [practiceSessions.userId],
    references: [users.id],
  }),
  song: one(songs, {
    fields: [practiceSessions.songId],
    references: [songs.id],
  }),
  measureStats: many(practiceMeasureStats),
}));

export const practiceMeasureStatsRelations = relations(practiceMeasureStats, ({ one }) => ({
  practiceSession: one(practiceSessions, {
    fields: [practiceMeasureStats.practiceSessionId],
    references: [practiceSessions.id],
  }),
}));

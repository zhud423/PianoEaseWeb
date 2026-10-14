import { and, eq, gte } from "drizzle-orm";
import { getDb, schema } from "../client";
import type { PracticeMeasureStatPayload } from "@/lib/practice/metrics";

export type StartPracticeSessionInput = {
  userId: string;
  songId: string;
  variant: "original" | "lv1" | "lv2" | "lv3";
  mode: "game" | "follow";
};

export type EndPracticeSessionInput = {
  id: string;
  userId: string;
  score: number;
  midiEventCount: number;
  noteOnCount: number;
  noteOffCount: number;
  rightAccuracyPct?: number | null;
  leftAccuracyPct?: number | null;
  requiredNoteCount?: number;
  hitCount?: number;
  missCount?: number;
  wrongCount?: number;
  completionPct?: number | null;
  measureStats?: PracticeMeasureStatPayload[];
};

export type PracticeAnalyticsSummary = {
  sessionCount: number;
  completionRatePct: number;
  followModeRatePct: number;
  modePreference: "game" | "follow";
  difficultyUpgradeRatePct: number;
  upgradedSwitches: number;
  totalSwitches: number;
};

export type PracticeSongAnalytics = {
  songId: string;
  sessionCount: number;
  completionRatePct: number;
  avgScore: number;
  followModeRatePct: number;
  dominantVariant: "original" | "lv1" | "lv2" | "lv3";
};

export type PracticeVariantAnalytics = {
  variant: "original" | "lv1" | "lv2" | "lv3";
  sessionCount: number;
  completionRatePct: number;
  avgScore: number;
  followModeRatePct: number;
};

export type PracticeDailyTrend = {
  dateKey: string;
  sessionCount: number;
  completionRatePct: number;
  avgScore: number;
};

export type PracticeVariantSwitchEvent = {
  at: Date;
  fromVariant: "original" | "lv1" | "lv2" | "lv3" | null;
  toVariant: "original" | "lv1" | "lv2" | "lv3";
  direction: "start" | "up" | "down" | "same";
  score: number;
  completionPct: number | null;
  mode: "game" | "follow";
};

export type PracticeAnalyticsDashboard = {
  windowDays: 7 | 30;
  summary: PracticeAnalyticsSummary;
  bySong: PracticeSongAnalytics[];
  byVariant: PracticeVariantAnalytics[];
  dailyTrend: PracticeDailyTrend[];
};

export type PracticeSongAnalyticsDashboard = {
  windowDays: 7 | 30;
  songId: string;
  sessionCount: number;
  completionRatePct: number;
  followModeRatePct: number;
  avgScore: number;
  variantBreakdown: PracticeVariantAnalytics[];
  dailyTrend: PracticeDailyTrend[];
  switchEvents: PracticeVariantSwitchEvent[];
  difficultyUpgradeRatePct: number;
  upgradedSwitches: number;
  totalSwitches: number;
};

const VARIANT_RANK: Record<"original" | "lv1" | "lv2" | "lv3", number> = {
  lv1: 1,
  lv2: 2,
  lv3: 3,
  original: 4,
};

function roundPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function averageRounded(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampWindowDays(windowDays: number): 7 | 30 {
  return windowDays <= 7 ? 7 : 30;
}

type EndedPracticeSessionLite = {
  songId: string;
  mode: "game" | "follow";
  variant: "original" | "lv1" | "lv2" | "lv3";
  completionPct: number | null;
  startedAt: Date;
  score: number;
};

function buildSummary(endedSessions: EndedPracticeSessionLite[]): PracticeAnalyticsSummary {
  const completedSessions = endedSessions.filter((session) => (session.completionPct ?? 0) >= 90);
  const followSessions = endedSessions.filter((session) => session.mode === "follow");
  const modePreference: "game" | "follow" =
    followSessions.length > endedSessions.length - followSessions.length ? "follow" : "game";

  const sessionsBySong = new Map<string, EndedPracticeSessionLite[]>();
  for (const session of endedSessions) {
    const list = sessionsBySong.get(session.songId) ?? [];
    list.push(session);
    sessionsBySong.set(session.songId, list);
  }

  let upgradedSwitches = 0;
  let totalSwitches = 0;
  for (const songSessions of sessionsBySong.values()) {
    for (let index = 1; index < songSessions.length; index += 1) {
      const previous = songSessions[index - 1];
      const current = songSessions[index];
      const previousRank = VARIANT_RANK[previous.variant];
      const currentRank = VARIANT_RANK[current.variant];
      if (previousRank === currentRank) continue;
      totalSwitches += 1;
      if (currentRank > previousRank) {
        upgradedSwitches += 1;
      }
    }
  }

  return {
    sessionCount: endedSessions.length,
    completionRatePct: roundPct(completedSessions.length, endedSessions.length),
    followModeRatePct: roundPct(followSessions.length, endedSessions.length),
    modePreference,
    difficultyUpgradeRatePct: roundPct(upgradedSwitches, totalSwitches),
    upgradedSwitches,
    totalSwitches,
  };
}

function buildSongAnalytics(endedSessions: EndedPracticeSessionLite[]): PracticeSongAnalytics[] {
  const sessionsBySong = new Map<string, EndedPracticeSessionLite[]>();
  for (const session of endedSessions) {
    const list = sessionsBySong.get(session.songId) ?? [];
    list.push(session);
    sessionsBySong.set(session.songId, list);
  }

  return Array.from(sessionsBySong.entries())
    .map(([songId, sessions]) => {
      const completed = sessions.filter((session) => (session.completionPct ?? 0) >= 90).length;
      const followSessions = sessions.filter((session) => session.mode === "follow").length;
      const variantCount = new Map<"original" | "lv1" | "lv2" | "lv3", number>();
      for (const session of sessions) {
        variantCount.set(session.variant, (variantCount.get(session.variant) ?? 0) + 1);
      }
      const dominantVariant =
        Array.from(variantCount.entries()).sort((a, b) => b[1] - a[1] || VARIANT_RANK[a[0]] - VARIANT_RANK[b[0]])[0]?.[0] ?? "lv1";

      return {
        songId,
        sessionCount: sessions.length,
        completionRatePct: roundPct(completed, sessions.length),
        avgScore: averageRounded(sessions.map((session) => session.score)),
        followModeRatePct: roundPct(followSessions, sessions.length),
        dominantVariant,
      };
    })
    .sort((a, b) => b.sessionCount - a.sessionCount || b.avgScore - a.avgScore);
}

function buildVariantAnalytics(endedSessions: EndedPracticeSessionLite[]): PracticeVariantAnalytics[] {
  const allVariants: Array<"original" | "lv1" | "lv2" | "lv3"> = ["lv1", "lv2", "lv3", "original"];
  return allVariants.map((variant) => {
    const sessions = endedSessions.filter((session) => session.variant === variant);
    const completed = sessions.filter((session) => (session.completionPct ?? 0) >= 90).length;
    const followSessions = sessions.filter((session) => session.mode === "follow").length;
    return {
      variant,
      sessionCount: sessions.length,
      completionRatePct: roundPct(completed, sessions.length),
      avgScore: averageRounded(sessions.map((session) => session.score)),
      followModeRatePct: roundPct(followSessions, sessions.length),
    };
  });
}

function buildDailyTrend(endedSessions: EndedPracticeSessionLite[], windowDays: 7 | 30): PracticeDailyTrend[] {
  const sessionsByDate = new Map<string, EndedPracticeSessionLite[]>();
  for (const session of endedSessions) {
    const key = toDateKey(session.startedAt);
    const list = sessionsByDate.get(key) ?? [];
    list.push(session);
    sessionsByDate.set(key, list);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: PracticeDailyTrend[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = toDateKey(date);
    const sessions = sessionsByDate.get(key) ?? [];
    const completed = sessions.filter((session) => (session.completionPct ?? 0) >= 90).length;
    result.push({
      dateKey: key,
      sessionCount: sessions.length,
      completionRatePct: roundPct(completed, sessions.length),
      avgScore: averageRounded(sessions.map((session) => session.score)),
    });
  }
  return result;
}

function buildVariantSwitchEvents(sessions: EndedPracticeSessionLite[]): PracticeVariantSwitchEvent[] {
  const events: PracticeVariantSwitchEvent[] = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const current = sessions[index];
    const previous = sessions[index - 1];
    const fromVariant = previous?.variant ?? null;
    const toVariant = current.variant;

    let direction: PracticeVariantSwitchEvent["direction"] = "start";
    if (fromVariant) {
      const fromRank = VARIANT_RANK[fromVariant];
      const toRank = VARIANT_RANK[toVariant];
      if (toRank > fromRank) direction = "up";
      else if (toRank < fromRank) direction = "down";
      else direction = "same";
    }

    events.push({
      at: current.startedAt,
      fromVariant,
      toVariant,
      direction,
      score: current.score,
      completionPct: current.completionPct,
      mode: current.mode,
    });
  }
  return events;
}

function buildSongDashboardSummary(endedSessions: EndedPracticeSessionLite[]) {
  const summary = buildSummary(endedSessions);
  const completed = endedSessions.filter((session) => (session.completionPct ?? 0) >= 90).length;
  const followSessions = endedSessions.filter((session) => session.mode === "follow").length;
  return {
    sessionCount: endedSessions.length,
    completionRatePct: roundPct(completed, endedSessions.length),
    followModeRatePct: roundPct(followSessions, endedSessions.length),
    avgScore: averageRounded(endedSessions.map((session) => session.score)),
    difficultyUpgradeRatePct: summary.difficultyUpgradeRatePct,
    upgradedSwitches: summary.upgradedSwitches,
    totalSwitches: summary.totalSwitches,
  };
}

export async function startPracticeSession(input: StartPracticeSessionInput) {
  const db = getDb();
  const [created] = await db
    .insert(schema.practiceSessions)
    .values({
      userId: input.userId,
      songId: input.songId,
      variant: input.variant,
      mode: input.mode,
    })
    .returning();
  return created;
}

export async function endPracticeSession(input: EndPracticeSessionInput) {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
    const [session] = await tx
      .update(schema.practiceSessions)
      .set({
        endedAt: new Date(),
        score: input.score,
        midiEventCount: input.midiEventCount,
        noteOnCount: input.noteOnCount,
        noteOffCount: input.noteOffCount,
        rightAccuracyPct: input.rightAccuracyPct ?? null,
        leftAccuracyPct: input.leftAccuracyPct ?? null,
        requiredNoteCount: input.requiredNoteCount ?? 0,
        hitCount: input.hitCount ?? 0,
        missCount: input.missCount ?? 0,
        wrongCount: input.wrongCount ?? 0,
        completionPct: input.completionPct ?? null,
      })
      .where(and(eq(schema.practiceSessions.id, input.id), eq(schema.practiceSessions.userId, input.userId)))
      .returning();

    if (!session) {
      return null;
    }

    await tx.delete(schema.practiceMeasureStats).where(eq(schema.practiceMeasureStats.practiceSessionId, session.id));

    const measureStats = input.measureStats ?? [];
    if (measureStats.length > 0) {
      await tx.insert(schema.practiceMeasureStats).values(
        measureStats.map((measureStat) => ({
          practiceSessionId: session.id,
          measureIndex: measureStat.measureIndex,
          hand: measureStat.hand,
          hitCount: measureStat.hitCount,
          missCount: measureStat.missCount,
          avgTimingOffsetMs: measureStat.avgTimingOffsetMs,
        }))
      );
    }

    return session;
  });

  return updated;
}

export async function getLatestPracticeSession(userId: string, songId: string) {
  const db = getDb();
  const latest = await db.query.practiceSessions.findFirst({
    where: and(eq(schema.practiceSessions.userId, userId), eq(schema.practiceSessions.songId, songId)),
    orderBy: (practiceSessions, { desc }) => [desc(practiceSessions.startedAt)],
    with: {
      measureStats: true,
    },
  });

  return latest ?? null;
}

export async function getPracticeAnalyticsSummary(userId: string): Promise<PracticeAnalyticsSummary> {
  const dashboard = await getPracticeAnalyticsDashboard(userId, 30);
  return dashboard.summary;
}

export async function getPracticeAnalyticsDashboard(userId: string, windowDaysRaw: number): Promise<PracticeAnalyticsDashboard> {
  const db = getDb();
  const windowDays = clampWindowDays(windowDaysRaw);
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (windowDays - 1));

  const sessions = await db.query.practiceSessions.findMany({
    where: and(eq(schema.practiceSessions.userId, userId), gte(schema.practiceSessions.startedAt, sinceDate)),
    orderBy: (practiceSessions, { asc }) => [asc(practiceSessions.startedAt)],
    columns: {
      songId: true,
      mode: true,
      variant: true,
      completionPct: true,
      endedAt: true,
      startedAt: true,
      score: true,
    },
  });

  const endedSessions = sessions.filter((session) => session.endedAt !== null) as EndedPracticeSessionLite[];

  return {
    windowDays,
    summary: buildSummary(endedSessions),
    bySong: buildSongAnalytics(endedSessions),
    byVariant: buildVariantAnalytics(endedSessions),
    dailyTrend: buildDailyTrend(endedSessions, windowDays),
  };
}

export async function getPracticeSongAnalyticsDashboard(
  userId: string,
  songId: string,
  windowDaysRaw: number
): Promise<PracticeSongAnalyticsDashboard> {
  const db = getDb();
  const windowDays = clampWindowDays(windowDaysRaw);
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - (windowDays - 1));

  const sessions = await db.query.practiceSessions.findMany({
    where: and(
      eq(schema.practiceSessions.userId, userId),
      eq(schema.practiceSessions.songId, songId),
      gte(schema.practiceSessions.startedAt, sinceDate)
    ),
    orderBy: (practiceSessions, { asc }) => [asc(practiceSessions.startedAt)],
    columns: {
      songId: true,
      mode: true,
      variant: true,
      completionPct: true,
      endedAt: true,
      startedAt: true,
      score: true,
    },
  });

  const endedSessions = sessions.filter((session) => session.endedAt !== null) as EndedPracticeSessionLite[];
  const summary = buildSongDashboardSummary(endedSessions);

  return {
    windowDays,
    songId,
    sessionCount: summary.sessionCount,
    completionRatePct: summary.completionRatePct,
    followModeRatePct: summary.followModeRatePct,
    avgScore: summary.avgScore,
    variantBreakdown: buildVariantAnalytics(endedSessions),
    dailyTrend: buildDailyTrend(endedSessions, windowDays),
    switchEvents: buildVariantSwitchEvents(endedSessions),
    difficultyUpgradeRatePct: summary.difficultyUpgradeRatePct,
    upgradedSwitches: summary.upgradedSwitches,
    totalSwitches: summary.totalSwitches,
  };
}

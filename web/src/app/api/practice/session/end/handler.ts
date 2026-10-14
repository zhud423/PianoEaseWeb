import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/user";
import { endPracticeSession } from "@/db/repositories/practice";
import type { PracticeMeasureStatPayload } from "@/lib/practice/metrics";

type EndPracticePayload = {
  sessionId: string;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || isFiniteNumber(value);
}

function isMeasureStatPayload(value: unknown): value is PracticeMeasureStatPayload {
  if (!value || typeof value !== "object") return false;
  const stat = value as Record<string, unknown>;
  return (
    isFiniteNumber(stat.measureIndex) &&
    (stat.hand === "left" || stat.hand === "right") &&
    isFiniteNumber(stat.hitCount) &&
    isFiniteNumber(stat.missCount) &&
    isNullableFiniteNumber(stat.avgTimingOffsetMs)
  );
}

const MAX_MEASURE_STATS = 500;

function isEndPayload(value: unknown): value is EndPracticePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sessionId === "string" &&
    isFiniteNumber(payload.score) &&
    isFiniteNumber(payload.midiEventCount) &&
    isFiniteNumber(payload.noteOnCount) &&
    isFiniteNumber(payload.noteOffCount) &&
    isNullableFiniteNumber(payload.rightAccuracyPct) &&
    isNullableFiniteNumber(payload.leftAccuracyPct) &&
    (payload.requiredNoteCount === undefined || isFiniteNumber(payload.requiredNoteCount)) &&
    (payload.hitCount === undefined || isFiniteNumber(payload.hitCount)) &&
    (payload.missCount === undefined || isFiniteNumber(payload.missCount)) &&
    (payload.wrongCount === undefined || isFiniteNumber(payload.wrongCount)) &&
    isNullableFiniteNumber(payload.completionPct) &&
    (payload.measureStats === undefined ||
      (Array.isArray(payload.measureStats) &&
        payload.measureStats.length <= MAX_MEASURE_STATS &&
        payload.measureStats.every(isMeasureStatPayload)))
  );
}

export type EndPracticeSessionDependencies = {
  getCurrentUser: typeof getCurrentUser;
  endPracticeSession: typeof endPracticeSession;
};

const defaultDependencies: EndPracticeSessionDependencies = {
  getCurrentUser,
  endPracticeSession,
};

export async function postEndPracticeSession(
  request: Request,
  dependencies: EndPracticeSessionDependencies = defaultDependencies
) {
  const user = await dependencies.getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isEndPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const updated = await dependencies.endPracticeSession({
      id: body.sessionId,
      userId: user.id,
      score: Math.max(0, Math.round(body.score)),
      midiEventCount: Math.max(0, Math.round(body.midiEventCount)),
      noteOnCount: Math.max(0, Math.round(body.noteOnCount)),
      noteOffCount: Math.max(0, Math.round(body.noteOffCount)),
      rightAccuracyPct:
        typeof body.rightAccuracyPct === "number"
          ? Math.min(100, Math.max(0, Math.round(body.rightAccuracyPct)))
          : null,
      leftAccuracyPct:
        typeof body.leftAccuracyPct === "number"
          ? Math.min(100, Math.max(0, Math.round(body.leftAccuracyPct)))
          : null,
      requiredNoteCount:
        typeof body.requiredNoteCount === "number"
          ? Math.max(0, Math.round(body.requiredNoteCount))
          : 0,
      hitCount: typeof body.hitCount === "number" ? Math.max(0, Math.round(body.hitCount)) : 0,
      missCount: typeof body.missCount === "number" ? Math.max(0, Math.round(body.missCount)) : 0,
      wrongCount: typeof body.wrongCount === "number" ? Math.max(0, Math.round(body.wrongCount)) : 0,
      completionPct:
        typeof body.completionPct === "number"
          ? Math.min(100, Math.max(0, Math.round(body.completionPct)))
          : null,
      measureStats: (body.measureStats ?? []).map((measureStat) => ({
        measureIndex: Math.max(0, Math.round(measureStat.measureIndex)),
        hand: measureStat.hand,
        hitCount: Math.max(0, Math.round(measureStat.hitCount)),
        missCount: Math.max(0, Math.round(measureStat.missCount)),
        avgTimingOffsetMs:
          typeof measureStat.avgTimingOffsetMs === "number"
            ? Math.round(measureStat.avgTimingOffsetMs)
            : null,
      })),
    });

    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, sessionId: updated.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end practice session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

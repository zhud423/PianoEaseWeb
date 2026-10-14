export const PERFECT_WINDOW_MS = 50;
export const GOOD_WINDOW_MS = 150;

export type TimingJudge = "Perfect" | "Good" | "Miss";

export function classifyTimingJudge(timingOffsetMs: number): TimingJudge {
  const delta = Math.abs(timingOffsetMs);
  if (delta <= PERFECT_WINDOW_MS) return "Perfect";
  if (delta <= GOOD_WINDOW_MS) return "Good";
  return "Miss";
}

export function scoreDeltaByJudge(judge: Exclude<TimingJudge, "Miss">): number {
  return judge === "Perfect" ? 100 : 50;
}

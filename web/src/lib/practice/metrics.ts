import type { ChartVariantId } from "@/lib/chart/types";

export type PracticeMeasureStatPayload = {
  measureIndex: number;
  hand: "left" | "right";
  hitCount: number;
  missCount: number;
  avgTimingOffsetMs: number | null;
};

export type PracticeMeasureWrongPayload = {
  measureIndex: number;
  wrongCount: number;
};

export type PracticeMetrics = {
  variantId: ChartVariantId;
  mode: "waiting" | "free";
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  wrongCount: number;
  missCount: number;
  hitCount: number;
  totalRequiredNotes: number;
  rightAccuracyPct: number;
  leftAccuracyPct: number;
  currentMeasureIndex: number;
  measureStats: PracticeMeasureStatPayload[];
  wrongByMeasure: PracticeMeasureWrongPayload[];
};

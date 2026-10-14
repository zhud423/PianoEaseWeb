type MeasureStatLike = {
  measureIndex: number;
  missCount: number;
  avgTimingOffsetMs: number | null;
};

export type ReportSummary = {
  heatValues: number[];
  maxMissValue: number;
  weakestMeasureIndex: number;
  rhythmLabel: string;
  weakBarLabel: string;
};

type BuildReportSummaryInput = {
  measureStats: MeasureStatLike[];
  measureCount: number;
};

export function buildReportSummary({ measureStats, measureCount }: BuildReportSummaryInput): ReportSummary {
  const safeMeasureCount = Math.max(1, measureCount);
  const missByMeasure = new Map<number, number>();
  const timingSamples = measureStats.filter((measureStat) => typeof measureStat.avgTimingOffsetMs === "number");

  for (const measureStat of measureStats) {
    missByMeasure.set(measureStat.measureIndex, (missByMeasure.get(measureStat.measureIndex) ?? 0) + measureStat.missCount);
  }

  const heatValues = Array.from({ length: safeMeasureCount }, (_, measureIndex) => missByMeasure.get(measureIndex) ?? 0);
  const maxMissValue = Math.max(1, ...heatValues);
  const highestMiss = Math.max(0, ...heatValues);
  const weakestMeasureIndex = highestMiss > 0 ? heatValues.findIndex((value) => value === highestMiss) : -1;
  const avgTimingOffsetMs =
    timingSamples.length > 0
      ? Math.round(
          timingSamples.reduce((sum, measureStat) => sum + (measureStat.avgTimingOffsetMs ?? 0), 0) / timingSamples.length
        )
      : null;

  const rhythmLabel =
    avgTimingOffsetMs === null
      ? "暂无节奏数据"
      : avgTimingOffsetMs > 0
      ? `整体偏慢 ${avgTimingOffsetMs}ms`
      : avgTimingOffsetMs < 0
      ? `整体偏快 ${Math.abs(avgTimingOffsetMs)}ms`
      : "节奏稳定";
  const weakBarLabel = weakestMeasureIndex >= 0 ? `第 ${weakestMeasureIndex + 1} 小节` : "暂无薄弱小节";

  return {
    heatValues,
    maxMissValue,
    weakestMeasureIndex,
    rhythmLabel,
    weakBarLabel,
  };
}

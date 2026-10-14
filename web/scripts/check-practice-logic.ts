import { classifyTimingJudge, scoreDeltaByJudge } from "../src/lib/practice/judgement";
import { buildReportSummary } from "../src/lib/practice/report-summary";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkJudgementBoundaries() {
  assert(classifyTimingJudge(0) === "Perfect", "0ms should be Perfect");
  assert(classifyTimingJudge(50) === "Perfect", "50ms boundary should be Perfect");
  assert(classifyTimingJudge(-50) === "Perfect", "-50ms boundary should be Perfect");
  assert(classifyTimingJudge(51) === "Good", "51ms should be Good");
  assert(classifyTimingJudge(-149) === "Good", "-149ms should be Good");
  assert(classifyTimingJudge(150) === "Good", "150ms boundary should be Good");
  assert(classifyTimingJudge(151) === "Miss", "151ms should be Miss");
  assert(scoreDeltaByJudge("Perfect") === 100, "Perfect score delta should be 100");
  assert(scoreDeltaByJudge("Good") === 50, "Good score delta should be 50");
}

function checkReportSummaryAggregation() {
  const summary = buildReportSummary({
    measureCount: 4,
    measureStats: [
      { measureIndex: 0, missCount: 1, avgTimingOffsetMs: -12 },
      { measureIndex: 1, missCount: 3, avgTimingOffsetMs: 18 },
      { measureIndex: 1, missCount: 2, avgTimingOffsetMs: 10 },
      { measureIndex: 2, missCount: 0, avgTimingOffsetMs: null },
      { measureIndex: 3, missCount: 1, avgTimingOffsetMs: -6 },
    ],
  });

  assert(summary.heatValues.length === 4, "heatValues length should match measureCount");
  assert(summary.heatValues[0] === 1, "measure 1 miss should be 1");
  assert(summary.heatValues[1] === 5, "measure 2 misses should aggregate to 5");
  assert(summary.maxMissValue === 5, "maxMissValue should be 5");
  assert(summary.weakestMeasureIndex === 1, "weakest measure should be index 1");
  assert(summary.weakBarLabel === "第 2 小节", "weak bar label should match index");
  assert(summary.rhythmLabel.startsWith("整体偏快") || summary.rhythmLabel.startsWith("整体偏慢"), "rhythm label should be computed");
}

function checkReportSummaryEmptyFallback() {
  const summary = buildReportSummary({
    measureCount: 0,
    measureStats: [],
  });

  assert(summary.heatValues.length === 1, "empty measureCount should fallback to one heat slot");
  assert(summary.maxMissValue === 1, "empty maxMissValue should fallback to 1");
  assert(summary.weakestMeasureIndex === -1, "empty weakest measure should be -1");
  assert(summary.weakBarLabel === "暂无薄弱小节", "empty weak bar label mismatch");
  assert(summary.rhythmLabel === "暂无节奏数据", "empty rhythm label mismatch");
}

function main() {
  checkJudgementBoundaries();
  checkReportSummaryAggregation();
  checkReportSummaryEmptyFallback();
  console.log("Practice logic check passed.");
}

main();

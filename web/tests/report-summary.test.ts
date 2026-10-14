import assert from "node:assert/strict";
import test from "node:test";
import { buildReportSummary } from "../src/lib/practice/report-summary";

test("buildReportSummary aggregates misses and timing label", () => {
  const summary = buildReportSummary({
    measureCount: 4,
    measureStats: [
      { measureIndex: 0, missCount: 1, avgTimingOffsetMs: -40 },
      { measureIndex: 1, missCount: 2, avgTimingOffsetMs: -30 },
      { measureIndex: 1, missCount: 3, avgTimingOffsetMs: -20 },
      { measureIndex: 3, missCount: 1, avgTimingOffsetMs: 10 },
    ],
  });

  assert.deepEqual(summary.heatValues, [1, 5, 0, 1]);
  assert.equal(summary.maxMissValue, 5);
  assert.equal(summary.weakestMeasureIndex, 1);
  assert.equal(summary.weakBarLabel, "第 2 小节");
  assert.equal(summary.rhythmLabel, "整体偏快 20ms");
});

test("buildReportSummary handles empty measure stats", () => {
  const summary = buildReportSummary({
    measureCount: 0,
    measureStats: [],
  });

  assert.deepEqual(summary.heatValues, [0]);
  assert.equal(summary.maxMissValue, 1);
  assert.equal(summary.weakestMeasureIndex, -1);
  assert.equal(summary.weakBarLabel, "暂无薄弱小节");
  assert.equal(summary.rhythmLabel, "暂无节奏数据");
});

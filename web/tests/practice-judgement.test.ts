import assert from "node:assert/strict";
import test from "node:test";
import { classifyTimingJudge, scoreDeltaByJudge } from "../src/lib/practice/judgement";

test("classifyTimingJudge handles boundary thresholds", () => {
  assert.equal(classifyTimingJudge(0), "Perfect");
  assert.equal(classifyTimingJudge(50), "Perfect");
  assert.equal(classifyTimingJudge(-50), "Perfect");
  assert.equal(classifyTimingJudge(51), "Good");
  assert.equal(classifyTimingJudge(-120), "Good");
  assert.equal(classifyTimingJudge(150), "Good");
  assert.equal(classifyTimingJudge(151), "Miss");
});

test("scoreDeltaByJudge maps score correctly", () => {
  assert.equal(scoreDeltaByJudge("Perfect"), 100);
  assert.equal(scoreDeltaByJudge("Good"), 50);
});

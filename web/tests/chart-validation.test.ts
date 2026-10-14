import assert from "node:assert/strict";
import test from "node:test";
import friendshipYearsChartRaw from "../content/songs/friendship-years/chart.v0.json";
import { parseSongChart } from "../src/lib/chart/validation";

test("parseSongChart accepts valid fixture chart", () => {
  const chart = parseSongChart(friendshipYearsChartRaw, "fixture");
  assert.equal(chart.songId, "friendship-years");
  assert.equal(chart.variants.length, 4);
});

test("parseSongChart rejects missing required variant", () => {
  const invalid = structuredClone(friendshipYearsChartRaw) as typeof friendshipYearsChartRaw;
  invalid.variants = invalid.variants.filter((variant) => variant.id !== "lv3");

  assert.throws(() => parseSongChart(invalid, "fixture"), /missing variant lv3/);
});

test("parseSongChart rejects invalid note duration", () => {
  const invalid = structuredClone(friendshipYearsChartRaw) as typeof friendshipYearsChartRaw;
  invalid.variants[0].noteEvents[0].durationTick = 0;

  assert.throws(() => parseSongChart(invalid, "fixture"), /invalid noteEvent\.durationTick/);
});

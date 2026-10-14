import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { findChartBySongId } from "../src/lib/chart/catalog";
import type { ChartVariantId, NoteEvent } from "../src/lib/chart/types";
import { SONGS } from "../src/lib/songs/catalog";

type BenchConfig = {
  songId: string;
  variantId: ChartVariantId;
  iterations: number;
  frames: number;
  strict: boolean;
  outputPath: string;
};

type TimingStats = {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
};

type RenderSimulationResult = {
  checksum: number;
  visibleBlocks: number;
};

type JudgeSimulationResult = {
  score: number;
  perfectCount: number;
  goodCount: number;
  wrongCount: number;
  missCount: number;
  hitCount: number;
};

type BenchmarkReport = {
  generatedAt: string;
  config: BenchConfig;
  chart: {
    songId: string;
    variantId: ChartVariantId;
    measureCount: number;
    noteEventCount: number;
    requiredNoteCount: number;
    bpm: number;
    ppq: number;
  };
  metrics: {
    renderMsPerFrame: TimingStats;
    judgeMsPerNote: TimingStats;
    hitRatePct: TimingStats;
    wrongRatePct: TimingStats;
    missRatePct: TimingStats;
  };
  thresholds: {
    renderP95MsPerFrameMax: number;
    judgeP95MsPerNoteMax: number;
  };
  pass: boolean;
  checksum: number;
};

const DEFAULT_SONG_ID = "friendship-years";
const DEFAULT_VARIANT_ID: ChartVariantId = "lv3";
const DEFAULT_ITERATIONS = 32;
const DEFAULT_FRAMES = 2200;
const VALID_VARIANTS = new Set<ChartVariantId>(["original", "lv1", "lv2", "lv3"]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function readArgValue(args: string[], key: string): string | undefined {
  const prefix = `--${key}=`;
  return args.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }
  return parsed;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[index];
}

function summarize(values: number[]): TimingStats {
  assert(values.length > 0, "Cannot summarize empty values.");
  const sorted = [...values].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatMs(value: number): string {
  return `${value.toFixed(4)}ms`;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function resolveConfig(argv: string[]): BenchConfig {
  const songId = readArgValue(argv, "song") ?? DEFAULT_SONG_ID;
  const variantArg = readArgValue(argv, "variant") ?? DEFAULT_VARIANT_ID;
  assert(VALID_VARIANTS.has(variantArg as ChartVariantId), `Invalid variant: ${variantArg}`);
  const variantId = variantArg as ChartVariantId;
  const iterations = parsePositiveInteger(readArgValue(argv, "iterations"), DEFAULT_ITERATIONS);
  const frames = parsePositiveInteger(readArgValue(argv, "frames"), DEFAULT_FRAMES);
  const strict = argv.includes("--strict");

  const outputArg = readArgValue(argv, "output");
  const outputPath =
    outputArg ?? path.join(process.cwd(), "reports", "perf", `practice-${songId}-${variantId}.baseline.json`);

  return {
    songId,
    variantId,
    iterations,
    frames,
    strict,
    outputPath,
  };
}

function simulateRenderPass(
  noteEvents: NoteEvent[],
  ppq: number,
  frameCount: number,
  maxTick: number,
  rng: () => number
): RenderSimulationResult {
  const midiValues = Array.from(new Set(noteEvents.map((noteEvent) => noteEvent.midi))).sort((a, b) => a - b);
  const laneIndexByMidi = new Map<number, number>(midiValues.map((midi, index) => [midi, index]));
  const hitIds = new Set<string>();
  const judgedIds = new Set<string>();

  for (const noteEvent of noteEvents) {
    const roll = rng();
    if (roll < 0.28) hitIds.add(noteEvent.id);
    if (roll < 0.45) judgedIds.add(noteEvent.id);
  }

  const height = 320;
  const judgementY = height - 56;
  const lookAheadTick = ppq * 5;
  const lookBehindTick = ppq * 2;
  const pixelsPerTick = (height - 80) / (lookAheadTick + lookBehindTick);

  let visibleBlocks = 0;
  let checksum = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const progressTick = (frame / Math.max(1, frameCount - 1)) * maxTick;
    for (const noteEvent of noteEvents) {
      const laneIndex = laneIndexByMidi.get(noteEvent.midi) ?? -1;
      if (laneIndex < 0) continue;

      const y = judgementY - (noteEvent.startTick - progressTick) * pixelsPerTick;
      const blockHeight = Math.max(7, noteEvent.durationTick * pixelsPerTick);
      if (y + blockHeight < 8 || y > height - 24) continue;

      visibleBlocks += 1;
      if (hitIds.has(noteEvent.id)) {
        checksum += laneIndex + 11;
      } else if (judgedIds.has(noteEvent.id)) {
        checksum += laneIndex + 7;
      } else {
        checksum += laneIndex + 3;
      }
    }
  }

  return {
    checksum,
    visibleBlocks,
  };
}

function simulateJudgePass(requiredNotes: NoteEvent[], bpm: number, ppq: number, rng: () => number): JudgeSimulationResult {
  const msPerTick = 60000 / (bpm * ppq);
  const judgedIds = new Set<string>();

  let score = 0;
  let perfectCount = 0;
  let goodCount = 0;
  let wrongCount = 0;
  let missCount = 0;
  let hitCount = 0;

  for (const current of requiredNotes) {
    const roll = rng();
    const emittedNote = roll < 0.86 ? current.midi : clamp(current.midi + (rng() < 0.5 ? -3 : 3), 21, 108);
    const timingOffsetMs = (rng() * 360 - 180) * (roll < 0.86 ? 1 : 1.2);
    const elapsedMs = current.startTick * msPerTick + timingOffsetMs;

    const candidates = requiredNotes.filter((candidate) => {
      if (judgedIds.has(candidate.id)) return false;
      if (candidate.midi !== emittedNote) return false;
      const delta = elapsedMs - candidate.startTick * msPerTick;
      return Math.abs(delta) <= 150;
    });

    if (candidates.length === 0) {
      wrongCount += 1;
      continue;
    }

    const best = candidates.reduce((bestCandidate, candidate) => {
      const bestDelta = Math.abs(elapsedMs - bestCandidate.startTick * msPerTick);
      const candidateDelta = Math.abs(elapsedMs - candidate.startTick * msPerTick);
      return candidateDelta < bestDelta ? candidate : bestCandidate;
    });

    judgedIds.add(best.id);
    hitCount += 1;
    const delta = Math.abs(elapsedMs - best.startTick * msPerTick);
    if (delta <= 50) {
      perfectCount += 1;
      score += 100;
    } else {
      goodCount += 1;
      score += 50;
    }
  }

  const maxElapsedMs = (requiredNotes[requiredNotes.length - 1]?.startTick ?? 0) * msPerTick + 400;
  for (const noteEvent of requiredNotes) {
    if (judgedIds.has(noteEvent.id)) continue;
    const expectedMs = noteEvent.startTick * msPerTick;
    if (maxElapsedMs - expectedMs > 150) {
      missCount += 1;
      judgedIds.add(noteEvent.id);
    }
  }

  return {
    score,
    perfectCount,
    goodCount,
    wrongCount,
    missCount,
    hitCount,
  };
}

async function writeReport(report: BenchmarkReport, outputPath: string) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printStatsLine(label: string, stats: TimingStats, formatter: (value: number) => string) {
  console.log(
    `${label}: avg=${formatter(stats.avg)} p50=${formatter(stats.p50)} p95=${formatter(stats.p95)} p99=${formatter(
      stats.p99
    )} min=${formatter(stats.min)} max=${formatter(stats.max)}`
  );
}

async function main() {
  const config = resolveConfig(process.argv.slice(2));
  const song = SONGS.find((item) => item.id === config.songId);
  assert(song, `Unknown song id: ${config.songId}`);

  const chart = findChartBySongId(song.id);
  assert(chart, `Missing chart: ${song.id}`);
  const variant = chart.variants.find((item) => item.id === config.variantId);
  assert(variant, `Missing variant ${config.variantId} in song ${song.id}`);

  const requiredNotes = variant.noteEvents
    .filter((noteEvent) => noteEvent.required)
    .sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
  assert(requiredNotes.length > 0, `Variant has no required notes: ${song.id}/${config.variantId}`);

  const maxTick = variant.measures[variant.measures.length - 1]?.endTick ?? 1;
  const rngSeedBase = variant.noteEvents.length * 131 + requiredNotes.length * 17 + config.frames;

  const renderMsPerFrameValues: number[] = [];
  const judgeMsPerNoteValues: number[] = [];
  const hitRatePctValues: number[] = [];
  const wrongRatePctValues: number[] = [];
  const missRatePctValues: number[] = [];
  let checksum = 0;

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    const rng = createRng(rngSeedBase + iteration * 97);

    const renderStart = performance.now();
    const renderResult = simulateRenderPass(variant.noteEvents, chart.ppq, config.frames, maxTick, rng);
    const renderDurationMs = performance.now() - renderStart;
    renderMsPerFrameValues.push(renderDurationMs / config.frames);

    const judgeStart = performance.now();
    const judgeResult = simulateJudgePass(requiredNotes, chart.bpm, chart.ppq, rng);
    const judgeDurationMs = performance.now() - judgeStart;
    judgeMsPerNoteValues.push(judgeDurationMs / requiredNotes.length);

    const hitRatePct = (judgeResult.hitCount / requiredNotes.length) * 100;
    const wrongRatePct = (judgeResult.wrongCount / requiredNotes.length) * 100;
    const missRatePct = (judgeResult.missCount / requiredNotes.length) * 100;
    hitRatePctValues.push(hitRatePct);
    wrongRatePctValues.push(wrongRatePct);
    missRatePctValues.push(missRatePct);

    checksum += renderResult.checksum + renderResult.visibleBlocks + judgeResult.score + judgeResult.perfectCount;
  }

  const renderStats = summarize(renderMsPerFrameValues);
  const judgeStats = summarize(judgeMsPerNoteValues);
  const hitRateStats = summarize(hitRatePctValues);
  const wrongRateStats = summarize(wrongRatePctValues);
  const missRateStats = summarize(missRatePctValues);

  const thresholds = {
    renderP95MsPerFrameMax: 1.2,
    judgeP95MsPerNoteMax: 0.45,
  };
  const pass = renderStats.p95 <= thresholds.renderP95MsPerFrameMax && judgeStats.p95 <= thresholds.judgeP95MsPerNoteMax;

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    config,
    chart: {
      songId: song.id,
      variantId: config.variantId,
      measureCount: variant.measures.length,
      noteEventCount: variant.noteEvents.length,
      requiredNoteCount: requiredNotes.length,
      bpm: chart.bpm,
      ppq: chart.ppq,
    },
    metrics: {
      renderMsPerFrame: renderStats,
      judgeMsPerNote: judgeStats,
      hitRatePct: hitRateStats,
      wrongRatePct: wrongRateStats,
      missRatePct: missRateStats,
    },
    thresholds,
    pass,
    checksum,
  };

  await writeReport(report, config.outputPath);

  console.log(`Practice benchmark done. song=${song.id}, variant=${config.variantId}, iterations=${config.iterations}`);
  printStatsLine("render(ms/frame)", renderStats, formatMs);
  printStatsLine("judge(ms/note)", judgeStats, formatMs);
  printStatsLine("hit-rate", hitRateStats, formatPct);
  printStatsLine("wrong-rate", wrongRateStats, formatPct);
  printStatsLine("miss-rate", missRateStats, formatPct);
  console.log(`thresholds: render_p95<=${thresholds.renderP95MsPerFrameMax}ms/frame, judge_p95<=${thresholds.judgeP95MsPerNoteMax}ms/note`);
  console.log(`result: ${pass ? "PASS" : "FAIL"}`);
  console.log(`report: ${config.outputPath}`);

  if (config.strict && !pass) {
    process.exitCode = 1;
  }
}

void main();

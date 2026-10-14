"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChartVariantId, NoteEvent, SongChart } from "@/lib/chart/types";
import { PIANOEASE_MIDI_EVENT, type PianoEaseMidiEventDetail } from "@/lib/midi/events";
import type { PracticeMeasureStatPayload, PracticeMeasureWrongPayload, PracticeMetrics } from "@/lib/practice/metrics";
import { GOOD_WINDOW_MS, classifyTimingJudge, scoreDeltaByJudge } from "@/lib/practice/judgement";

type PlayMode = "waiting" | "free";
type Judge = "Perfect" | "Good";
type LaneLabelMode = "jianpu" | "pitch";

type WaterfallWaitingPanelProps = {
  chart: SongChart;
  variantId: ChartVariantId;
  onMetricsChange?: (metrics: PracticeMetrics) => void;
};

type JudgeState = {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  wrongCount: number;
  missCount: number;
  hitCount: number;
  lastJudge: string;
};

type MeasureStatAccumulator = {
  measureIndex: number;
  hand: "left" | "right";
  hitCount: number;
  missCount: number;
  timingTotalMs: number;
  timingSamples: number;
};

type JianpuLabel = {
  text: string;
  upperDots: number;
  lowerDots: number;
};

function midiToJianpuLabel(midi: number): JianpuLabel {
  const names = ["1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const octaveShift = octave - 4;
  return {
    text: names[pitchClass],
    upperDots: Math.max(0, octaveShift),
    lowerDots: Math.max(0, -octaveShift),
  };
}

function midiToPitchName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[pitchClass]}${octave}`;
}

function sortNotes(noteEvents: NoteEvent[]): NoteEvent[] {
  return [...noteEvents].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi);
}

export function WaterfallWaitingPanel({ chart, variantId, onMetricsChange }: WaterfallWaitingPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<PlayMode>("waiting");
  const [laneLabelMode, setLaneLabelMode] = useState<LaneLabelMode>("jianpu");
  const [groupIndex, setGroupIndex] = useState(0);
  const [progressTick, setProgressTick] = useState(0);
  const [hitIds, setHitIds] = useState<Set<string>>(() => new Set());
  const [judgedIds, setJudgedIds] = useState<Set<string>>(() => new Set());
  const [judgeState, setJudgeState] = useState<JudgeState>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    wrongCount: 0,
    missCount: 0,
    hitCount: 0,
    lastJudge: "等待 MIDI 输入...",
  });

  const selectedVariant = useMemo(
    () => chart.variants.find((variant) => variant.id === variantId) ?? chart.variants[0],
    [chart.variants, variantId]
  );
  const sortedNotes = useMemo(() => sortNotes(selectedVariant.noteEvents), [selectedVariant.noteEvents]);
  const requiredNotes = useMemo(() => sortedNotes.filter((noteEvent) => noteEvent.required), [sortedNotes]);
  const groupedStartTicks = useMemo(
    () => Array.from(new Set(requiredNotes.map((noteEvent) => noteEvent.startTick))).sort((a, b) => a - b),
    [requiredNotes]
  );
  const notesByStartTick = useMemo(() => {
    const map = new Map<number, NoteEvent[]>();
    for (const noteEvent of requiredNotes) {
      const list = map.get(noteEvent.startTick) ?? [];
      list.push(noteEvent);
      map.set(noteEvent.startTick, list);
    }
    return map;
  }, [requiredNotes]);

  const msPerTick = 60000 / (chart.bpm * chart.ppq);
  const firstTick = groupedStartTicks[0] ?? 0;

  const modeRef = useRef<PlayMode>(mode);
  const groupIndexRef = useRef(0);
  const hitIdsRef = useRef<Set<string>>(new Set());
  const judgedIdsRef = useRef<Set<string>>(new Set());
  const groupedTicksRef = useRef<number[]>(groupedStartTicks);
  const notesByStartRef = useRef<Map<number, NoteEvent[]>>(notesByStartTick);
  const requiredNotesRef = useRef<NoteEvent[]>(requiredNotes);
  const freeStartRef = useRef(0);
  const measureStatsRef = useRef<Map<string, MeasureStatAccumulator>>(new Map());
  const wrongByMeasureRef = useRef<Map<number, number>>(new Map());
  const markMissRef = useRef<(noteEvent: NoteEvent, message: string) => void>(() => {});
  const waitingMidiRef = useRef<(note: number) => void>(() => {});
  const freeMidiRef = useRef<(note: number, at: number) => void>(() => {});

  const ensureMeasureAccumulator = (noteEvent: NoteEvent): MeasureStatAccumulator => {
    const key = `${noteEvent.measureIndex}-${noteEvent.hand}`;
    const existing = measureStatsRef.current.get(key);
    if (existing) return existing;
    const created: MeasureStatAccumulator = {
      measureIndex: noteEvent.measureIndex,
      hand: noteEvent.hand,
      hitCount: 0,
      missCount: 0,
      timingTotalMs: 0,
      timingSamples: 0,
    };
    measureStatsRef.current.set(key, created);
    return created;
  };

  const resolveMeasureIndexByTick = (tick: number): number => {
    const measure = selectedVariant.measures.find((candidate) => tick >= candidate.startTick && tick < candidate.endTick);
    return measure?.index ?? selectedVariant.measures[selectedVariant.measures.length - 1]?.index ?? 0;
  };

  const markWrong = (measureIndex: number, message: string) => {
    wrongByMeasureRef.current.set(measureIndex, (wrongByMeasureRef.current.get(measureIndex) ?? 0) + 1);
    setJudgeState((current) => ({
      ...current,
      wrongCount: current.wrongCount + 1,
      combo: 0,
      lastJudge: message,
    }));
  };

  const markHit = (noteEvent: NoteEvent, judge: Judge, timingOffsetMs: number) => {
    if (judgedIdsRef.current.has(noteEvent.id)) return;

    const nextJudged = new Set(judgedIdsRef.current);
    nextJudged.add(noteEvent.id);
    judgedIdsRef.current = nextJudged;
    setJudgedIds(nextJudged);

    const nextHit = new Set(hitIdsRef.current);
    nextHit.add(noteEvent.id);
    hitIdsRef.current = nextHit;
    setHitIds(nextHit);

    const scoreDelta = scoreDeltaByJudge(judge);
    setJudgeState((current) => {
      const nextCombo = current.combo + 1;
      return {
        ...current,
        score: current.score + scoreDelta,
        combo: nextCombo,
        maxCombo: Math.max(current.maxCombo, nextCombo),
        perfectCount: current.perfectCount + (judge === "Perfect" ? 1 : 0),
        goodCount: current.goodCount + (judge === "Good" ? 1 : 0),
        hitCount: current.hitCount + 1,
        lastJudge: `${judge}: ${noteEvent.pitchName}`,
      };
    });

    const accumulator = ensureMeasureAccumulator(noteEvent);
    accumulator.hitCount += 1;
    accumulator.timingSamples += 1;
    accumulator.timingTotalMs += timingOffsetMs;
  };

  const markMiss = (noteEvent: NoteEvent, message: string) => {
    if (judgedIdsRef.current.has(noteEvent.id)) return;

    const nextJudged = new Set(judgedIdsRef.current);
    nextJudged.add(noteEvent.id);
    judgedIdsRef.current = nextJudged;
    setJudgedIds(nextJudged);

    setJudgeState((current) => ({
      ...current,
      missCount: current.missCount + 1,
      combo: 0,
      lastJudge: message,
    }));

    const accumulator = ensureMeasureAccumulator(noteEvent);
    accumulator.missCount += 1;
  };

  const handleWaitingMidi = (note: number) => {
    const ticks = groupedTicksRef.current;
    const activeGroup = groupIndexRef.current;
    const activeTick = ticks[activeGroup];
    if (activeTick === undefined) {
      setJudgeState((current) => ({ ...current, lastJudge: "已到达尾部" }));
      return;
    }

    const notes = notesByStartRef.current.get(activeTick) ?? [];
    const candidate = notes.find((noteEvent) => !judgedIdsRef.current.has(noteEvent.id) && noteEvent.midi === note);
    if (!candidate) {
      const measureIndex = notes[0]?.measureIndex ?? resolveMeasureIndexByTick(activeTick);
      markWrong(measureIndex, `Wrong(错音): ${note}`);
      return;
    }

    markHit(candidate, "Perfect", 0);
    const unfinished = notes.some((noteEvent) => !judgedIdsRef.current.has(noteEvent.id));
    if (!unfinished) {
      const nextGroup = activeGroup + 1;
      groupIndexRef.current = nextGroup;
      setGroupIndex(nextGroup);

      const nextTick = ticks[nextGroup];
      if (nextTick !== undefined) {
        setProgressTick(nextTick);
      } else {
        const endTick = selectedVariant.measures[selectedVariant.measures.length - 1]?.endTick ?? activeTick;
        setProgressTick(endTick);
      }
    }
  };

  const handleFreeMidi = (note: number, at: number) => {
    const elapsedMs = at - freeStartRef.current;
    const candidates = requiredNotesRef.current.filter((noteEvent) => {
      if (judgedIdsRef.current.has(noteEvent.id)) return false;
      if (noteEvent.midi !== note) return false;
      const delta = elapsedMs - noteEvent.startTick * msPerTick;
      return Math.abs(delta) <= GOOD_WINDOW_MS;
    });

    if (candidates.length === 0) {
      const measureIndex = resolveMeasureIndexByTick(elapsedMs / msPerTick);
      markWrong(measureIndex, `Wrong(错音): ${note}`);
      return;
    }

    const best = candidates.reduce((bestCandidate, candidate) => {
      const bestDelta = Math.abs(elapsedMs - bestCandidate.startTick * msPerTick);
      const nextDelta = Math.abs(elapsedMs - candidate.startTick * msPerTick);
      return nextDelta < bestDelta ? candidate : bestCandidate;
    });

    const timingOffsetMs = elapsedMs - best.startTick * msPerTick;
    const judge = classifyTimingJudge(timingOffsetMs);
    if (judge === "Miss") {
      markMiss(best, `Miss(漏弹): ${best.pitchName}`);
      return;
    }
    markHit(best, judge, timingOffsetMs);
  };

  const buildMeasureStats = (): PracticeMeasureStatPayload[] => {
    return Array.from(measureStatsRef.current.values())
      .map((value) => ({
        measureIndex: value.measureIndex,
        hand: value.hand,
        hitCount: value.hitCount,
        missCount: value.missCount,
        avgTimingOffsetMs: value.timingSamples > 0 ? Math.round(value.timingTotalMs / value.timingSamples) : null,
      }))
      .sort((a, b) => a.measureIndex - b.measureIndex || a.hand.localeCompare(b.hand));
  };

  const buildWrongByMeasure = (): PracticeMeasureWrongPayload[] => {
    return Array.from(wrongByMeasureRef.current.entries())
      .map(([measureIndex, wrongCount]) => ({
        measureIndex,
        wrongCount,
      }))
      .sort((a, b) => a.measureIndex - b.measureIndex);
  };

  useEffect(() => {
    markMissRef.current = markMiss;
    waitingMidiRef.current = handleWaitingMidi;
    freeMidiRef.current = handleFreeMidi;
  });

  useEffect(() => {
    modeRef.current = mode;
    groupIndexRef.current = groupIndex;
    hitIdsRef.current = hitIds;
    judgedIdsRef.current = judgedIds;
    groupedTicksRef.current = groupedStartTicks;
    notesByStartRef.current = notesByStartTick;
    requiredNotesRef.current = requiredNotes;
  }, [groupIndex, groupedStartTicks, hitIds, judgedIds, mode, notesByStartTick, requiredNotes]);

  useEffect(() => {
    if (mode !== "free") return;
    if (freeStartRef.current === 0) {
      freeStartRef.current = performance.now() - progressTick * msPerTick;
    }

    const maxTick = selectedVariant.measures[selectedVariant.measures.length - 1]?.endTick ?? 0;
    let frameId = 0;

    const onFrame = (now: number) => {
      const elapsedMs = now - freeStartRef.current;
      const currentTick = Math.min(maxTick, elapsedMs / msPerTick);
      setProgressTick(currentTick);

      for (const noteEvent of requiredNotesRef.current) {
        if (judgedIdsRef.current.has(noteEvent.id)) continue;
        const expectedMs = noteEvent.startTick * msPerTick;
        if (elapsedMs - expectedMs > GOOD_WINDOW_MS) {
          markMissRef.current(noteEvent, `Miss(漏弹): ${noteEvent.pitchName}`);
        }
      }

      frameId = window.requestAnimationFrame(onFrame);
    };

    frameId = window.requestAnimationFrame(onFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [mode, msPerTick, progressTick, selectedVariant.measures]);

  useEffect(() => {
    const onMidi = (event: Event) => {
      const detail = (event as CustomEvent<PianoEaseMidiEventDetail>).detail;
      if (!detail || detail.type !== "note_on") return;
      if (modeRef.current === "waiting") {
        waitingMidiRef.current(detail.note);
      } else {
        freeMidiRef.current(detail.note, detail.at);
      }
    };

    window.addEventListener(PIANOEASE_MIDI_EVENT, onMidi as EventListener);
    return () => window.removeEventListener(PIANOEASE_MIDI_EVENT, onMidi as EventListener);
  }, []);

  useEffect(() => {
    const rightNotes = requiredNotes.filter((noteEvent) => noteEvent.hand === "right");
    const leftNotes = requiredNotes.filter((noteEvent) => noteEvent.hand === "left");
    const rightHitCount = rightNotes.filter((noteEvent) => hitIds.has(noteEvent.id)).length;
    const leftHitCount = leftNotes.filter((noteEvent) => hitIds.has(noteEvent.id)).length;
    const rightAccuracyPct = rightNotes.length > 0 ? Math.round((rightHitCount / rightNotes.length) * 100) : 0;
    const leftAccuracyPct = leftNotes.length > 0 ? Math.round((leftHitCount / leftNotes.length) * 100) : 0;
    const currentMeasureIndex =
      selectedVariant.measures.find((measure) => progressTick >= measure.startTick && progressTick < measure.endTick)?.index ??
      selectedVariant.measures[selectedVariant.measures.length - 1]?.index ??
      0;

    onMetricsChange?.({
      variantId,
      mode,
      score: judgeState.score,
      combo: judgeState.combo,
      maxCombo: judgeState.maxCombo,
      perfectCount: judgeState.perfectCount,
      goodCount: judgeState.goodCount,
      wrongCount: judgeState.wrongCount,
      missCount: judgeState.missCount,
      hitCount: judgeState.hitCount,
      totalRequiredNotes: requiredNotes.length,
      rightAccuracyPct,
      leftAccuracyPct,
      currentMeasureIndex,
      measureStats: buildMeasureStats(),
      wrongByMeasure: buildWrongByMeasure(),
    });
  }, [hitIds, judgeState, mode, onMetricsChange, progressTick, requiredNotes, selectedVariant.measures, variantId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 900;
    const height = 320;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.fillStyle = "#0b1220";
    context.fillRect(0, 0, width, height);

    const midiValues = Array.from(new Set(sortedNotes.map((noteEvent) => noteEvent.midi))).sort((a, b) => a - b);
    if (midiValues.length === 0) return;

    const lanePadding = 20;
    const laneWidth = (width - lanePadding * 2) / midiValues.length;
    const judgementY = height - 56;
    const lookAheadTick = chart.ppq * 5;
    const lookBehindTick = chart.ppq * 2;
    const pixelsPerTick = (height - 80) / (lookAheadTick + lookBehindTick);

    context.strokeStyle = "rgba(148, 163, 184, 0.2)";
    context.lineWidth = 1;
    for (let laneIndex = 0; laneIndex <= midiValues.length; laneIndex += 1) {
      const x = lanePadding + laneIndex * laneWidth;
      context.beginPath();
      context.moveTo(x, 12);
      context.lineTo(x, height - 24);
      context.stroke();
    }

    for (const noteEvent of sortedNotes) {
      const laneIndex = midiValues.indexOf(noteEvent.midi);
      if (laneIndex < 0) continue;

      const x = lanePadding + laneIndex * laneWidth + laneWidth * 0.1;
      const y = judgementY - (noteEvent.startTick - progressTick) * pixelsPerTick;
      const blockHeight = Math.max(7, noteEvent.durationTick * pixelsPerTick);
      const blockWidth = laneWidth * 0.8;
      if (y + blockHeight < 8 || y > height - 24) continue;

      const isHit = hitIds.has(noteEvent.id);
      const isJudged = judgedIds.has(noteEvent.id);
      if (isHit) {
        context.fillStyle = "rgba(100, 116, 139, 0.6)";
      } else if (isJudged) {
        context.fillStyle = "rgba(239, 68, 68, 0.75)";
      } else if (noteEvent.hand === "right") {
        context.fillStyle = "rgba(16, 185, 129, 0.9)";
      } else {
        context.fillStyle = "rgba(59, 130, 246, 0.9)";
      }

      context.fillRect(x, y, blockWidth, blockHeight);
    }

    context.strokeStyle = "#f8fafc";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(lanePadding, judgementY);
    context.lineTo(width - lanePadding, judgementY);
    context.stroke();

    context.fillStyle = "#cbd5e1";
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    const labelY = height - 16;
    const dotStep = 5;
    const dotRadius = 1.8;
    for (let index = 0; index < midiValues.length; index += 1) {
      if (midiValues.length > 14 && index % 2 === 1) continue;
      const x = lanePadding + index * laneWidth + laneWidth * 0.5;
      if (laneLabelMode === "jianpu") {
        context.font = "12px sans-serif";
        const label = midiToJianpuLabel(midiValues[index]);
        context.fillText(label.text, x, labelY);

        for (let dotIndex = 0; dotIndex < label.upperDots; dotIndex += 1) {
          context.beginPath();
          context.arc(x, labelY - 14 - dotIndex * dotStep, dotRadius, 0, Math.PI * 2);
          context.fill();
        }
        for (let dotIndex = 0; dotIndex < label.lowerDots; dotIndex += 1) {
          context.beginPath();
          context.arc(x, labelY + 5 + dotIndex * dotStep, dotRadius, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        context.font = "11px sans-serif";
        context.fillText(midiToPitchName(midiValues[index]), x, labelY);
      }
    }
    context.textAlign = "start";
  }, [chart.ppq, hitIds, judgedIds, laneLabelMode, progressTick, sortedNotes]);

  const currentMeasure = selectedVariant.measures.find(
    (measure) => progressTick >= measure.startTick && progressTick < measure.endTick
  );
  const targetGroups = groupedStartTicks.length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">瀑布流（Sprint 3）</h2>
          <p className="mt-1 text-sm text-zinc-600">
            当前变体 {variantId}，{mode === "waiting" ? "等待模式" : "自由模式"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setLaneLabelMode("jianpu")}
              className={`rounded-md px-2.5 py-1 text-xs ${
                laneLabelMode === "jianpu" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              简谱
            </button>
            <button
              type="button"
              onClick={() => setLaneLabelMode("pitch")}
              className={`rounded-md px-2.5 py-1 text-xs ${
                laneLabelMode === "pitch" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              音名
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white p-1">
            <button
              type="button"
              onClick={() => {
                const activeTick =
                  groupedStartTicks[groupIndexRef.current] ??
                  selectedVariant.measures[selectedVariant.measures.length - 1]?.endTick ??
                  0;
                setMode("waiting");
                setProgressTick(activeTick);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                mode === "waiting" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              等待模式
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("free");
                freeStartRef.current = performance.now() - progressTick * msPerTick;
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                mode === "free" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              自由模式
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode("waiting");
              setGroupIndex(0);
              groupIndexRef.current = 0;
              setProgressTick(firstTick);
              const emptySet = new Set<string>();
              setHitIds(emptySet);
              setJudgedIds(emptySet);
              hitIdsRef.current = emptySet;
              judgedIdsRef.current = emptySet;
              measureStatsRef.current = new Map();
              wrongByMeasureRef.current = new Map();
              setJudgeState({
                score: 0,
                combo: 0,
                maxCombo: 0,
                perfectCount: 0,
                goodCount: 0,
                wrongCount: 0,
                missCount: 0,
                hitCount: 0,
                lastJudge: "已重置",
              });
            }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
          >
            重置
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Score</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{judgeState.score}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Combo / Max</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {judgeState.combo} / {judgeState.maxCombo}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Perfect / Good</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {judgeState.perfectCount} / {judgeState.goodCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Wrong(错音)</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{judgeState.wrongCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Miss(漏弹)</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{judgeState.missCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3">
        <p className="text-sm text-zinc-700">当前小节：{(currentMeasure?.index ?? 0) + 1}</p>
        <p className="text-sm text-zinc-700">
          目标组：{Math.min(groupIndex + 1, targetGroups)} / {Math.max(targetGroups, 1)}
        </p>
        <p className="text-sm font-medium text-zinc-800">{judgeState.lastJudge}</p>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-900 p-2">
        <canvas ref={canvasRef} className="h-[320px] w-full" />
      </div>
    </section>
  );
}

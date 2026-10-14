import type { SongChart } from "./types";

const ALLOWED_VARIANTS = ["original", "lv1", "lv2", "lv3"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseSongChart(value: unknown, sourceLabel: string): SongChart {
  assert(isObject(value), `${sourceLabel}: chart must be an object`);
  assert(typeof value.songId === "string" && value.songId.length > 0, `${sourceLabel}: songId is required`);
  assert(typeof value.title === "string" && value.title.length > 0, `${sourceLabel}: title is required`);
  assert(isFiniteNumber(value.bpm) && value.bpm > 0, `${sourceLabel}: bpm must be > 0`);
  assert(isFiniteNumber(value.ppq) && value.ppq > 0, `${sourceLabel}: ppq must be > 0`);
  assert(Array.isArray(value.timeSignature) && value.timeSignature.length === 2, `${sourceLabel}: invalid timeSignature`);
  assert(
    value.timeSignature.every((part) => isFiniteNumber(part) && part > 0),
    `${sourceLabel}: invalid timeSignature values`
  );
  assert(typeof value.keySignature === "string", `${sourceLabel}: keySignature must be a string`);
  assert(Array.isArray(value.variants), `${sourceLabel}: variants must be an array`);

  const seenVariantIds = new Set<string>();
  for (const variant of value.variants) {
    assert(isObject(variant), `${sourceLabel}: variant must be an object`);
    assert(
      typeof variant.id === "string" && ALLOWED_VARIANTS.includes(variant.id as (typeof ALLOWED_VARIANTS)[number]),
      `${sourceLabel}: invalid variant id`
    );
    assert(!seenVariantIds.has(variant.id), `${sourceLabel}: duplicate variant id ${variant.id}`);
    seenVariantIds.add(variant.id);

    assert(typeof variant.label === "string" && variant.label.length > 0, `${sourceLabel}: variant label is required`);
    assert(Array.isArray(variant.measures), `${sourceLabel}: measures must be an array`);
    assert(Array.isArray(variant.noteEvents), `${sourceLabel}: noteEvents must be an array`);
    assert(Array.isArray(variant.chordSegments), `${sourceLabel}: chordSegments must be an array`);

    for (const measure of variant.measures) {
      assert(isObject(measure), `${sourceLabel}: measure must be an object`);
      assert(isFiniteNumber(measure.index) && measure.index >= 0, `${sourceLabel}: invalid measure.index`);
      assert(isFiniteNumber(measure.startTick) && measure.startTick >= 0, `${sourceLabel}: invalid measure.startTick`);
      assert(
        isFiniteNumber(measure.endTick) && measure.endTick > measure.startTick,
        `${sourceLabel}: invalid measure.endTick`
      );
    }

    for (const noteEvent of variant.noteEvents) {
      assert(isObject(noteEvent), `${sourceLabel}: noteEvent must be an object`);
      assert(typeof noteEvent.id === "string" && noteEvent.id.length > 0, `${sourceLabel}: noteEvent.id is required`);
      assert(noteEvent.hand === "left" || noteEvent.hand === "right", `${sourceLabel}: invalid noteEvent.hand`);
      assert(isFiniteNumber(noteEvent.midi), `${sourceLabel}: invalid noteEvent.midi`);
      assert(typeof noteEvent.pitchName === "string", `${sourceLabel}: invalid noteEvent.pitchName`);
      assert(isFiniteNumber(noteEvent.startTick) && noteEvent.startTick >= 0, `${sourceLabel}: invalid noteEvent.startTick`);
      assert(
        isFiniteNumber(noteEvent.durationTick) && noteEvent.durationTick > 0,
        `${sourceLabel}: invalid noteEvent.durationTick`
      );
      assert(
        isFiniteNumber(noteEvent.measureIndex) && noteEvent.measureIndex >= 0,
        `${sourceLabel}: invalid noteEvent.measureIndex`
      );
      assert(
        isFiniteNumber(noteEvent.beatInMeasure) && noteEvent.beatInMeasure > 0,
        `${sourceLabel}: invalid noteEvent.beatInMeasure`
      );
      assert(typeof noteEvent.required === "boolean", `${sourceLabel}: noteEvent.required must be boolean`);
      assert(typeof noteEvent.optional === "boolean", `${sourceLabel}: noteEvent.optional must be boolean`);
    }

    for (const chordSegment of variant.chordSegments) {
      assert(isObject(chordSegment), `${sourceLabel}: chordSegment must be an object`);
      assert(
        isFiniteNumber(chordSegment.measureIndex) && chordSegment.measureIndex >= 0,
        `${sourceLabel}: invalid chordSegment.measureIndex`
      );
      assert(
        isFiniteNumber(chordSegment.startTick) && chordSegment.startTick >= 0,
        `${sourceLabel}: invalid chordSegment.startTick`
      );
      assert(
        isFiniteNumber(chordSegment.endTick) && chordSegment.endTick > chordSegment.startTick,
        `${sourceLabel}: invalid chordSegment.endTick`
      );
      assert(typeof chordSegment.symbol === "string" && chordSegment.symbol.length > 0, `${sourceLabel}: invalid chord symbol`);
    }
  }

  for (const variantId of ALLOWED_VARIANTS) {
    assert(seenVariantIds.has(variantId), `${sourceLabel}: missing variant ${variantId}`);
  }

  return value as SongChart;
}

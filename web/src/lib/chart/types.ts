export type ChartVariantId = "original" | "lv1" | "lv2" | "lv3";

export const CHART_VARIANT_IDS: readonly ChartVariantId[] = ["original", "lv1", "lv2", "lv3"] as const;

export function isChartVariantId(value: string): value is ChartVariantId {
  return CHART_VARIANT_IDS.includes(value as ChartVariantId);
}

export type SongChart = {
  songId: string;
  title: string;
  bpm: number;
  ppq: number;
  timeSignature: [number, number];
  keySignature: string;
  variants: ChartVariant[];
};

export type ChartVariant = {
  id: ChartVariantId;
  label: string;
  measures: Measure[];
  noteEvents: NoteEvent[];
  chordSegments: ChordSegment[];
};

export type Measure = {
  index: number;
  startTick: number;
  endTick: number;
};

export type ChordSegment = {
  measureIndex: number;
  startTick: number;
  endTick: number;
  symbol: string;
  leftHandPattern?: string;
};

export type NoteEvent = {
  id: string;
  hand: "left" | "right";
  midi: number;
  pitchName: string;
  startTick: number;
  durationTick: number;
  measureIndex: number;
  beatInMeasure: number;
  voice?: string;
  required: boolean;
  optional: boolean;
  chordSymbol?: string;
};

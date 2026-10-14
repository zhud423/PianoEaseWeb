import fs from "node:fs/promises";
import path from "node:path";
import manifestRaw from "../content/songs/manifest.json";
import type { ChartVariant, ChordSegment, Measure, NoteEvent, SongChart } from "../src/lib/chart/types";
import { parseSongChart } from "../src/lib/chart/validation";

type SongMeta = {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  durationLabel: string;
  level: "入门" | "进阶" | "挑战";
};

type SongManifest = {
  version: string;
  songs: SongMeta[];
};

type ParsedSourceNote = Omit<NoteEvent, "id" | "required" | "optional">;

type ParsedMusicXml = {
  title: string;
  bpm: number;
  timeSignature: [number, number];
  keySignature: string;
  measures: Measure[];
  chordSegments: ChordSegment[];
  notes: ParsedSourceNote[];
};

const PPQ = 480;
const SONGS_ROOT = path.join(process.cwd(), "content", "songs");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function getTagBlock(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = content.match(regex);
  return match?.[1];
}

function getTagText(content: string, tag: string): string | undefined {
  const block = getTagBlock(content, tag);
  if (!block) return undefined;
  return decodeXmlEntities(block.trim());
}

function getTagNumber(content: string, tag: string): number | undefined {
  const text = getTagText(content, tag);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMeasureBlocks(xml: string): string[] {
  return Array.from(xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g), (match) => match[1]);
}

function pitchStepToSemitone(step: string): number {
  switch (step) {
    case "C":
      return 0;
    case "D":
      return 2;
    case "E":
      return 4;
    case "F":
      return 5;
    case "G":
      return 7;
    case "A":
      return 9;
    case "B":
      return 11;
    default:
      throw new Error(`Unsupported pitch step: ${step}`);
  }
}

function midiToPitchName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[pitchClass]}${octave}`;
}

function parsePitch(noteBlock: string): { midi: number; pitchName: string } | null {
  const pitchBlock = getTagBlock(noteBlock, "pitch");
  if (!pitchBlock) return null;

  const step = getTagText(pitchBlock, "step");
  const octave = getTagNumber(pitchBlock, "octave");
  assert(step && octave !== undefined, "Invalid note pitch block.");

  const alter = getTagNumber(pitchBlock, "alter") ?? 0;
  const midi = (octave + 1) * 12 + pitchStepToSemitone(step) + alter;
  const accidental = alter === 1 ? "#" : alter === -1 ? "b" : "";
  return {
    midi,
    pitchName: `${step}${accidental}${octave}`,
  };
}

function fifthsToKeyName(fifths: number, mode: string): string {
  const majorMap: Record<number, string> = {
    [-7]: "Cb",
    [-6]: "Gb",
    [-5]: "Db",
    [-4]: "Ab",
    [-3]: "Eb",
    [-2]: "Bb",
    [-1]: "F",
    [0]: "C",
    [1]: "G",
    [2]: "D",
    [3]: "A",
    [4]: "E",
    [5]: "B",
    [6]: "F#",
    [7]: "C#",
  };
  const minorMap: Record<number, string> = {
    [-7]: "Ab",
    [-6]: "Eb",
    [-5]: "Bb",
    [-4]: "F",
    [-3]: "C",
    [-2]: "G",
    [-1]: "D",
    [0]: "A",
    [1]: "E",
    [2]: "B",
    [3]: "F#",
    [4]: "C#",
    [5]: "G#",
    [6]: "D#",
    [7]: "A#",
  };
  const map = mode === "minor" ? minorMap : majorMap;
  return map[fifths] ?? (mode === "minor" ? "A" : "C");
}

function parseHarmonySymbol(harmonyBlock: string): string {
  const rootBlock = getTagBlock(harmonyBlock, "root");
  if (!rootBlock) return "N";

  const step = getTagText(rootBlock, "root-step");
  if (!step) return "N";

  const alter = getTagNumber(rootBlock, "root-alter") ?? 0;
  const accidental = alter === 1 ? "#" : alter === -1 ? "b" : "";
  const kindText = getTagText(harmonyBlock, "kind")?.toLowerCase() ?? "";
  const kindAttrMatch = harmonyBlock.match(/<kind\b[^>]*text="([^"]+)"/);
  const kindAttr = kindAttrMatch?.[1]?.toLowerCase() ?? "";
  const kind = kindAttr || kindText;

  let suffix = "";
  if (kind.includes("minor") || kind === "m") suffix = "m";
  if (kind.includes("diminished") || kind === "dim") suffix = "dim";
  if (kind.includes("augmented") || kind === "aug") suffix = "aug";
  if (kind.includes("dominant") || kind === "7") suffix = "7";

  return `${step}${accidental}${suffix}`;
}

function parseMusicXml(xml: string, fallback: SongMeta): ParsedMusicXml {
  const title = getTagText(xml, "movement-title") ?? getTagText(getTagBlock(xml, "work") ?? "", "work-title") ?? fallback.title;
  const tempoMatch = xml.match(/<sound\b[^>]*tempo="([\d.]+)"/);
  const bpm = tempoMatch ? Number(tempoMatch[1]) : fallback.bpm;

  const measureBlocks = getMeasureBlocks(xml);
  assert(measureBlocks.length > 0, `No measures found in ${fallback.id}`);

  let divisions = PPQ;
  let beats = 4;
  let beatType = 4;
  let keyFifths = 0;
  let keyMode = "major";
  let currentTick = 0;

  const measures: Measure[] = [];
  const chordSegments: ChordSegment[] = [];
  const notes: ParsedSourceNote[] = [];

  for (let measureIndex = 0; measureIndex < measureBlocks.length; measureIndex += 1) {
    const measureBlock = measureBlocks[measureIndex];
    const attributes = getTagBlock(measureBlock, "attributes");
    if (attributes) {
      const nextDivisions = getTagNumber(attributes, "divisions");
      if (nextDivisions && nextDivisions > 0) divisions = nextDivisions;

      const timeBlock = getTagBlock(attributes, "time");
      if (timeBlock) {
        const nextBeats = getTagNumber(timeBlock, "beats");
        const nextBeatType = getTagNumber(timeBlock, "beat-type");
        if (nextBeats && nextBeats > 0) beats = nextBeats;
        if (nextBeatType && nextBeatType > 0) beatType = nextBeatType;
      }

      const keyBlock = getTagBlock(attributes, "key");
      if (keyBlock) {
        const nextFifths = getTagNumber(keyBlock, "fifths");
        if (nextFifths !== undefined) keyFifths = nextFifths;
        keyMode = getTagText(keyBlock, "mode")?.toLowerCase() ?? keyMode;
      }
    }

    const ticksPerDivision = PPQ / divisions;
    assert(Number.isFinite(ticksPerDivision) && ticksPerDivision > 0, `Invalid divisions in ${fallback.id}`);

    const measureLength = Math.round((PPQ * 4 * beats) / beatType);
    const measureStart = currentTick;
    const measureEnd = measureStart + measureLength;
    measures.push({ index: measureIndex, startTick: measureStart, endTick: measureEnd });

    let cursorTick = 0;
    let lastNoteStartTick = measureStart;
    const harmonyStarts: Array<{ startTick: number; symbol: string }> = [];
    const tokenPattern =
      /<harmony\b[\s\S]*?<\/harmony>|<backup\b[\s\S]*?<\/backup>|<forward\b[\s\S]*?<\/forward>|<note\b[\s\S]*?<\/note>/g;

    const tokens = Array.from(measureBlock.matchAll(tokenPattern), (match) => match[0]);
    for (const token of tokens) {
      if (token.startsWith("<harmony")) {
        harmonyStarts.push({
          startTick: measureStart + cursorTick,
          symbol: parseHarmonySymbol(token),
        });
        continue;
      }

      if (token.startsWith("<backup")) {
        const durationDiv = getTagNumber(token, "duration") ?? 0;
        const delta = Math.round(durationDiv * ticksPerDivision);
        cursorTick = Math.max(0, cursorTick - delta);
        continue;
      }

      if (token.startsWith("<forward")) {
        const durationDiv = getTagNumber(token, "duration") ?? 0;
        const delta = Math.round(durationDiv * ticksPerDivision);
        cursorTick += delta;
        continue;
      }

      const durationDiv = getTagNumber(token, "duration") ?? 0;
      const durationTick = Math.round(durationDiv * ticksPerDivision);
      const isChordTone = /<chord\s*\/>/.test(token);
      const isRest = /<rest(?:\s*\/>|[\s\S]*?<\/rest>)/.test(token);
      const noteStartTick = isChordTone ? lastNoteStartTick : measureStart + cursorTick;

      if (!isRest && durationTick > 0) {
        const parsedPitch = parsePitch(token);
        if (parsedPitch) {
          const staff = getTagNumber(token, "staff") ?? 1;
          const hand: "left" | "right" = staff === 2 ? "left" : "right";
          const voice = getTagText(token, "voice");
          const beatInMeasure = Number((((noteStartTick - measureStart) / PPQ) + 1).toFixed(3));

          notes.push({
            hand,
            midi: parsedPitch.midi,
            pitchName: parsedPitch.pitchName,
            startTick: noteStartTick,
            durationTick,
            measureIndex,
            beatInMeasure,
            voice,
            chordSymbol: undefined,
          });
        }
      }

      if (!isChordTone) {
        cursorTick += durationTick;
        lastNoteStartTick = noteStartTick;
      }
    }

    const sortedHarmony = harmonyStarts.sort((a, b) => a.startTick - b.startTick);
    if (sortedHarmony.length === 0) {
      chordSegments.push({
        measureIndex,
        startTick: measureStart,
        endTick: measureEnd,
        symbol: "N",
      });
    } else {
      for (let index = 0; index < sortedHarmony.length; index += 1) {
        const current = sortedHarmony[index];
        const next = sortedHarmony[index + 1];
        const segmentStart = Math.max(measureStart, current.startTick);
        const segmentEnd = Math.min(measureEnd, next?.startTick ?? measureEnd);
        if (segmentEnd <= segmentStart) continue;
        chordSegments.push({
          measureIndex,
          startTick: segmentStart,
          endTick: segmentEnd,
          symbol: current.symbol,
        });
      }
    }

    currentTick = measureEnd;
  }

  const segmentsByMeasure = new Map<number, ChordSegment[]>();
  for (const segment of chordSegments) {
    const list = segmentsByMeasure.get(segment.measureIndex) ?? [];
    list.push(segment);
    segmentsByMeasure.set(segment.measureIndex, list);
  }

  for (const note of notes) {
    const segments = segmentsByMeasure.get(note.measureIndex) ?? [];
    const segment = segments.find((candidate) => note.startTick >= candidate.startTick && note.startTick < candidate.endTick);
    note.chordSymbol = segment?.symbol;
  }

  const keyRoot = fifthsToKeyName(keyFifths, keyMode);
  const keySignature = `${keyRoot} ${keyMode === "minor" ? "minor" : "major"}`;

  return {
    title,
    bpm: Number.isFinite(bpm) ? bpm : fallback.bpm,
    timeSignature: [beats, beatType],
    keySignature,
    measures,
    chordSegments,
    notes,
  };
}

function parseChordRootPitchClass(symbol: string): number {
  const match = symbol.match(/^([A-G])([b#]?)/);
  if (!match) return 0;
  const [, step, accidental] = match;
  let pitchClass = pitchStepToSemitone(step);
  if (accidental === "b") pitchClass -= 1;
  if (accidental === "#") pitchClass += 1;
  return (pitchClass + 12) % 12;
}

function chordToneIntervals(symbol: string): [number, number, number] {
  const suffix = symbol.replace(/^[A-G][b#]?/, "").toLowerCase();
  if (suffix.startsWith("dim")) return [0, 3, 6];
  if (suffix.startsWith("aug")) return [0, 4, 8];
  if (suffix.startsWith("m") && !suffix.startsWith("maj")) return [0, 3, 7];
  return [0, 4, 7];
}

function rootMidiFromChord(symbol: string): number {
  const pitchClass = parseChordRootPitchClass(symbol);
  let midi = 48 + pitchClass;
  if (midi > 55) midi -= 12;
  return midi;
}

function createLeftNote(
  measureMap: Map<number, Measure>,
  measureIndex: number,
  startTick: number,
  durationTick: number,
  midi: number,
  chordSymbol: string
): ParsedSourceNote {
  const measure = measureMap.get(measureIndex);
  assert(measure, `Missing measure for index ${measureIndex}`);

  const beatInMeasure = Number((((startTick - measure.startTick) / PPQ) + 1).toFixed(3));
  return {
    hand: "left",
    midi,
    pitchName: midiToPitchName(midi),
    startTick,
    durationTick,
    measureIndex,
    beatInMeasure,
    chordSymbol,
  };
}

function generateLv1Left(measures: Measure[], chordSegments: ChordSegment[]): ParsedSourceNote[] {
  const measureMap = new Map(measures.map((measure) => [measure.index, measure]));
  const events: ParsedSourceNote[] = [];
  for (const segment of chordSegments) {
    const durationTick = segment.endTick - segment.startTick;
    if (durationTick <= 0) continue;
    const midi = rootMidiFromChord(segment.symbol);
    events.push(createLeftNote(measureMap, segment.measureIndex, segment.startTick, durationTick, midi, segment.symbol));
  }
  return events;
}

function generateLv2Left(measures: Measure[], chordSegments: ChordSegment[]): ParsedSourceNote[] {
  const measureMap = new Map(measures.map((measure) => [measure.index, measure]));
  const events: ParsedSourceNote[] = [];
  for (const segment of chordSegments) {
    const length = segment.endTick - segment.startTick;
    if (length <= 0) continue;
    const unit = Math.max(1, Math.floor(length / 2));
    const rootMidi = rootMidiFromChord(segment.symbol);
    const [rootOffset, thirdOffset, fifthOffset] = chordToneIntervals(segment.symbol);
    const tones = [rootMidi + rootOffset, rootMidi + thirdOffset, rootMidi + fifthOffset];

    for (let block = 0; block < 2; block += 1) {
      const blockStart = segment.startTick + block * unit;
      const blockEnd = block === 1 ? segment.endTick : Math.min(segment.endTick, blockStart + unit);
      const durationTick = blockEnd - blockStart;
      if (durationTick <= 0) continue;

      for (const midi of tones) {
        events.push(createLeftNote(measureMap, segment.measureIndex, blockStart, durationTick, midi, segment.symbol));
      }
    }
  }
  return events;
}

function generateLv3Left(measures: Measure[], chordSegments: ChordSegment[]): ParsedSourceNote[] {
  const measureMap = new Map(measures.map((measure) => [measure.index, measure]));
  const events: ParsedSourceNote[] = [];
  const arpeggioPattern = [0, 7, 12, 7, 0, 7, 12, 7];

  for (const segment of chordSegments) {
    const rootMidi = rootMidiFromChord(segment.symbol);
    const length = segment.endTick - segment.startTick;
    if (length <= 0) continue;

    for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) {
      const stepStart = segment.startTick + Math.floor((length * stepIndex) / 8);
      const stepEnd = segment.startTick + Math.floor((length * (stepIndex + 1)) / 8);
      const durationTick = stepEnd - stepStart;
      if (durationTick <= 0) continue;

      events.push(
        createLeftNote(
          measureMap,
          segment.measureIndex,
          stepStart,
          durationTick,
          rootMidi + arpeggioPattern[stepIndex],
          segment.symbol
        )
      );
    }
  }

  return events;
}

function sortNotes(notes: ParsedSourceNote[]): ParsedSourceNote[] {
  return [...notes].sort((a, b) => {
    if (a.startTick !== b.startTick) return a.startTick - b.startTick;
    if (a.hand !== b.hand) return a.hand === "right" ? -1 : 1;
    return a.midi - b.midi;
  });
}

function assignIds(variantId: ChartVariant["id"], notes: ParsedSourceNote[]): NoteEvent[] {
  let rightCounter = 1;
  let leftCounter = 1;
  return notes.map((note) => {
    const handPrefix = note.hand === "right" ? "r" : "l";
    const counter = note.hand === "right" ? rightCounter++ : leftCounter++;
    return {
      ...note,
      id: `${variantId}-${handPrefix}-${counter}`,
      required: true,
      optional: false,
    };
  });
}

function cloneChordSegments(chordSegments: ChordSegment[], leftHandPattern: string): ChordSegment[] {
  return chordSegments.map((segment) => ({
    ...segment,
    leftHandPattern,
  }));
}

function buildVariant(
  id: ChartVariant["id"],
  label: string,
  measures: Measure[],
  chordSegments: ChordSegment[],
  rightHandNotes: ParsedSourceNote[],
  leftHandNotes: ParsedSourceNote[],
  leftHandPattern: string
): ChartVariant {
  const noteEvents = assignIds(id, sortNotes([...rightHandNotes, ...leftHandNotes]));
  return {
    id,
    label,
    measures,
    chordSegments: cloneChordSegments(chordSegments, leftHandPattern),
    noteEvents,
  };
}

function buildChartFromMusicXml(song: SongMeta, parsed: ParsedMusicXml): SongChart {
  const originalNotesSorted = sortNotes(parsed.notes);
  const rightHand = originalNotesSorted.filter((note) => note.hand === "right");
  const originalVariant = buildVariant(
    "original",
    "原谱",
    parsed.measures,
    parsed.chordSegments,
    rightHand,
    originalNotesSorted.filter((note) => note.hand === "left"),
    "rhythm-pads"
  );

  const lv1Variant = buildVariant(
    "lv1",
    "Lv1 根音",
    parsed.measures,
    parsed.chordSegments,
    rightHand,
    generateLv1Left(parsed.measures, parsed.chordSegments),
    "root-whole"
  );

  const lv2Variant = buildVariant(
    "lv2",
    "Lv2 柱式和弦",
    parsed.measures,
    parsed.chordSegments,
    rightHand,
    generateLv2Left(parsed.measures, parsed.chordSegments),
    "block-half"
  );

  const lv3Variant = buildVariant(
    "lv3",
    "Lv3 分解和弦",
    parsed.measures,
    parsed.chordSegments,
    rightHand,
    generateLv3Left(parsed.measures, parsed.chordSegments),
    "arpeggio-8th"
  );

  return {
    songId: song.id,
    title: parsed.title || song.title,
    bpm: parsed.bpm || song.bpm,
    ppq: PPQ,
    timeSignature: parsed.timeSignature,
    keySignature: parsed.keySignature,
    variants: [originalVariant, lv1Variant, lv2Variant, lv3Variant],
  };
}

async function generateForSong(song: SongMeta) {
  const xmlPath = path.join(SONGS_ROOT, song.id, "musicxml", "original.musicxml");
  const chartPath = path.join(SONGS_ROOT, song.id, "chart.v0.json");
  const xmlContent = await fs.readFile(xmlPath, "utf8");
  const parsedMusicXml = parseMusicXml(xmlContent, song);
  const chart = buildChartFromMusicXml(song, parsedMusicXml);
  parseSongChart(chart, `generated:${song.id}`);
  await fs.writeFile(chartPath, `${JSON.stringify(chart, null, 2)}\n`, "utf8");
  console.log(`Generated chart.v0.json for ${song.id}`);
}

function parseManifest(): SongManifest {
  const manifest = manifestRaw as SongManifest;
  assert(Array.isArray(manifest.songs), "Invalid manifest file");
  return manifest;
}

function getSelectedSongIds(): Set<string> {
  const index = process.argv.findIndex((arg) => arg === "--song");
  if (index < 0) return new Set();
  const raw = process.argv[index + 1];
  if (!raw) return new Set();
  return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
}

async function main() {
  const manifest = parseManifest();
  const selectedSongIds = getSelectedSongIds();
  const songs = selectedSongIds.size
    ? manifest.songs.filter((song) => selectedSongIds.has(song.id))
    : manifest.songs;

  assert(songs.length > 0, "No songs selected to generate");
  for (const song of songs) {
    await generateForSong(song);
  }
}

main().catch((error) => {
  console.error("Chart generation failed:", error);
  process.exit(1);
});

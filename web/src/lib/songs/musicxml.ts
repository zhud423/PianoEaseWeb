import fs from "node:fs/promises";
import path from "node:path";

export const MUSICXML_VARIANTS = ["original", "lv1", "lv2", "lv3"] as const;
export type MusicXmlVariant = (typeof MUSICXML_VARIANTS)[number];

const SONG_ID_PATTERN = /^[a-z0-9-]+$/;

type ReadMusicXmlResult = {
  xml: string;
  sourceVariant: MusicXmlVariant;
};

function assertSafeSongId(songId: string) {
  if (!SONG_ID_PATTERN.test(songId)) {
    throw new Error("Invalid song id");
  }
}

function resolveVariant(input: string | null): MusicXmlVariant {
  if (!input) return "original";
  if (MUSICXML_VARIANTS.includes(input as MusicXmlVariant)) {
    return input as MusicXmlVariant;
  }
  return "original";
}

function getVariantPath(songId: string, variant: MusicXmlVariant) {
  return path.join(process.cwd(), "content", "songs", songId, "musicxml", `${variant}.musicxml`);
}

export async function readMusicXmlForVariant(songId: string, requestedVariant: string | null): Promise<ReadMusicXmlResult> {
  assertSafeSongId(songId);
  const variant = resolveVariant(requestedVariant);
  const requestedPath = getVariantPath(songId, variant);
  const xml = await fs.readFile(requestedPath, "utf8");
  return { xml, sourceVariant: variant };
}

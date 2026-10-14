import manifestRaw from "../../../content/songs/manifest.json";

export type Song = {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  durationLabel: string;
  level: "入门" | "进阶" | "挑战";
};

type SongManifest = {
  version: string;
  songs: Song[];
};

function parseSongManifest(value: unknown): SongManifest {
  if (typeof value !== "object" || !value || !Array.isArray((value as SongManifest).songs)) {
    throw new Error("Invalid song manifest structure.");
  }

  const manifest = value as SongManifest;
  for (const song of manifest.songs) {
    if (typeof song.id !== "string" || !song.id) throw new Error("Invalid song id in manifest.");
    if (typeof song.title !== "string" || !song.title) throw new Error("Invalid song title in manifest.");
    if (typeof song.subtitle !== "string") throw new Error("Invalid song subtitle in manifest.");
    if (typeof song.bpm !== "number" || !Number.isFinite(song.bpm) || song.bpm <= 0) {
      throw new Error(`Invalid song bpm in manifest: ${song.id}`);
    }
    if (typeof song.durationLabel !== "string" || !song.durationLabel) {
      throw new Error(`Invalid durationLabel in manifest: ${song.id}`);
    }
    if (!["入门", "进阶", "挑战"].includes(song.level)) {
      throw new Error(`Invalid level in manifest: ${song.id}`);
    }
  }

  return manifest;
}

export const SONGS: Song[] = parseSongManifest(manifestRaw).songs;

export function findSongById(songId: string): Song | undefined {
  return SONGS.find((song) => song.id === songId);
}

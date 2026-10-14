import { CHARTS, findChartBySongId } from "../src/lib/chart/catalog";
import { SONGS } from "../src/lib/songs/catalog";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  assert(CHARTS.length > 0, "No charts loaded.");

  for (const song of SONGS) {
    const chart = findChartBySongId(song.id);
    assert(chart, `Missing chart for song: ${song.id}`);
    assert(chart.songId === song.id, `Chart songId mismatch: ${song.id}`);
    assert(chart.variants.length === 4, `Chart must contain 4 variants: ${song.id}`);

    for (const variant of chart.variants) {
      assert(variant.measures.length > 0, `Variant has no measures: ${song.id}/${variant.id}`);
      for (const noteEvent of variant.noteEvents) {
        assert(noteEvent.durationTick > 0, `Invalid note duration: ${song.id}/${variant.id}/${noteEvent.id}`);
      }
    }
  }

  console.log(`Chart check passed. songs=${SONGS.length}, charts=${CHARTS.length}`);
}

main();

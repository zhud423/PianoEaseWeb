import cityInTheSkyChartRaw from "../../../content/songs/city-in-the-sky/chart.v0.json";
import friendshipYearsChartRaw from "../../../content/songs/friendship-years/chart.v0.json";
import riverFlowsChartRaw from "../../../content/songs/river-flows/chart.v0.json";
import type { SongChart } from "./types";
import { parseSongChart } from "./validation";

const rawCharts = [friendshipYearsChartRaw, cityInTheSkyChartRaw, riverFlowsChartRaw] as const;

export const CHARTS: SongChart[] = rawCharts.map((chart, index) =>
  parseSongChart(chart, `content/songs/chart[${index}]`)
);

const chartsBySongId = new Map(CHARTS.map((chart) => [chart.songId, chart]));

export function findChartBySongId(songId: string): SongChart | undefined {
  return chartsBySongId.get(songId);
}

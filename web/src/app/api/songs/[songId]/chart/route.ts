import { NextResponse } from "next/server";
import { findSongById } from "@/lib/songs/catalog";
import { findChartBySongId } from "@/lib/chart/catalog";

export const runtime = "nodejs";

type SongChartRouteProps = {
  params: Promise<{ songId: string }>;
};

export async function GET(_request: Request, { params }: SongChartRouteProps) {
  const { songId } = await params;
  const song = findSongById(songId);
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const chart = findChartBySongId(songId);
  if (!chart) {
    return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  }

  return NextResponse.json({
    song,
    chart,
  });
}

import { NextResponse } from "next/server";
import { findSongById } from "@/lib/songs/catalog";
import { readMusicXmlForVariant } from "@/lib/songs/musicxml";

export const runtime = "nodejs";

type SongMusicXmlRouteProps = {
  params: Promise<{ songId: string }>;
};

export async function GET(request: Request, { params }: SongMusicXmlRouteProps) {
  const { songId } = await params;
  const song = findSongById(songId);
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");

  try {
    const result = await readMusicXmlForVariant(songId, variant);
    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.recordare.musicxml+xml; charset=utf-8",
        "X-PianoEase-MusicXml-Variant": result.sourceVariant,
      },
    });
  } catch {
    return NextResponse.json({ error: "MusicXML not found" }, { status: 404 });
  }
}

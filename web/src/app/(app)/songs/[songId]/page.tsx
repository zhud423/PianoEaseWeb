import Link from "next/link";
import { notFound } from "next/navigation";
import { findSongById } from "@/lib/songs/catalog";
import { findChartBySongId } from "@/lib/chart/catalog";
import { ScoreWorkbench } from "@/components/sheet/score-workbench";

type SongDetailPageProps = {
  params: Promise<{ songId: string }>;
};

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { songId } = await params;
  const song = findSongById(songId);
  if (!song) notFound();
  const chart = findChartBySongId(songId);
  if (!chart) notFound();

  return (
    <main className="space-y-6">
      <div>
        <Link
          href="/"
          aria-label="返回曲库"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
          title="返回曲库"
        >
          ←
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">曲目准备</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{song.title}</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {song.subtitle} · BPM {song.bpm} · {song.durationLabel}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/practice/${song.id}`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              开始练习
            </Link>
            <Link
              href={`/report/${song.id}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
            >
              单曲复盘
            </Link>
          </div>
        </div>
      </section>

      <ScoreWorkbench songId={song.id} chart={chart} defaultVariantId="lv1" defaultNotation="number" />
    </main>
  );
}

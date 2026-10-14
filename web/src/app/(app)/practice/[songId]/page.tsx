import Link from "next/link";
import { notFound } from "next/navigation";
import { findSongById } from "@/lib/songs/catalog";
import { findChartBySongId } from "@/lib/chart/catalog";
import { isChartVariantId } from "@/lib/chart/types";
import { PracticeStage } from "@/components/practice/practice-stage";

type PracticePageProps = {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ variant?: string }>;
};

export default async function PracticePage({ params, searchParams }: PracticePageProps) {
  const { songId } = await params;
  const { variant } = await searchParams;
  const song = findSongById(songId);
  if (!song) notFound();
  const chart = findChartBySongId(songId);
  if (!chart) notFound();
  const initialVariantId = variant && isChartVariantId(variant) ? variant : "lv1";

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Practice Session</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{song.title}</h1>
          </div>
          <span className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700">
            00:00 / {song.durationLabel}
          </span>
        </div>
      </section>

      <PracticeStage songId={song.id} chart={chart} initialVariantId={initialVariantId} />

      <section className="flex gap-3">
        <Link
          href={`/report/${song.id}`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          查看练习报告
        </Link>
        <Link href={`/songs/${song.id}`} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          回到准备页
        </Link>
      </section>
    </main>
  );
}

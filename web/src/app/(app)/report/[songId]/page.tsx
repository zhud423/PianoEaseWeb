import Link from "next/link";
import { notFound } from "next/navigation";
import { findSongById } from "@/lib/songs/catalog";
import { requireCurrentUser } from "@/lib/auth/user";
import { getLatestPracticeSession } from "@/db/repositories/practice";
import { findChartBySongId } from "@/lib/chart/catalog";
import type { ChartVariantId } from "@/lib/chart/types";
import { buildReportSummary } from "@/lib/practice/report-summary";

type ReportPageProps = {
  params: Promise<{ songId: string }>;
};

const VARIANT_LABELS: Record<ChartVariantId, string> = {
  original: "原谱",
  lv1: "Lv1",
  lv2: "Lv2",
  lv3: "Lv3",
};

function buildStars(score: number): string {
  const starCount = Math.max(0, Math.min(5, Math.round(score / 200)));
  return `${"★".repeat(starCount)}${"☆".repeat(5 - starCount)}`;
}

function getNextVariant(currentVariant: ChartVariantId, availableVariants: ChartVariantId[]): ChartVariantId {
  if (availableVariants.length === 0) return "lv1";
  const currentIndex = availableVariants.indexOf(currentVariant);
  if (currentIndex < 0) return availableVariants[0];
  return availableVariants[(currentIndex + 1) % availableVariants.length];
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { songId } = await params;
  const song = findSongById(songId);
  if (!song) notFound();
  const chart = findChartBySongId(songId);
  if (!chart) notFound();

  const user = await requireCurrentUser();

  let latestSession: Awaited<ReturnType<typeof getLatestPracticeSession>> | null = null;
  let dbUnavailable = false;
  try {
    latestSession = await getLatestPracticeSession(user.id, song.id);
  } catch {
    dbUnavailable = true;
  }

  const availablePracticeVariants = chart.variants
    .map((variant) => variant.id)
    .filter((variantId): variantId is ChartVariantId => variantId === "lv1" || variantId === "lv2" || variantId === "lv3");
  const currentVariant = latestSession?.variant ?? availablePracticeVariants[0] ?? "lv1";
  const nextVariant = getNextVariant(currentVariant, availablePracticeVariants);
  const activeVariant =
    chart.variants.find((variant) => variant.id === currentVariant) ??
    chart.variants.find((variant) => variant.id === "lv1") ??
    chart.variants[0];
  const fallbackMeasureCount = activeVariant?.measures.length ?? 8;

  const reportScore = latestSession?.score ?? 0;
  const reportStars = buildStars(reportScore);
  const rightAccuracy =
    typeof latestSession?.rightAccuracyPct === "number" ? `${latestSession.rightAccuracyPct}%` : "暂无准确率数据";
  const leftAccuracy =
    typeof latestSession?.leftAccuracyPct === "number" ? `${latestSession.leftAccuracyPct}%` : "暂无准确率数据";
  const midiEventCount = latestSession?.midiEventCount ?? 0;
  const noteOnCount = latestSession?.noteOnCount ?? 0;
  const noteOffCount = latestSession?.noteOffCount ?? 0;
  const startedAt = latestSession?.startedAt ? new Date(latestSession.startedAt).toLocaleString("zh-CN") : "暂无记录";
  const measureStats = latestSession?.measureStats ?? [];
  const { heatValues, maxMissValue, rhythmLabel, weakBarLabel } = buildReportSummary({
    measureStats,
    measureCount: fallbackMeasureCount,
  });

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Practice Report</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{song.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {latestSession
            ? "单曲复盘（二级页面）：当前显示最近一次真实练习会话数据。"
            : "单曲复盘（二级页面）：当前暂无真实会话，请先完成一轮练习并保存。"}
        </p>
        {dbUnavailable ? (
          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
            数据库暂不可用，当前仅显示默认空值。
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">总分</p>
          <p className="mt-2 text-3xl font-semibold">{reportScore}</p>
          <p className="mt-1 text-sm text-zinc-600">{reportStars}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">右手准确率</p>
          <p className="mt-2 text-2xl font-semibold">{rightAccuracy}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">左手准确率</p>
          <p className="mt-2 text-2xl font-semibold">{leftAccuracy}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">节奏评价</p>
          <p className="mt-2 text-xl font-semibold">{rhythmLabel}</p>
          <p className="mt-1 text-sm text-zinc-600">薄弱点：{weakBarLabel}</p>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">会话开始时间</p>
          <p className="mt-2 text-sm font-medium">{startedAt}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">MIDI 总事件</p>
          <p className="mt-2 text-3xl font-semibold">{midiEventCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">Note On</p>
          <p className="mt-2 text-3xl font-semibold">{noteOnCount}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">Note Off</p>
          <p className="mt-2 text-3xl font-semibold">{noteOffCount}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">错音热力图</h2>
          <p className="text-sm text-zinc-600">当前难度：{VARIANT_LABELS[currentVariant]}</p>
        </div>
        <div className="mt-4 grid grid-cols-8 gap-2">
          {heatValues.map((value, index) => (
            <div
              key={index}
              className="h-14 rounded-md"
              style={{ backgroundColor: `rgba(190, 24, 93, ${0.15 + (value / maxMissValue) * 0.75})` }}
              title={`小节 ${index + 1} · Miss ${value}`}
            />
          ))}
        </div>
      </section>

      <section className="flex gap-3">
        <Link href="/report" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          回到总报告
        </Link>
        <Link
          href={`/practice/${song.id}?variant=${currentVariant}`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          再练一次（当前难度）
        </Link>
        <Link
          href={`/practice/${song.id}?variant=${nextVariant}`}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          换难度（{VARIANT_LABELS[currentVariant]} → {VARIANT_LABELS[nextVariant]}）
        </Link>
        <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          回到曲库
        </Link>
      </section>
    </main>
  );
}

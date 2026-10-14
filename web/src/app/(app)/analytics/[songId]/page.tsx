import Link from "next/link";
import { notFound } from "next/navigation";
import { findSongById } from "@/lib/songs/catalog";
import { requireCurrentUser } from "@/lib/auth/user";
import { getPracticeSongAnalyticsDashboard } from "@/db/repositories/practice";

type SongAnalyticsPageProps = {
  params: Promise<{ songId: string }>;
  searchParams: Promise<{ window?: string }>;
};

const VARIANT_LABELS: Record<"original" | "lv1" | "lv2" | "lv3", string> = {
  original: "原谱",
  lv1: "Lv1",
  lv2: "Lv2",
  lv3: "Lv3",
};

function resolveWindowDays(value: string | undefined): 7 | 30 {
  return value === "30" ? 30 : 7;
}

function directionLabel(direction: "start" | "up" | "down" | "same"): string {
  switch (direction) {
    case "up":
      return "升难度";
    case "down":
      return "降难度";
    case "same":
      return "同难度";
    default:
      return "开始";
  }
}

export default async function SongAnalyticsPage({ params, searchParams }: SongAnalyticsPageProps) {
  const { songId } = await params;
  const { window } = await searchParams;
  const song = findSongById(songId);
  if (!song) notFound();

  const windowDays = resolveWindowDays(window);
  const user = await requireCurrentUser();
  let analytics: Awaited<ReturnType<typeof getPracticeSongAnalyticsDashboard>> | null = null;
  let analyticsUnavailable = false;
  try {
    analytics = await getPracticeSongAnalyticsDashboard(user.id, song.id, windowDays);
  } catch {
    analyticsUnavailable = true;
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Song Analytics</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{song.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{song.subtitle}</p>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/analytics/${song.id}?window=7`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              windowDays === 7 ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            近 7 天
          </Link>
          <Link
            href={`/analytics/${song.id}?window=30`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              windowDays === 30 ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            近 30 天
          </Link>
        </div>
        {analyticsUnavailable ? (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">指标暂不可用（数据库连接异常）。</p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">会话数</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.sessionCount ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">完曲率（完成度≥90%）</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.completionRatePct ?? 0}%</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">平均分</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.avgScore ?? 0}</p>
          <p className="mt-1 text-sm text-zinc-600">跟谱占比 {analytics?.followModeRatePct ?? 0}%</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">难度升级率</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.difficultyUpgradeRatePct ?? 0}%</p>
          <p className="mt-1 text-sm text-zinc-600">
            升级切换 {analytics?.upgradedSwitches ?? 0} / {analytics?.totalSwitches ?? 0}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">按难度分布（{windowDays}天）</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(analytics?.variantBreakdown ?? []).map((item) => (
              <div key={item.variant} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-900">{VARIANT_LABELS[item.variant]}</p>
                <p className="mt-1 text-zinc-600">会话 {item.sessionCount} · 完曲率 {item.completionRatePct}%</p>
                <p className="mt-1 text-zinc-600">平均分 {item.avgScore} · 跟谱占比 {item.followModeRatePct}%</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">日趋势（{windowDays}天）</h2>
          <div className="mt-4 grid grid-cols-7 gap-2 md:grid-cols-10 lg:grid-cols-12">
            {(analytics?.dailyTrend ?? []).map((item) => (
              <div
                key={item.dateKey}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-center"
                title={`${item.dateKey} · 会话 ${item.sessionCount} · 完曲率 ${item.completionRatePct}% · 平均分 ${item.avgScore}`}
              >
                <p className="text-[10px] text-zinc-500">{item.dateKey.slice(5)}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{item.sessionCount}</p>
                <p className="text-[10px] text-zinc-600">{item.completionRatePct}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">难度升级路径（{windowDays}天）</h2>
        <div className="mt-3 space-y-2">
          {(analytics?.switchEvents ?? []).map((item, index) => (
            <div key={`${item.at.toISOString()}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
              <p className="font-medium text-zinc-900">
                {new Date(item.at).toLocaleString("zh-CN")} · {directionLabel(item.direction)}
              </p>
              <p className="mt-1 text-zinc-600">
                {item.fromVariant ? `${VARIANT_LABELS[item.fromVariant]} → ` : ""}
                {VARIANT_LABELS[item.toVariant]} · 分数 {item.score} · 完成度 {item.completionPct ?? 0}% ·
                {item.mode === "follow" ? " 跟谱" : " 音游"}
              </p>
            </div>
          ))}
          {(analytics?.switchEvents ?? []).length === 0 ? <p className="text-sm text-zinc-500">暂无会话路径数据。</p> : null}
        </div>
      </section>

      <section className="flex gap-3">
        <Link
          href={`/practice/${song.id}`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          去练习
        </Link>
        <Link href={`/report/${song.id}`} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          查看报告
        </Link>
        <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100">
          返回首页
        </Link>
      </section>
    </main>
  );
}

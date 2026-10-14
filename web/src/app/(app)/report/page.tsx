import Link from "next/link";
import { findSongById } from "@/lib/songs/catalog";
import { requireCurrentUser } from "@/lib/auth/user";
import { getPracticeAnalyticsDashboard } from "@/db/repositories/practice";

type ReportHomePageProps = {
  searchParams: Promise<{ window?: string }>;
};

function resolveWindowDays(value: string | undefined): 7 | 30 {
  return value === "30" ? 30 : 7;
}

const VARIANT_LABELS: Record<"original" | "lv1" | "lv2" | "lv3", string> = {
  original: "原谱",
  lv1: "Lv1",
  lv2: "Lv2",
  lv3: "Lv3",
};

export default async function ReportHomePage({ searchParams }: ReportHomePageProps) {
  const { window } = await searchParams;
  const windowDays = resolveWindowDays(window);
  const user = await requireCurrentUser();

  let analytics: Awaited<ReturnType<typeof getPracticeAnalyticsDashboard>> | null = null;
  let analyticsUnavailable = false;
  try {
    analytics = await getPracticeAnalyticsDashboard(user.id, windowDays);
  } catch {
    analyticsUnavailable = true;
  }

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Practice Reports</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">练习报告总览</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          这里展示整体练习趋势。每首歌可进入单曲复盘页，查看最近一次会话的详细报告。
        </p>
        {analyticsUnavailable ? (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
            练习指标暂不可用（数据库连接异常）。
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Link
            href="/report?window=7"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              windowDays === 7 ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            近 7 天
          </Link>
          <Link
            href="/report?window=30"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              windowDays === 30 ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            近 30 天
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">已完成会话</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.summary.sessionCount ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">完曲率（完成度≥90%）</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.summary.completionRatePct ?? 0}%</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">练习偏好</p>
          <p className="mt-2 text-xl font-semibold">
            {(analytics?.summary.modePreference ?? "game") === "follow" ? "跟谱模式" : "音游模式"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">跟谱占比 {analytics?.summary.followModeRatePct ?? 0}%</p>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500">难度升级率</p>
          <p className="mt-2 text-3xl font-semibold">{analytics?.summary.difficultyUpgradeRatePct ?? 0}%</p>
          <p className="mt-1 text-sm text-zinc-600">
            升级切换 {analytics?.summary.upgradedSwitches ?? 0} / {analytics?.summary.totalSwitches ?? 0}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">按曲目趋势（{windowDays}天）</h2>
          <div className="mt-3 space-y-2">
            {(analytics?.bySong ?? []).slice(0, 8).map((item) => {
              const song = findSongById(item.songId);
              return (
                <Link
                  key={item.songId}
                  href={`/report/${item.songId}`}
                  className="block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition hover:border-zinc-300 hover:bg-zinc-100"
                >
                  <p className="font-medium text-zinc-900">{song?.title ?? item.songId}</p>
                  <p className="mt-1 text-zinc-600">
                    会话 {item.sessionCount} · 完曲率 {item.completionRatePct}% · 平均分 {item.avgScore} · 主练{" "}
                    {VARIANT_LABELS[item.dominantVariant]}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">进入单曲复盘</p>
                </Link>
              );
            })}
            {(analytics?.bySong ?? []).length === 0 ? <p className="text-sm text-zinc-500">暂无练习数据。</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">按难度趋势（{windowDays}天）</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(analytics?.byVariant ?? []).map((item) => (
              <div key={item.variant} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-900">{VARIANT_LABELS[item.variant]}</p>
                <p className="mt-1 text-zinc-600">会话 {item.sessionCount} · 完曲率 {item.completionRatePct}%</p>
                <p className="mt-1 text-zinc-600">平均分 {item.avgScore} · 跟谱占比 {item.followModeRatePct}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
      </section>
    </main>
  );
}

import Link from "next/link";
import { SONGS } from "@/lib/songs/catalog";

const levelColors: Record<(typeof SONGS)[number]["level"], string> = {
  入门: "bg-emerald-100 text-emerald-700",
  进阶: "bg-amber-100 text-amber-700",
  挑战: "bg-rose-100 text-rose-700",
};

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").trim();
}

function includesIgnoreCase(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q } = await searchParams;
  const query = normalizeQuery(q);
  const songs = query
    ? SONGS.filter((song) =>
        [song.title, song.subtitle, song.id].some((field) => includesIgnoreCase(field, query))
      )
    : SONGS;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80">PianoEase Library</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">分级简化曲库</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          当前默认首页仅保留曲库入口。选择曲目后进入分级简化练习，并可查看该曲的单曲练习复盘。
        </p>

        <form method="get" className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="搜索曲名 / 副标题 / song id"
            className="h-12 w-full rounded-lg border border-zinc-300 px-4 text-sm text-zinc-800 outline-none ring-emerald-300/60 placeholder:text-zinc-400 focus:ring-2"
          />
          <div className="flex shrink-0 items-stretch gap-2">
            <button
              type="submit"
              className="inline-flex min-w-20 items-center justify-center whitespace-nowrap rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              搜索
            </button>
            {query ? (
              <Link
                href="/"
                className="inline-flex min-w-20 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-300 px-5 text-sm hover:bg-zinc-100"
              >
                清空
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {songs.map((song) => (
          <article
            key={song.id}
            className="group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  <Link href={`/songs/${song.id}`} className="focus:outline-none">
                    <span className="absolute inset-0 rounded-2xl" aria-hidden="true" />
                    {song.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{song.subtitle}</p>
              </div>
              <span className={`relative z-10 rounded-full px-2.5 py-1 text-xs font-medium ${levelColors[song.level]}`}>
                {song.level}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-zinc-600">
              <div>
                <dt>BPM</dt>
                <dd className="font-medium text-zinc-900">{song.bpm}</dd>
              </div>
              <div>
                <dt>时长</dt>
                <dd className="font-medium text-zinc-900">{song.durationLabel}</dd>
              </div>
            </dl>

            <div className="relative z-10 mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/songs/${song.id}`}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                曲谱
              </Link>
              <Link href={`/practice/${song.id}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-600">
                开始练习
              </Link>
              <Link href={`/report/${song.id}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-600">
                单曲复盘
              </Link>
            </div>
          </article>
        ))}
      </section>

      {songs.length === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm">
          没有匹配到曲目，请尝试其他关键词。
        </section>
      ) : null}
    </main>
  );
}

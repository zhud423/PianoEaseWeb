import { getCurrentUser } from "@/lib/auth/user";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const hasError = params.error === "invalid_credentials";
  const sessionUnavailable = params.error === "session_unavailable";

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_10%_20%,#1f4f46_0%,#0f1d1b_40%,#0a0f0e_100%)] p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/15 bg-[#12211f]/80 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">PianoEase</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">测试登录</h1>
        <p className="mt-2 text-sm text-emerald-100/75">使用测试账号登录，进入 Web MVP 练习流程。</p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-2 block text-sm text-emerald-50">用户名</span>
            <input
              type="text"
              name="username"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-300/50 placeholder:text-emerald-100/40 focus:ring-2"
              placeholder="admin"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-emerald-50">密码</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-300/50 placeholder:text-emerald-100/40 focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          {hasError ? (
            <p className="rounded-lg border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              用户名或密码错误。
            </p>
          ) : null}
          {sessionUnavailable ? (
            <p className="rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              登录会话创建失败，请确认本地数据库可用后重试。
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            登录并开始练习
          </button>
        </form>
      </section>
    </main>
  );
}

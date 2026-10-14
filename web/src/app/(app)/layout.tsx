import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth/user";
import { MidiStatusIndicator } from "@/components/midi/midi-status-indicator";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireCurrentUser();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3f6f4_0%,#eef3f1_50%,#e7eeeb_100%)] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-900">
              PianoEase
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <MidiStatusIndicator />
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              {user.username}
            </span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100"
              >
                退出
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}

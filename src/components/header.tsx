import Image from "next/image";
import Link from "next/link";
import type { Session } from "next-auth";
import { AuthButton } from "@/components/auth-button";

export function SiteHeader({ session }: { session: Session | null }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
      <Link
        href="/"
        className="flex items-center gap-3 text-lg font-semibold tracking-[0.3em] uppercase"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-glow shadow-lg shadow-brand/50">
          W
        </span>
        Watchd
      </Link>
      <div className="flex items-center gap-4">
        {session?.user?.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "Profile"}
            width={40}
            height={40}
            className="rounded-2xl border border-white/10"
          />
        ) : session?.user?.name ? (
          <span className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-white/80">
            {session.user.name}
          </span>
        ) : null}
        <AuthButton isAuthenticated={Boolean(session?.user)} />
      </div>
    </header>
  );
}

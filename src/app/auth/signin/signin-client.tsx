"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

const EMAIL_COOKIE = "watchd_login_email";

function setEmailCookie(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return;
  document.cookie = `${EMAIL_COOKIE}=${encodeURIComponent(
    trimmed
  )}; path=/; max-age=604800; samesite=lax`;
}

function clearEmailCookie() {
  document.cookie = `${EMAIL_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function AuthSignInClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const callbackUrl = useMemo(() => {
    return searchParams?.get("callbackUrl") ?? "/";
  }, [searchParams]);

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter an email to continue.");
      return;
    }

    setError(null);
    setEmailCookie(trimmed);
    startTransition(() => {
      void signIn("email", { email: trimmed, callbackUrl });
    });
  }

  function handleGoogle() {
    clearEmailCookie();
    void signIn("google", { callbackUrl, prompt: "select_account" });
  }

  return (
    <div className="min-h-screen bg-night pb-24 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-16">
        <header className="flex items-center gap-3 text-lg font-semibold tracking-[0.3em] uppercase">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xl font-black leading-none text-glow shadow-lg shadow-brand/50 translate-y-[1px] translate-x-[0.5px]"
            aria-label="Back to home"
          >
            W
          </Link>
          Watchd
        </header>

        <section className="space-y-6 rounded-lg border border-white/10 bg-night/60 p-8 shadow-2xl shadow-black/40">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Sign in
            </p>
            <h1 className="text-4xl font-semibold">Welcome back</h1>
            <p className="text-sm text-white/70">
              Use a magic link or continue with Google.
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.35em] text-white/50">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/40"
                disabled={isPending}
                required
              />
            </label>
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {isPending ? "Sending..." : "Email me a magic link"}
            </button>
          </form>

          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            Or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:bg-white/20"
          >
            Continue with Google
          </button>
        </section>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

type SharedWatchlistHeroProps = {
  signedIn: boolean;
  initiallyDismissed: boolean;
};

export function SharedWatchlistHero({
  signedIn,
  initiallyDismissed,
}: SharedWatchlistHeroProps) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    if (!signedIn) {
      setDismissed(true);
      return;
    }

    startTransition(() => {
      setError(null);
      void (async () => {
        try {
          const response = await fetch("/api/user/hero-dismiss", {
            method: "POST",
          });

          if (!response.ok) {
            throw new Error("Failed to dismiss hero");
          }

          setDismissed(true);
        } catch (err) {
          console.error(err);
          setError("Could not hide this right now. Try again in a bit.");
        }
      })();
    });
  };

  return (
    <section className="space-y-6 rounded-3xl border border-white/5 bg-midnight/60 p-8 text-white shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.5em] text-white/60">
            Shared watchlist
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight">
              Watch party signal for the people you trust most.
            </h1>
            <p className="max-w-2xl text-lg text-white/70">
              Watchd keeps a living feed of movies and shows your inner circle
              swears by. Compare notes, save precious time, and never
              doom-scroll for something to watch again.
            </p>
          </div>
        </div>
        {signedIn ? (
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Dismiss hero"
          >
            {isPending ? "Hiding..." : "Dismiss"}
          </button>
        ) : null}
      </div>
      {!signedIn ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          Sign in with Google to start logging your queue and invite your crew.
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}

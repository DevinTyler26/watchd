"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface RemoveEntryButtonProps {
  imdbId: string;
  groupId: string | null;
  title: string;
}

export function RemoveEntryButton({
  imdbId,
  groupId,
  title,
}: RemoveEntryButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    setConfirming(true);
  };

  const deleteEntry = async () => {
    const response = await fetch("/api/watchlist", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imdbId, groupId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : "Could not remove entry.";
      // keep simple alert to bubble error without extra UI surface
      alert(message);
      return;
    }

    setConfirming(false);
    router.refresh();
  };

  const confirmRemove = () => {
    startTransition(() => {
      void deleteEntry();
    });
  };

  const label = isPending ? "Removing..." : "Remove entry";

  return (
    <>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="rounded border border-rose-500 px-3 py-1 text-sm font-medium text-rose-500 transition hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={`Remove ${title}`}
      >
        {label}
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-night/90 p-6 text-white shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-rose-300">
              Heads up
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Remove this entry?</h3>
            <p className="mt-3 text-sm text-white/70">
              {title} will disappear from this signal feed. You can always add
              it again later.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={isPending}
                className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden
                    />
                    Removing...
                  </span>
                ) : (
                  "Yes, remove"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface RemoveEntryButtonProps {
  imdbId: string;
  mediaType: "movie" | "series";
  groupId: string | null;
  title: string;
  variant?: "danger" | "ghost";
  size?: "sm" | "md";
  iconOnly?: boolean;
  onRemoveStart?: () => void;
  onRemoveSuccess?: () => void;
  onRemoveError?: () => void;
  refreshDelayMs?: number;
}

export function RemoveEntryButton({
  imdbId,
  mediaType,
  groupId,
  title,
  variant = "danger",
  size = "md",
  iconOnly = false,
  onRemoveStart,
  onRemoveSuccess,
  onRemoveError,
  refreshDelayMs = 0,
}: RemoveEntryButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let target = document.getElementById("modal-root");
    if (!target) {
      target = document.createElement("div");
      target.id = "modal-root";
      document.body.appendChild(target);
    }
    setPortalTarget(target);
  }, []);

  const handleRemove = () => {
    setConfirming(true);
  };

  const deleteEntry = async () => {
    try {
      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imdbId, type: mediaType, groupId }),
      });

      if (!response.ok) {
        onRemoveError?.();
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
      if (refreshDelayMs > 0) {
        window.setTimeout(() => router.refresh(), refreshDelayMs);
      } else {
        router.refresh();
      }
      onRemoveSuccess?.();
    } catch {
      onRemoveError?.();
      alert("Could not remove entry.");
    }
  };

  const confirmRemove = () => {
    startTransition(() => {
      onRemoveStart?.();
      void deleteEntry();
    });
  };

  const label = isPending ? "Removing..." : "Remove entry";
  const sizeClasses =
    size === "sm"
      ? "px-3 py-1 text-[11px] uppercase tracking-[0.24em]"
      : "px-3 py-1 text-sm font-medium";
  const toneClasses =
    variant === "ghost"
      ? "border-white/15 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white"
      : "border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white";

  return (
    <>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className={
          iconOnly
            ? "inline-flex items-center text-white/60 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
            : `rounded border transition ${sizeClasses} ${toneClasses} disabled:cursor-not-allowed disabled:opacity-70`
        }
        aria-label={`Remove ${title}`}
      >
        {iconOnly ? (
          isPending ? (
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
            </svg>
          )
        ) : (
          label
        )}
      </button>

      {confirming && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-6 py-8">
              <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-night/90 p-6 text-white shadow-2xl shadow-black/40">
                <p className="text-xs uppercase tracking-[0.4em] text-rose-300">
                  Heads up
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  Remove this entry?
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  {title} will disappear from this signal feed. You can always
                  add it again later.
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
            </div>,
            portalTarget
          )
        : null}
    </>
  );
}

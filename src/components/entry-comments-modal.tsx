"use client";

import { useEffect, useState } from "react";
import { EntryComments } from "@/components/entry-comments";

type EntryCommentsModalProps = {
  entryId: string;
  canComment: boolean;
  currentUserId?: string | null;
  title: string;
};

export function EntryCommentsModal({
  entryId,
  canComment,
  currentUserId,
  title,
}: EntryCommentsModalProps) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const response = await fetch(`/api/watchlist/${entryId}/comments`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!cancelled) {
          setCount(Array.isArray(payload.comments) ? payload.comments.length : 0);
        }
      } catch {
        if (!cancelled) setCount(0);
      }
    }
    void loadCount();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("keydown", onKeydown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"
      >
        <span className="sr-only">Comments</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
        </svg>
        <span className="text-xs font-mono text-white/60">{count}</span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-night/90 p-6 text-white shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Comments
                </p>
                <p className="mt-2 text-2xl font-semibold">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/40 transition hover:text-white"
              >
                <span className="sr-only">Close</span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4">
              <EntryComments
                entryId={entryId}
                canComment={canComment}
                currentUserId={currentUserId}
                onCountChange={setCount}
                hideHeader
                containerClassName="space-y-2 bg-transparent p-0"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

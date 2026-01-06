"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EntryShareMenu } from "@/components/entry-share-menu";

type EntryShareModalProps = {
  imdbId: string;
  mediaType: "movie" | "series";
  note?: string | null;
  groups: Array<{ id: string | null; name: string }>;
  sharedGroups?: Array<{ id: string; name: string }>;
};

export function EntryShareModal({
  imdbId,
  mediaType,
  note,
  groups,
  sharedGroups = [],
}: EntryShareModalProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <span className="sr-only">Share</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M22 2 11 13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m22 2-7 20-4-9-9-4Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-xs font-mono text-white/60">
          {sharedGroups.length}
        </span>
      </button>
      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-6 py-8 backdrop-blur"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-night/90 p-6 text-white shadow-2xl shadow-black/40">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                      Share
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      Share to circle
                    </p>
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
                  <EntryShareMenu
                    imdbId={imdbId}
                    mediaType={mediaType}
                    note={note}
                    groups={groups}
                    sharedGroups={sharedGroups}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

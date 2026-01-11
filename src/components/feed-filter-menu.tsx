"use client";

import { useEffect, useState } from "react";
import { FeedFilterBar } from "@/components/feed-filter-bar";
import { FeedSortControls } from "@/components/feed-sort-controls";

type SortMode = "recent" | "likes";
type MediaFilter = "all" | "movie" | "tv";

type FeedFilterMenuProps = {
  activeType: MediaFilter;
  activeGenre: string;
  genres: string[];
  activeSort: SortMode;
};

export function FeedFilterMenu({
  activeType,
  activeGenre,
  genres,
  activeSort,
}: FeedFilterMenuProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isMounted) return;
    const id = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [isMounted]);

  const handleClose = () => {
    setIsVisible(false);
    window.setTimeout(() => {
      setIsMounted(false);
    }, 300);
  };

  return (
    <>
      <div className="hidden flex-wrap items-center gap-3 sm:flex">
        <FeedFilterBar
          activeType={activeType}
          activeGenre={activeGenre}
          genres={genres}
        />
        <FeedSortControls activeSort={activeSort} />
      </div>
      <div className="flex items-center sm:hidden">
        <button
          type="button"
          onClick={() => {
            setIsMounted(true);
            setIsVisible(false);
          }}
          className="inline-flex h-9 w-9 items-center justify-center text-white/70 transition hover:text-white"
          aria-label="Open filters"
        >
          <span aria-hidden className="flex flex-col gap-1">
            <span className="h-[2px] w-5 rounded-full bg-white/70" />
            <span className="h-[2px] w-5 rounded-full bg-white/70" />
            <span className="h-[2px] w-5 rounded-full bg-white/70" />
          </span>
        </button>
      </div>
      {isMounted ? (
        <div
          className={`fixed inset-0 z-[1200] flex items-end justify-center px-4 pb-6 pt-10 transition-opacity duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={handleClose}
            aria-hidden
          />
          <div
            className={`relative z-[1] w-full max-w-md rounded-lg border border-white/10 bg-night/95 p-5 text-white shadow-2xl shadow-black/40 transition-transform transition-opacity duration-300 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Feed filters
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs uppercase tracking-[0.3em] text-white/40"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-5">
              <FeedFilterBar
                activeType={activeType}
                activeGenre={activeGenre}
                genres={genres}
                variant="sheet"
              />
              <FeedSortControls activeSort={activeSort} variant="sheet" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

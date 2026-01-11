"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type MediaFilter = "all" | "movie" | "tv";

const filterOptions: Array<{ label: string; value: MediaFilter }> = [
  { label: "All", value: "all" },
  { label: "Movies", value: "movie" },
  { label: "TV", value: "tv" },
];

export function FeedFilterBar({
  activeType,
  activeGenre,
  genres,
  variant = "inline",
}: {
  activeType: MediaFilter;
  activeGenre: string;
  genres: string[];
  variant?: "inline" | "sheet";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = (value: MediaFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const updateGenre = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("genre");
    } else {
      params.set("genre", value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const isSheet = variant === "sheet";
  const genreGridRef = useRef<HTMLDivElement | null>(null);
  const genreInnerRef = useRef<HTMLDivElement | null>(null);
  const [genreMaxHeight, setGenreMaxHeight] = useState<number | null>(null);
  const maxGenreHeight = 208;

  useLayoutEffect(() => {
    if (!isSheet || !genreGridRef.current || !genreInnerRef.current) return;
    const measured = genreInnerRef.current.offsetHeight;
    const nextHeight = Math.min(measured, maxGenreHeight);
    if (genreMaxHeight === null) {
      setGenreMaxHeight(nextHeight);
      return;
    }
    const previousHeight = genreMaxHeight;
    setGenreMaxHeight(previousHeight);
    const id = window.requestAnimationFrame(() => {
      setGenreMaxHeight(nextHeight);
    });
    return () => window.cancelAnimationFrame(id);
  }, [isSheet, activeType, genres.length, genreMaxHeight]);

  return (
    <div
      className={`flex ${isSheet ? "flex-col" : "flex-wrap"} items-center gap-3`}
    >
      <div
        className={`flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60 ${
          isSheet ? "w-full" : ""
        }`}
      >
        {filterOptions.map((option) => {
          const isActive = option.value === activeType;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateFilter(option.value)}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                isSheet ? "flex-1 text-center" : ""
              } ${
                isActive
                  ? "border border-brand text-brand"
                  : "border border-transparent hover:text-white/90"
              }`}
              aria-pressed={isActive}
              disabled={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {isSheet ? (
        <div className="w-full space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
            Genres
          </p>
          <div
            ref={genreGridRef}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{
              maxHeight: genreMaxHeight ? `${genreMaxHeight}px` : undefined,
            }}
          >
            <div ref={genreInnerRef} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => updateGenre("")}
              className={`rounded-md px-3 py-2 text-center text-[11px] uppercase tracking-[0.3em] transition ${
                activeGenre
                  ? "border border-transparent text-white/70 hover:text-white"
                  : "border border-brand text-brand"
              }`}
            >
              All
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => updateGenre(genre)}
                className={`rounded-md px-3 py-2 text-center text-[11px] uppercase tracking-[0.3em] transition ${
                  activeGenre === genre
                    ? "border border-brand text-brand"
                    : "border border-transparent text-white/70 hover:text-white"
                }`}
              >
                {genre}
              </button>
            ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
          <span className="hidden sm:inline">Genre</span>
          <select
            value={activeGenre}
            onChange={(event) => updateGenre(event.target.value)}
            className="rounded-lg bg-night/60 px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

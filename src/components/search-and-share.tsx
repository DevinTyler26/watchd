"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ShareTarget = {
  id: string | null;
  label: string;
};

type Filter = "all" | "movie" | "series";

type SearchResult = {
  imdbId: string;
  title: string;
  year?: string;
  type: "movie" | "series";
  posterUrl?: string;
  plot?: string;
  genre?: string;
};

type Suggestion = SearchResult & { source?: string };

const filters: Array<{ label: string; value: Filter }> = [
  { label: "Everything", value: "all" },
  { label: "Movies", value: "movie" },
  { label: "Series", value: "series" },
];

export function SearchAndShare({
  target,
  existingIds,
}: {
  target: ShareTarget;
  existingIds: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [likedById, setLikedById] = useState<
    Record<string, boolean | undefined>
  >({});
  const [posterErrorById, setPosterErrorById] = useState<
    Record<string, boolean>
  >({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [skipNextSuggestionFetch, setSkipNextSuggestionFetch] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedPlots, setExpandedPlots] = useState<Record<string, boolean>>(
    {}
  );
  const suggestionRef = useRef<HTMLDivElement | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionState, setActionState] = useState<{
    id?: string;
    status: "idle" | "saving" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    year?: string;
    posterUrl?: string;
    destination: string;
  } | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(
    () => new Set(existingIds)
  );

  useEffect(() => {
    setBlockedIds(new Set(existingIds));
  }, [existingIds]);

  const scrollToFeed = () => {
    try {
      localStorage.setItem("watchd:animate-latest", "1");
    } catch {
      // Ignore storage failures.
    }
    setConfirmation(null);
    clearSearch();
    if (typeof window === "undefined") {
      return;
    }
    const scrollToLatest = () => {
      const latest = document.getElementById("latest-entry");
      if (latest) {
        latest.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const feed = document.getElementById("signal-feed");
      feed?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // Wait for search results to clear and layout to settle before scrolling.
    requestAnimationFrame(() => requestAnimationFrame(scrollToLatest));
  };

  const disabled = useMemo(() => query.trim().length < 2, [query]);

  function clearSearch() {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
    setActionState({ status: "idle" });
    setNotes({});
    setLikedById({});
    setPosterErrorById({});
    setSuggestions([]);
    setShowSuggestions(false);
    setExpandedPlots({});
  }

  async function runSearch(input: string) {
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams({ q: input.trim() });
      if (filter !== "all") {
        params.set("type", filter);
      }

      const response = await fetch(`/api/imdb?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reach TMDB right now.");
      }

      setResults(
        Array.isArray(payload.results) ? payload.results.slice(0, 8) : []
      );
    } catch (err) {
      setResults([]);
      setError(
        err instanceof Error ? err.message : "Something unexpected happened."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      setError("Type at least two characters.");
      return;
    }
    void runSearch(query);
  }

  async function share(result: SearchResult) {
    if (blockedIds.has(result.imdbId)) {
      return;
    }
    setActionState({ id: result.imdbId, status: "saving" });
    const likedSelection = likedById[result.imdbId];

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId: result.imdbId,
          type: result.type,
          groupId: target.id ?? undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save entry.");
      }
      const entryId = payload?.entry?.id as string | undefined;
      if (entryId) {
        if (likedSelection !== undefined) {
          const reactionResponse = await fetch(
            `/api/watchlist/${entryId}/reaction`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reaction: likedSelection ? "LIKE" : "DISLIKE",
              }),
            }
          );
          if (!reactionResponse.ok) {
            // Best-effort: entry saved, ignore reaction failure.
            await reactionResponse.json().catch(() => ({}));
          }
        }
        const comment = notes[result.imdbId]?.trim();
        if (comment) {
          const commentResponse = await fetch(
            `/api/watchlist/${entryId}/comments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ body: comment }),
            }
          );
          if (!commentResponse.ok) {
            const commentPayload = await commentResponse
              .json()
              .catch(() => ({}));
            throw new Error(
              commentPayload?.error ??
                "Entry saved, but comment failed to post."
            );
          }
        }
      }

      setActionState({
        id: result.imdbId,
        status: "success",
        message: `${result.title} shared!`,
      });
      setNotes((prev) => ({ ...prev, [result.imdbId]: "" }));
      setConfirmation({
        title: result.title,
        year: result.year,
        posterUrl: result.posterUrl,
        destination: target.label,
      });
      setBlockedIds((prev) => {
        const next = new Set(prev);
        next.add(result.imdbId);
        return next;
      });
      router.refresh();
    } catch (err) {
      setActionState({
        id: result.imdbId,
        status: "error",
        message: err instanceof Error ? err.message : "Unable to save entry.",
      });
    } finally {
      setTimeout(() => setActionState({ status: "idle" }), 2400);
    }
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);
    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, []);

  useEffect(() => {
    if (skipNextSuggestionFetch) {
      setSkipNextSuggestionFetch(false);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      return;
    }
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      return;
    }
    setShowSuggestions(true);
    setIsSuggesting(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (filter !== "all") {
          params.set("type", filter);
        }
        const response = await fetch(`/api/imdb/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          setSuggestions([]);
          setShowSuggestions(false);
          setIsSuggesting(false);
          return;
        }
        setSuggestions(
          Array.isArray(payload.suggestions) ? payload.suggestions : []
        );
        setShowSuggestions(true);
        setIsSuggesting(false);
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          return;
        }
        setSuggestions([]);
        setShowSuggestions(false);
        setIsSuggesting(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, filter]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || suggestionRef.current?.contains(target)) {
        return;
      }
      setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showSuggestions]);

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-night/40 px-4 py-3 text-sm text-white/70">
          Sharing with{" "}
          <span className="font-semibold text-white">{target.label}</span>
        </div>
        <form
          onSubmit={handleSearch}
          className="relative z-[100] space-y-4 rounded-2xl border border-white/10 bg-night/40 p-3 backdrop-blur sm:p-4"
        >
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter === item.value
                    ? "bg-brand text-night"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative flex flex-col gap-3 sm:flex-row">
            <div ref={suggestionRef} className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => {
                  if (suggestions.length) setShowSuggestions(true);
                }}
                placeholder="Search for a title, e.g. The Office"
                className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-mist placeholder-white/40 focus:border-brand focus:outline-none"
              />
              {showSuggestions && (suggestions.length || isSuggesting) ? (
                <div className="absolute z-[200] mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-night/95 shadow-2xl shadow-black/40">
                  {isSuggesting ? (
                    <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/60">
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden
                      />
                      Loading suggestions…
                    </div>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-2">
                      {suggestions.map((suggestion) => (
                        <li key={suggestion.imdbId}>
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(suggestion.title);
                              setShowSuggestions(false);
                              setSkipNextSuggestionFetch(true);
                              void runSearch(suggestion.title);
                            }}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
                          >
                            <span className="truncate">{suggestion.title}</span>
                            <span className="whitespace-nowrap text-xs uppercase tracking-[0.3em] text-white/40">
                              {suggestion.year ?? suggestion.type}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 sm:w-64">
              <button
                type="submit"
                disabled={disabled || isSearching}
                className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:bg-brand-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {isSearching ? "Searching…" : "Pull from TMDB"}
              </button>
              <button
                type="button"
                onClick={clearSearch}
                disabled={!hasSearched && !results.length && !query}
                className="h-full rounded-2xl border border-white/15 px-3 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
              >
                Clear
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </form>

        {results.length > 0 ? (
          <ul className="grid gap-4">
            {results.map((result, index) => (
              <li
                key={`${result.imdbId}-${index}`}
                className="rounded-3xl border border-white/5 bg-white/5 p-2 shadow-lg shadow-black/20 sm:p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex shrink-0 flex-col items-start gap-3">
                    {result.posterUrl &&
                    result.posterUrl !== "N/A" &&
                    !posterErrorById[result.imdbId] ? (
                      <Image
                        src={result.posterUrl}
                        alt={result.title}
                        width={160}
                        height={240}
                        className="rounded-2xl border border-white/10 object-cover"
                        onError={() =>
                          setPosterErrorById((prev) => ({
                            ...prev,
                            [result.imdbId]: true,
                          }))
                        }
                      />
                    ) : (
                      <Image
                        src="/poster-unavailable.png"
                        alt="Poster unavailable"
                        width={160}
                        height={240}
                        className="rounded-2xl border border-white/10 object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                          <p className="text-lg font-semibold text-white">
                            {result.title}
                          {result.year ? (
                            <span className="text-white/50">
                              {" "}
                              · {result.year}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                          {result.type}
                          {result.genre ? ` · ${result.genre}` : ""}
                        </p>
                      </div>
                      <div className="hidden sm:block" aria-hidden />
                    </div>
                    {result.plot ? (
                      <div className="space-y-1">
                        <p
                          className="text-sm text-white/70"
                          style={
                            isMobile &&
                            !expandedPlots[result.imdbId] &&
                            result.plot.length > 140
                              ? {
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }
                              : undefined
                          }
                        >
                          {result.plot}
                        </p>
                        {isMobile && result.plot.length > 140 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlots((prev) => ({
                                ...prev,
                                [result.imdbId]: !prev[result.imdbId],
                              }))
                            }
                            className="px-1 py-0.5 text-xs font-semibold uppercase leading-tight tracking-[0.2em] text-white/50 transition hover:text-white"
                          >
                            {expandedPlots[result.imdbId]
                              ? "Show less"
                              : "Read more"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div>
                      <textarea
                        value={notes[result.imdbId] ?? ""}
                        onChange={(event) =>
                          setNotes((prev) => ({
                            ...prev,
                            [result.imdbId]: event.target.value,
                          }))
                        }
                        placeholder="Add a comment (optional)"
                        className="min-h-16 w-full rounded-2xl border border-white/10 bg-night/60 p-3 text-sm text-white placeholder-white/40 focus:border-brand focus:outline-none"
                        maxLength={500}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-sm">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setLikedById((prev) => ({
                                ...prev,
                                [result.imdbId]: true,
                              }))
                            }
                            className={`inline-flex items-center gap-2 ${
                              likedById[result.imdbId] === true
                                ? "text-emerald"
                                : "text-white/60 hover:text-white"
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M7 11v9H4v-9h3Zm4 9h7a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-5.5l.9-3.8a1.5 1.5 0 0 0-3-.6L8 11" />
                            </svg>
                            <span className="sr-only">Like</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setLikedById((prev) => ({
                                ...prev,
                                [result.imdbId]: false,
                              }))
                            }
                            className={`inline-flex items-center gap-2 ${
                              likedById[result.imdbId] === false
                                ? "text-rose-200"
                                : "text-white/60 hover:text-white"
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 13V4h3v9h-3Zm-4-9H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h5.5l-.9 3.8a1.5 1.5 0 0 0 3 .6L16 13" />
                            </svg>
                            <span className="sr-only">Dislike</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => share(result)}
                          disabled={
                            blockedIds.has(result.imdbId) ||
                            (actionState.status === "saving" &&
                              actionState.id === result.imdbId)
                          }
                          className="h-11 rounded-2xl bg-emerald px-6 text-sm font-semibold uppercase tracking-wide text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {blockedIds.has(result.imdbId)
                            ? "Already shared"
                            : actionState.status === "saving" &&
                              actionState.id === result.imdbId
                            ? "Saving…"
                            : "Share it"}
                        </button>
                      </div>
                    </div>
                    {blockedIds.has(result.imdbId) ? (
                      <p className="text-sm text-emerald">
                        Already in this signal feed.
                      </p>
                    ) : actionState.id === result.imdbId &&
                      actionState.status !== "idle" ? (
                      <p
                        className={`text-sm ${
                          actionState.status === "success"
                            ? "text-emerald"
                            : actionState.status === "error"
                            ? "text-red-300"
                            : "text-white/70"
                        }`}
                      >
                        {actionState.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : hasSearched ? (
          <p className="text-sm text-white/60">
            Nothing surfaced. Try a different title.
          </p>
        ) : (
          <p className="text-sm text-white/60">
            No search yet. Try pulling a title above.
          </p>
        )}
      </div>

      {confirmation ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-6 py-8">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night/90 p-6 text-center text-white shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald">
              Entry added
            </p>
            <h3 className="mt-3 text-2xl font-semibold">Signal sent</h3>
            <p className="mt-2 text-sm text-white/70">
              {confirmation.title}
              {confirmation.year ? ` · ${confirmation.year}` : ""} is now live
              in your {confirmation.destination} signal feed.
            </p>
            {confirmation.posterUrl && confirmation.posterUrl !== "N/A" ? (
              <Image
                src={confirmation.posterUrl}
                alt={confirmation.title}
                width={120}
                height={180}
                className="mx-auto mt-4 rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <Image
                src="/poster-unavailable.png"
                alt="Poster unavailable"
                width={120}
                height={180}
                className="mx-auto mt-4 rounded-2xl border border-white/10 object-cover"
              />
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Keep browsing
              </button>
              <button
                type="button"
                onClick={scrollToFeed}
                className="flex-1 rounded-2xl bg-emerald px-4 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:opacity-90"
              >
                View feed
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

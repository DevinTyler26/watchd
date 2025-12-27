"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ShareTarget = {
  id: string | null;
  label: string;
};

type Filter = "all" | "movie" | "series";

type SearchResult = {
  imdbId: string;
  title: string;
  year?: string;
  type: string;
  posterUrl?: string;
};

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
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
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
    setLiked({});
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      setError("Type at least two characters.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (filter !== "all") {
        params.set("type", filter);
      }

      const response = await fetch(`/api/imdb?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reach IMDb right now.");
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

  async function share(result: SearchResult) {
    if (blockedIds.has(result.imdbId)) {
      return;
    }
    setActionState({ id: result.imdbId, status: "saving" });

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId: result.imdbId,
          note: notes[result.imdbId],
          liked: liked[result.imdbId] ?? true,
          groupId: target.id ?? undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save entry.");
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

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-night/40 px-4 py-3 text-sm text-white/70">
          Sharing with{" "}
          <span className="font-semibold text-white">{target.label}</span>
        </div>
        <form
          onSubmit={handleSearch}
          className="space-y-4 rounded-2xl border border-white/10 bg-night/40 p-4 backdrop-blur"
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a title, e.g. The Office"
              className="flex-1 rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-mist placeholder-white/40 focus:border-brand focus:outline-none"
            />
            <div className="flex items-center gap-2 sm:w-64">
              <button
                type="submit"
                disabled={disabled || isSearching}
                className="flex-1 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-night transition hover:bg-brand-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSearching ? "Searching…" : "Pull from IMDb"}
              </button>
              <button
                type="button"
                onClick={clearSearch}
                disabled={!hasSearched && !results.length && !query}
                className="h-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-3xl border border-white/5 bg-white/5 p-4 shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-4 md:flex-row">
                  {result.posterUrl ? (
                    <Image
                      src={result.posterUrl}
                      alt={result.title}
                      width={96}
                      height={140}
                      className="rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-[140px] w-[96px] items-center justify-center rounded-2xl border border-dashed border-white/15 text-xs text-white/50">
                      No poster
                    </div>
                  )}
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
                        </p>
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <textarea
                        value={notes[result.imdbId] ?? ""}
                        onChange={(event) =>
                          setNotes((prev) => ({
                            ...prev,
                            [result.imdbId]: event.target.value,
                          }))
                        }
                        placeholder="Add a short note or pull-quote (optional)"
                        className="min-h-16 rounded-2xl border border-white/10 bg-night/60 p-3 text-sm text-white placeholder-white/40 focus:border-brand focus:outline-none"
                        maxLength={500}
                      />
                      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-night/60 p-3 text-sm text-white/70">
                        <span>Mark as liked</span>
                        <input
                          type="checkbox"
                          checked={liked[result.imdbId] ?? true}
                          onChange={(event) =>
                            setLiked((prev) => ({
                              ...prev,
                              [result.imdbId]: event.target.checked,
                            }))
                          }
                          className="h-5 w-5 accent-brand"
                        />
                      </label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8">
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
            {confirmation.posterUrl ? (
              <Image
                src={confirmation.posterUrl}
                alt={confirmation.title}
                width={120}
                height={180}
                className="mx-auto mt-4 rounded-2xl border border-white/10 object-cover"
              />
            ) : null}
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

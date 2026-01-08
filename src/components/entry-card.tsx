"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WatchEntry, User, Group, Media } from "@prisma/client";
import { relativeTimeFromNow } from "@/lib/time";
import { RemoveEntryButton } from "@/components/remove-entry-button";
import { EntryReactionButtons } from "@/components/entry-reaction-buttons";
import { EntryCommentsModal } from "@/components/entry-comments-modal";
import { EntryShareModal } from "@/components/entry-share-modal";
import { CommentPrefetch } from "@/components/comment-prefetch";

type ReactionType = "LIKE" | "DISLIKE";

export type EntryWithUser = WatchEntry & {
  user: Pick<User, "id" | "name" | "image">;
  group?: Pick<Group, "id" | "name" | "slug"> | null;
  media: Pick<
    Media,
    | "tmdbId"
    | "title"
    | "year"
    | "posterUrl"
    | "type"
    | "plot"
    | "genre"
    | "watchProviders"
    | "runtimeMinutes"
    | "seasonCount"
    | "trailerUrl"
  >;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: ReactionType | null;
  sharedGroups?: Array<{ id: string; name: string }>;
};

function normalizeWatchProvider(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("paramount+")) return "Paramount+";
  if (lower.startsWith("paramount plus")) return "Paramount+";
  if (lower.startsWith("paramount+ ")) return "Paramount+";
  if (lower.startsWith("apple tv channel")) return "Apple TV";
  if (lower.startsWith("apple tv+")) return "Apple TV+";
  if (lower === "amazon video") return "Prime Video";
  if (lower.startsWith("prime video")) return "Prime Video";
  if (lower.startsWith("amazon prime")) return "Prime Video";
  if (lower === "google play movies") return "Google TV";
  if (lower === "youtube") return "YouTube";
  if (lower.startsWith("hbo max")) return "Max";
  if (lower === "max") return "Max";
  if (lower === "peacock premium") return "Peacock";
  if (lower === "peacock premium plus") return "Peacock";
  if (lower === "fandango at home") return "Fandango";
  return trimmed;
}

function normalizeWatchProviders(providers: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const provider of providers) {
    const name = normalizeWatchProvider(provider);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  const rank: Record<string, number> = {
    Netflix: 1,
    "Prime Video": 2,
    Max: 3,
    Hulu: 4,
    "Disney+": 5,
    "Apple TV+": 6,
    "Apple TV": 7,
    "Paramount+": 8,
    Peacock: 9,
    YouTube: 10,
    "Google TV": 11,
    Fandango: 12,
  };
  return normalized.sort((a, b) => {
    const rankA = rank[a] ?? 999;
    const rankB = rank[b] ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

function formatRuntime(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function EntryCard({
  entry,
  canRemove = false,
  canReact = false,
  canComment = false,
  currentUserId,
  shareTargets,
  animateIn = false,
}: {
  entry: EntryWithUser;
  canRemove?: boolean;
  canReact?: boolean;
  canComment?: boolean;
  currentUserId?: string | null;
  shareTargets?: Array<{ id: string | null; name: string }>;
  animateIn?: boolean;
}) {
  const canShareEntry = (shareTargets?.length ?? 0) > 0;
  const plot = entry.media.plot;
  const genre = entry.media.genre;
  const displayYear = entry.media.year;
  const displayTitle = entry.media.title;
  const displayType = entry.media.type;
  const posterUrl = entry.media.posterUrl;
  const tmdbId = entry.media.tmdbId;
  const runtimeMinutes = entry.media.runtimeMinutes ?? null;
  const seasonCount = entry.media.seasonCount ?? null;
  const trailerUrl = entry.media.trailerUrl ?? null;
  const watchProviders = normalizeWatchProviders(
    Array.isArray(entry.media.watchProviders)
      ? entry.media.watchProviders.filter(
          (provider): provider is string => typeof provider === "string"
        )
      : []
  );
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [visibleProviderCount, setVisibleProviderCount] = useState(
    watchProviders.length
  );
  const collapsedProviderCountRef = useRef(visibleProviderCount);
  const providersTextRef = useRef<HTMLParagraphElement | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const collapseTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);
  const removeStartAt = useRef<number | null>(null);
  const [shouldAnimateIn, setShouldAnimateIn] = useState(false);
  const FADE_DURATION_MS = 500;
  const COLLAPSE_DELAY_MS = 450;
  const REMOVE_AFTER_MS = 700;
  const runtimeLabel = formatRuntime(runtimeMinutes);
  const seasonLabel =
    displayType === "series" && seasonCount
      ? `${seasonCount} ${seasonCount === 1 ? "season" : "seasons"}`
      : null;
  const metaParts = [displayType, genre, seasonLabel, runtimeLabel].filter(
    Boolean
  ) as string[];

  const watchProvidersContent = watchProviders.length ? (
    <div className="text-xs text-white/70">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.35em] text-white/40">
        Where to watch
      </span>
      <p ref={providersTextRef} className="leading-relaxed text-white/70">
        {(showAllProviders
          ? watchProviders
          : watchProviders.slice(0, visibleProviderCount)
        ).join(" · ")}
        {(
          showAllProviders
            ? watchProviders.length > collapsedProviderCountRef.current
            : watchProviders.length > visibleProviderCount
        ) ? (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setShowAllProviders((prev) => !prev)}
              className="text-[11px] text-white/60 underline decoration-white/30 underline-offset-4 transition hover:text-white/80"
            >
              {showAllProviders
                ? "Show less"
                : `+${watchProviders.length - visibleProviderCount} more`}
            </button>
          </>
        ) : null}
      </p>
    </div>
  ) : null;

  useEffect(() => {
    if (animateIn) {
      try {
        const shouldAnimate = window.localStorage.getItem(
          "watchd:animate-latest"
        );
        if (shouldAnimate === "1") {
          setShouldAnimateIn(true);
          window.localStorage.removeItem("watchd:animate-latest");
        }
      } catch {
        // Ignore storage failures.
      }
    }
    return () => {
      if (collapseTimer.current) {
        window.clearTimeout(collapseTimer.current);
      }
      if (removeTimer.current) {
        window.clearTimeout(removeTimer.current);
      }
    };
  }, [animateIn]);

  useEffect(() => {
    if (showAllProviders) {
      setVisibleProviderCount(watchProviders.length);
      return;
    }
    const element = providersTextRef.current;
    if (!element) return;

    const computeVisibleCount = () => {
      if (!element) return;
      const availableWidth = element.clientWidth;
      if (!availableWidth) {
        setVisibleProviderCount(watchProviders.length);
        return;
      }
      const styles = window.getComputedStyle(element);
      const font = styles.font;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setVisibleProviderCount(watchProviders.length);
        return;
      }
      ctx.font = font;
      const separator = " · ";
      const separatorWidth = ctx.measureText(separator).width;
      let usedWidth = 0;
      let count = 0;
      for (const provider of watchProviders) {
        const labelWidth = ctx.measureText(provider).width;
        const nextWidth =
          count === 0 ? labelWidth : usedWidth + separatorWidth + labelWidth;
        if (nextWidth > availableWidth) break;
        usedWidth = nextWidth;
        count += 1;
      }
      const nextCount = Math.max(1, count);
      collapsedProviderCountRef.current = nextCount;
      setVisibleProviderCount(nextCount);
    };

    computeVisibleCount();
    const observer = new ResizeObserver(computeVisibleCount);
    observer.observe(element);
    return () => observer.disconnect();
  }, [showAllProviders, watchProviders.join(" · ")]);

  if (isRemoved) {
    return null;
  }

  return (
    <article
      className={`flex flex-col gap-6 rounded-lg border border-white/5 bg-white/5 p-4 shadow-xl shadow-black/30 transition-all duration-500 sm:p-6 ${
        isRemoving ? "pointer-events-none scale-[0.98] opacity-0" : ""
      } ${
        isCollapsed ? "max-h-0 overflow-hidden border-transparent p-0" : ""
      } ${shouldAnimateIn ? "animate-entry-in" : ""}`}
    >
      <CommentPrefetch entryId={entry.id} />
      <header className="space-y-3">
        <div className="min-w-0">
          <p className="text-xl font-semibold text-white">{displayTitle}</p>
          {displayYear ? (
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              {displayYear}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.25em] text-white/50 sm:text-xs sm:tracking-[0.4em]">
            {metaParts.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="flex items-center gap-x-2"
              >
                <span>{item}</span>
                {index < metaParts.length - 1 ? (
                  <span aria-hidden className="text-white/30">
                    ·
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </header>
      <div className="flex items-start gap-4">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={displayTitle}
            width={128}
            height={192}
            sizes="(min-width: 1024px) 128px, 96px"
            className="h-[140px] w-[96px] shrink-0 rounded-lg border border-white/10 object-cover sm:h-[160px] sm:w-[112px] lg:h-[192px] lg:w-[128px]"
          />
        ) : (
          <Image
            src="/poster-unavailable.png"
            alt="Poster unavailable"
            width={128}
            height={192}
            sizes="(min-width: 1024px) 128px, 96px"
            className="h-[140px] w-[96px] shrink-0 rounded-lg border border-white/10 object-cover sm:h-[160px] sm:w-[112px] lg:h-[192px] lg:w-[128px]"
          />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          {plot ? (
            <p className="rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-white/70">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.35em] text-white/40">
                Plot
              </span>
              {plot}
            </p>
          ) : null}
          <div className="hidden sm:block">{watchProvidersContent}</div>
          {entry.review ? (
            <p className="rounded-lg bg-night/60 p-4 text-sm text-white/80">
              {entry.review}
            </p>
          ) : null}
        </div>
      </div>
      <div className="sm:hidden -mt-3 -mb-2">{watchProvidersContent}</div>
      <div className="border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <EntryReactionButtons
              entryId={entry.id}
              initialLikeCount={entry.likeCount}
              initialDislikeCount={entry.dislikeCount}
              initialReaction={entry.viewerReaction}
              canReact={canReact}
            />
            <EntryCommentsModal
              entryId={entry.id}
              canComment={canComment}
              currentUserId={currentUserId}
              title={displayTitle}
            />
            {canShareEntry && shareTargets ? (
              <EntryShareModal
                imdbId={tmdbId}
                mediaType={displayType === "series" ? "series" : "movie"}
                note={entry.review}
                groups={shareTargets}
                sharedGroups={entry.sharedGroups ?? []}
              />
            ) : null}
            {trailerUrl ? (
              <a
                href={trailerUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
                aria-label={`Watch trailer for ${displayTitle}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeOpacity="0.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M9.5 8l7 4-7 4z" fill="none" />
                </svg>

                {/* <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M8 5v14M16 5v14M5.5 9h3M5.5 12h3M5.5 15h3M15.5 9h3M15.5 12h3M15.5 15h3" />
                </svg> */}
              </a>
            ) : null}
            {canRemove ? (
              <RemoveEntryButton
                imdbId={tmdbId}
                mediaType={displayType === "series" ? "series" : "movie"}
                groupId={entry.groupId}
                title={displayTitle}
                iconOnly
                refreshDelayMs={REMOVE_AFTER_MS}
                onRemoveStart={() => {
                  setIsRemoving(true);
                  removeStartAt.current = Date.now();
                  collapseTimer.current = window.setTimeout(() => {
                    setIsCollapsed(true);
                  }, COLLAPSE_DELAY_MS);
                  removeTimer.current = window.setTimeout(() => {
                    setIsRemoved(true);
                  }, REMOVE_AFTER_MS);
                }}
                onRemoveSuccess={() => {
                  const startedAt = removeStartAt.current ?? Date.now();
                  const elapsed = Date.now() - startedAt;
                  const remaining = Math.max(0, FADE_DURATION_MS - elapsed);
                  window.setTimeout(() => setIsRemoved(true), remaining);
                }}
                onRemoveError={() => {
                  if (collapseTimer.current) {
                    window.clearTimeout(collapseTimer.current);
                  }
                  if (removeTimer.current) {
                    window.clearTimeout(removeTimer.current);
                  }
                  setIsCollapsed(false);
                  setIsRemoving(false);
                }}
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col items-end text-right">
            <div className="flex min-w-0 items-center gap-2 text-xs text-white/50">
              <span
                className="truncate uppercase tracking-[0.24em]"
                title={entry.user.name ?? "A friend"}
              >
                {(entry.user.name ?? "A friend").split(" ")[0]}
              </span>
              {entry.user.image ? (
                <Image
                  src={entry.user.image}
                  alt={entry.user.name ?? "Profile"}
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-lg border border-white/20"
                />
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/20 text-[11px] font-semibold uppercase text-white/70">
                  {(entry.user.name ?? "?").charAt(0)}
                </div>
              )}
            </div>
            <span
              className="mt-1 text-xs text-white/50 sm:whitespace-nowrap"
              suppressHydrationWarning
            >
              {relativeTimeFromNow(entry.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

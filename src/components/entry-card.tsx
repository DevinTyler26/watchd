"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WatchEntry, User, Group } from "@prisma/client";
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
  likeCount: number;
  dislikeCount: number;
  viewerReaction: ReactionType | null;
  sharedGroups?: Array<{ id: string; name: string }>;
};

function extractPlot(omdb: EntryWithUser["omdb"]) {
  if (!omdb || typeof omdb !== "object" || Array.isArray(omdb)) {
    return null;
  }
  const plot = (omdb as { Plot?: unknown }).Plot;
  return typeof plot === "string" ? plot : null;
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
  const plot = extractPlot(entry.omdb);
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

  if (isRemoved) {
    return null;
  }

  return (
    <article
      className={`flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/5 p-6 shadow-xl shadow-black/30 transition-all duration-500 ${
        isRemoving ? "pointer-events-none scale-[0.98] opacity-0" : ""
      } ${
        isCollapsed
          ? "max-h-0 overflow-hidden border-transparent p-0"
          : ""
      } ${shouldAnimateIn ? "animate-entry-in" : ""}`}
    >
      <CommentPrefetch entryId={entry.id} />
      <header className="space-y-3">
        <div className="grid grid-cols-2 items-start gap-3 sm:flex sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xl font-semibold text-white">{entry.title}</p>
            {entry.year ? (
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                {entry.year}
              </p>
            ) : null}
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              {entry.type}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-end text-right">
            <div className="flex min-w-0 items-center gap-2 text-xs text-white/50 sm:justify-end">
              <span className="truncate uppercase tracking-[0.24em]">
                {entry.user.name ?? "A friend"}
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
            <span className="mt-1 text-xs text-white/50 sm:whitespace-nowrap">
              {relativeTimeFromNow(entry.createdAt)}
            </span>
          </div>
        </div>
      </header>
      <div className="flex items-start gap-4">
        {entry.posterUrl ? (
          <Image
            src={entry.posterUrl}
            alt={entry.title}
            width={128}
            height={192}
            sizes="(min-width: 1024px) 128px, 96px"
            className="h-[140px] w-[96px] shrink-0 rounded-2xl border border-white/10 object-cover sm:h-[160px] sm:w-[112px] lg:h-[192px] lg:w-[128px]"
          />
        ) : (
          <Image
            src="/poster-unavailable.png"
            alt="Poster unavailable"
            width={128}
            height={192}
            sizes="(min-width: 1024px) 128px, 96px"
            className="h-[140px] w-[96px] shrink-0 rounded-2xl border border-white/10 object-cover sm:h-[160px] sm:w-[112px] lg:h-[192px] lg:w-[128px]"
          />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          {plot ? (
            <p className="rounded-2xl border border-white/5 bg-white/5 p-3 text-sm text-white/70">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.35em] text-white/40">
                Plot
              </span>
              {plot}
            </p>
          ) : null}
          {entry.review ? (
            <p className="rounded-2xl bg-night/60 p-4 text-sm text-white/80">
              {entry.review}
            </p>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <EntryReactionButtons
            entryId={entry.id}
            initialLikeCount={entry.likeCount}
            initialDislikeCount={entry.dislikeCount}
            initialReaction={entry.viewerReaction}
            canReact={canReact}
          />
          <div className="flex items-center gap-4">
            <EntryCommentsModal
              entryId={entry.id}
              canComment={canComment}
              currentUserId={currentUserId}
              title={entry.title}
            />
            {canShareEntry && shareTargets ? (
              <EntryShareModal
                imdbId={entry.imdbId}
                liked={entry.liked}
                note={entry.review}
                groups={shareTargets}
                sharedGroups={entry.sharedGroups ?? []}
              />
            ) : null}
            {canRemove ? (
              <RemoveEntryButton
                imdbId={entry.imdbId}
                groupId={entry.groupId}
                title={entry.title}
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
        </div>
      </div>
    </article>
  );
}

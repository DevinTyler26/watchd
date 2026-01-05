"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ReactionType = "LIKE" | "DISLIKE";

type EntryReactionButtonsProps = {
  entryId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  initialReaction: ReactionType | null;
  canReact: boolean;
};

type ReactionDelta = {
  likeDelta: number;
  dislikeDelta: number;
};

export function EntryReactionButtons({
  entryId,
  initialLikeCount,
  initialDislikeCount,
  initialReaction,
  canReact,
}: EntryReactionButtonsProps) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(initialLikeCount ?? 0);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount ?? 0);
  const [reaction, setReaction] = useState<ReactionType | null>(
    initialReaction
  );
  const [isPending, startTransition] = useTransition();

  const applyReaction = (nextReaction: ReactionType | null) => {
    const previousReaction = reaction;
    const delta = getReactionDelta(previousReaction, nextReaction);

    startTransition(() => {
      setReaction(nextReaction);
      if (delta.likeDelta !== 0) {
        setLikeCount((prev) => Math.max(0, prev + delta.likeDelta));
      }
      if (delta.dislikeDelta !== 0) {
        setDislikeCount((prev) => Math.max(0, prev + delta.dislikeDelta));
      }
      void persistReaction(nextReaction, previousReaction, delta);
    });
  };

  const persistReaction = async (
    nextReaction: ReactionType | null,
    previousReaction: ReactionType | null,
    delta: ReactionDelta
  ) => {
    const reactionEndpoint = `/api/watchlist/${entryId}/reaction`;
    const response = await fetch(reactionEndpoint, {
      method: nextReaction ? "POST" : "DELETE",
      headers: nextReaction
        ? { "Content-Type": "application/json" }
        : undefined,
      body: nextReaction
        ? JSON.stringify({ reaction: nextReaction })
        : undefined,
    });

    if (!response.ok) {
      setReaction(previousReaction);
      if (delta.likeDelta !== 0) {
        setLikeCount((prev) => Math.max(0, prev - delta.likeDelta));
      }
      if (delta.dislikeDelta !== 0) {
        setDislikeCount((prev) => Math.max(0, prev - delta.dislikeDelta));
      }
      const payload = await response.json().catch(() => ({}));
      if (payload?.error) {
        alert(payload.error);
      }
      return;
    }

    router.refresh();
  };

  const handleSelect = (next: ReactionType) => {
    if (!canReact || isPending) {
      return;
    }
    applyReaction(reaction === next ? null : next);
  };

  return (
    <div className="flex items-center gap-2">
      <ReactionButton
        label="Like"
        count={likeCount}
        isActive={reaction === "LIKE"}
        onClick={() => handleSelect("LIKE")}
        disabled={!canReact || isPending}
        activeClasses="text-emerald"
        icon={
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
        }
      />
      <ReactionButton
        label="Dislike"
        count={dislikeCount}
        isActive={reaction === "DISLIKE"}
        onClick={() => handleSelect("DISLIKE")}
        disabled={!canReact || isPending}
        activeClasses="text-rose-200"
        icon={
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
        }
      />
    </div>
  );
}

type ReactionButtonProps = {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  disabled: boolean;
  activeClasses: string;
  icon: React.ReactNode;
};

function ReactionButton({
  label,
  count,
  isActive,
  onClick,
  disabled,
  activeClasses,
  icon,
}: ReactionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={`flex items-center gap-2 text-sm font-semibold transition ${
        isActive ? activeClasses : "text-white/70 hover:text-white"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {icon}
      <span className="sr-only">{label}</span>
      <span className="text-xs font-mono text-white/60">{count}</span>
    </button>
  );
}

function getReactionDelta(
  previous: ReactionType | null,
  next: ReactionType | null
): ReactionDelta {
  const delta: ReactionDelta = { likeDelta: 0, dislikeDelta: 0 };

  if (previous === "LIKE") {
    delta.likeDelta -= 1;
  } else if (previous === "DISLIKE") {
    delta.dislikeDelta -= 1;
  }

  if (next === "LIKE") {
    delta.likeDelta += 1;
  } else if (next === "DISLIKE") {
    delta.dislikeDelta += 1;
  }

  return delta;
}

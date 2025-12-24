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
        activeClasses="border-emerald/80 bg-emerald/20 text-emerald"
      />
      <ReactionButton
        label="Dislike"
        count={dislikeCount}
        isActive={reaction === "DISLIKE"}
        onClick={() => handleSelect("DISLIKE")}
        disabled={!canReact || isPending}
        activeClasses="border-rose-500/80 bg-rose-500/20 text-rose-200"
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
};

function ReactionButton({
  label,
  count,
  isActive,
  onClick,
  disabled,
  activeClasses,
}: ReactionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition ${
        isActive
          ? activeClasses
          : "border-white/10 bg-white/5 text-white/80 hover:border-white/40 hover:text-white"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span>{label}</span>
      <span className="text-xs font-mono text-white/70">{count}</span>
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

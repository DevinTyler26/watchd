"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface RemoveEntryButtonProps {
  imdbId: string;
  groupId: string | null;
  title: string;
}

export function RemoveEntryButton({
  imdbId,
  groupId,
  title,
}: RemoveEntryButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    startTransition(() => {
      void deleteEntry();
    });
  };

  const deleteEntry = async () => {
    const response = await fetch("/api/watchlist", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imdbId, groupId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : "Could not remove entry.";
      // keep simple alert to bubble error without extra UI surface
      alert(message);
      return;
    }

    router.refresh();
  };

  const label = isPending ? "Removing..." : "Remove entry";

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      className="rounded border border-rose-500 px-3 py-1 text-sm font-medium text-rose-500 transition hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
      aria-label={`Remove ${title}`}
    >
      {label}
    </button>
  );
}

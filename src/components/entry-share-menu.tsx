"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type ShareGroup = {
  id: string | null;
  name: string;
};

type EntryShareMenuProps = {
  imdbId: string;
  liked: boolean;
  note?: string | null;
  groups: ShareGroup[];
  sharedGroups?: Array<{ id: string; name: string }>;
  variant?: "default" | "compact";
};

export function EntryShareMenu({
  imdbId,
  liked,
  note,
  groups,
  sharedGroups = [],
  variant = "default",
}: EntryShareMenuProps) {
  const router = useRouter();
  const [selection, setSelection] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const orderedGroups = useMemo(() => {
    const personal = groups.find((group) => group.id === null);
    const rest = groups
      .filter((group) => group.id !== null)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    return personal ? [personal, ...rest] : rest;
  }, [groups]);

  const handleChange = (value: string) => {
    setSelection(value);
    if (!value) {
      return;
    }
    const targetId = value === "personal" ? null : value;
    startTransition(() => {
      void shareToGroup(targetId);
    });
  };

  const shareToGroup = async (groupId: string | null) => {
    setMessage(null);
    setMessageTone(null);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imdbId,
          note: note ?? undefined,
          liked,
          groupId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to share that entry.");
      }

      const groupName = orderedGroups.find(
        (group) => group.id === groupId
      )?.name;
      setMessage(
        groupName ? `Shared with ${groupName}.` : "Shared successfully."
      );
      setMessageTone("success");
      setSelection("");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to share right now.";
      setMessage(message);
      setMessageTone("error");
    }
  };

  const helper =
    message ??
    (sharedGroups.length
      ? "Already shared with:"
      : "Send this drop to another circle.");
  const helperTone = message
    ? messageTone === "success"
      ? "text-emerald"
      : messageTone === "error"
      ? "text-rose-300"
      : "text-white/60"
    : sharedGroups.length
    ? "text-white/60"
    : "text-white/40";
  const isCompact = variant === "compact";

  return (
    <div
      className={`flex flex-col gap-3 ${
        isCompact ? "" : "lg:flex-row lg:items-center lg:justify-between"
      }`}
    >
      <div className="space-y-1">
        <p
          className={`uppercase tracking-[0.4em] text-white/40 ${
            isCompact ? "text-[9px]" : "text-[10px]"
          }`}
        >
          Share to circle
        </p>
        {!isCompact || sharedGroups.length || message ? (
          <p className={`text-xs ${helperTone}`}>{helper}</p>
        ) : null}
        {sharedGroups.length ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {sharedGroups.map((group) => (
              <span
                key={`${group.id}-${group.name}`}
                className={`rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.3em] text-white/70 ${
                  isCompact ? "text-[9px]" : "text-[10px]"
                }`}
              >
                {group.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={`relative w-full ${isCompact ? "" : "lg:max-w-xs"}`}>
        <select
          value={selection}
          onChange={(event) => handleChange(event.target.value)}
          disabled={isPending}
          className={`w-full appearance-none rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-left font-semibold uppercase tracking-[0.25em] text-white/80 transition focus:border-emerald focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            isCompact ? "text-[11px]" : "text-sm"
          }`}
        >
          <option value="">Pick a circle</option>
          {orderedGroups.map((group) => (
            <option key={group.id ?? "personal"} value={group.id ?? "personal"}>
              {group.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/60">
          ▾
        </span>
        {isPending ? (
          <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

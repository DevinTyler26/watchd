"use client";

import { useState, useTransition } from "react";

type GroupPref = {
  id: string;
  name: string;
  instant: boolean;
  weekly: boolean;
};

type Props = {
  groups: GroupPref[];
};

export function NotificationPreferences({ groups }: Props) {
  const [prefs, setPrefs] = useState(groups);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updatePref = (groupId: string, patch: Partial<GroupPref>) => {
    setPrefs((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g))
    );
    startTransition(() => {
      setMessage(null);
      void (async () => {
        try {
          const response = await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupId,
              instant: patch.instant,
              weekly: patch.weekly,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to save preferences.");
          }
          setMessage("Saved");
          setTimeout(() => setMessage(null), 2000);
        } catch (err) {
          setMessage(
            err instanceof Error ? err.message : "Unable to save preferences."
          );
          // revert optimistic change
          setPrefs(groups);
        }
      })();
    });
  };

  return (
    <div className="space-y-4">
      {prefs.length === 0 ? (
        <p className="text-sm text-white/60">
          You are not in any circles yet. Join a group to enable notifications.
        </p>
      ) : (
        <ul className="space-y-3">
          {prefs.map((group) => (
            <li
              key={group.id}
              className="rounded-2xl border border-white/10 bg-night/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    {group.name}
                  </p>
                  <p className="text-xs text-white/50">
                    Decide how you want updates from this circle.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm text-white/80">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.instant}
                      onChange={(e) =>
                        updatePref(group.id, { instant: e.target.checked })
                      }
                      disabled={isPending}
                      className="h-4 w-4 accent-brand"
                    />
                    Instant emails for new drops
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.weekly}
                      onChange={(e) =>
                        updatePref(group.id, { weekly: e.target.checked })
                      }
                      disabled={isPending}
                      className="h-4 w-4 accent-brand"
                    />
                    Weekly summary
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {message ? <p className="text-sm text-white/70">{message}</p> : null}
    </div>
  );
}

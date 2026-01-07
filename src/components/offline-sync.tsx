"use client";

import { useEffect, useState } from "react";
import { flushOfflineQueue, getOfflineQueueCount } from "@/lib/offline-queue";

type SyncState = "idle" | "syncing" | "offline";

export function OfflineSync() {
  const [state, setState] = useState<SyncState>("idle");
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const updateQueued = () => setQueuedCount(getOfflineQueueCount());
    const handleOnline = () => {
      setState("syncing");
      void flushOfflineQueue().finally(() => {
        updateQueued();
        setState("idle");
      });
    };
    const handleOffline = () => {
      updateQueued();
      setState("offline");
    };

    updateQueued();
    if (navigator.onLine) {
      void flushOfflineQueue().finally(() => {
        updateQueued();
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (state === "idle" && queuedCount === 0) {
    return null;
  }

  const label =
    state === "syncing"
      ? "Syncing changes…"
      : state === "offline"
      ? "Offline. Changes will sync when you're back online."
      : queuedCount > 0
      ? `Queued changes: ${queuedCount}`
      : null;

  if (!label) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[1100] w-[92%] max-w-md -translate-x-1/2 rounded-full border border-white/10 bg-night/90 px-4 py-2 text-center text-xs uppercase tracking-[0.3em] text-white/70 shadow-xl shadow-black/40">
      {label}
    </div>
  );
}

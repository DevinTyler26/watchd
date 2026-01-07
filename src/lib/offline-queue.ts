"use client";

type OfflineMutation = {
  id: string;
  url: string;
  init: RequestInit;
  createdAt: number;
  attempts: number;
};

const STORAGE_KEY = "watchd:offline-queue";
const MAX_ATTEMPTS = 5;

function loadQueue(): OfflineMutation[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as OfflineMutation[];
    }
  } catch {
    // Ignore parse errors.
  }
  return [];
}

function saveQueue(queue: OfflineMutation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getOfflineQueueCount() {
  return loadQueue().length;
}

export function enqueueOfflineMutation(url: string, init: RequestInit) {
  const queue = loadQueue();
  const headers =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : init.headers;
  const normalizedInit: RequestInit = {
    method: init.method ?? "POST",
    headers,
    body: typeof init.body === "string" ? init.body : undefined,
    credentials: init.credentials,
  };
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    url,
    init: normalizedInit,
    createdAt: Date.now(),
    attempts: 0,
  });
  saveQueue(queue);
}

export async function flushOfflineQueue() {
  if (typeof window === "undefined") {
    return { flushed: 0, failed: 0 };
  }
  if (navigator.onLine === false) {
    return { flushed: 0, failed: 0 };
  }

  const queue = loadQueue();
  if (queue.length === 0) {
    return { flushed: 0, failed: 0 };
  }

  const remaining: OfflineMutation[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const response = await fetch(item.url, item.init);
      if (!response.ok) {
        throw new Error("Request failed.");
      }
      flushed += 1;
    } catch {
      item.attempts += 1;
      if (item.attempts < MAX_ATTEMPTS) {
        remaining.push(item);
      } else {
        failed += 1;
      }
    }
  }

  saveQueue(remaining);
  return { flushed, failed };
}

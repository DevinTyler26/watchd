import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { apiJson, ApiError, OfflineQueuedError } from "@/lib/api-client";
import {
  flushOfflineQueue,
  getOfflineQueueCount,
} from "@/lib/offline-queue";

const originalFetch = global.fetch;
const originalOnline = navigator.onLine;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("apiJson", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setOnline(originalOnline);
  });

  it("queues offline mutations when requested", async () => {
    setOnline(false);
    global.fetch = vi.fn();

    await expect(
      apiJson("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imdbId: "123", type: "movie" }),
        queueOnOffline: true,
      })
    ).rejects.toBeInstanceOf(OfflineQueuedError);

    expect(getOfflineQueueCount()).toBe(1);
  });

  it("flushes queued mutations when back online", async () => {
    setOnline(false);
    global.fetch = vi.fn();

    await expect(
      apiJson("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imdbId: "123", type: "movie" }),
        queueOnOffline: true,
      })
    ).rejects.toBeInstanceOf(OfflineQueuedError);

    expect(getOfflineQueueCount()).toBe(1);

    setOnline(true);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await flushOfflineQueue();
    expect(result).toEqual({ flushed: 1, failed: 0 });
    expect(getOfflineQueueCount()).toBe(0);
  });

  it("surfaces request ids on error responses", async () => {
    setOnline(true);
    const headers = new Headers({ "X-Request-Id": "req-123" });
    const response = new Response(JSON.stringify({ error: "Boom" }), {
      status: 500,
      headers,
    });
    global.fetch = vi.fn().mockResolvedValue(response);

    await expect(apiJson("/api/imdb")).rejects.toMatchObject<ApiError>({
      requestId: "req-123",
      status: 500,
    });
  });
});

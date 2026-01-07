"use client";

import type { ZodSchema } from "zod";
import { enqueueOfflineMutation } from "@/lib/offline-queue";

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOn?: (response: Response | null, error: unknown) => boolean;
  queueOnOffline?: boolean;
  requestLabel?: string;
};

export class ApiError extends Error {
  status: number;
  requestId?: string | null;
  payload?: unknown;
  isNetworkError: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      requestId?: string | null;
      payload?: unknown;
      isNetworkError?: boolean;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.payload = options.payload;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

export class OfflineQueuedError extends Error {
  queued: true;

  constructor(message = "Request queued for retry.") {
    super(message);
    this.name = "OfflineQueuedError";
    this.queued = true;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryDefault(response: Response | null, error: unknown) {
  if (error) {
    return true;
  }
  if (!response) return false;
  return [429, 502, 503, 504].includes(response.status);
}

function getRetryDelayMs(
  response: Response | null,
  attempt: number,
  baseDelayMs: number
) {
  if (response) {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (!Number.isNaN(parsed)) {
        return Math.max(parsed * 1000, baseDelayMs);
      }
    }
  }
  const backoff = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 120);
  return backoff + jitter;
}

function isOffline() {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {}
) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    retryOn = shouldRetryDefault,
    queueOnOffline = false,
    requestLabel,
    ...init
  } = options;

  if (queueOnOffline && isOffline()) {
    enqueueOfflineMutation(input.toString(), init);
    throw new OfflineQueuedError(
      requestLabel
        ? `${requestLabel} queued to sync when you're back online.`
        : "Change queued to sync when you're back online."
    );
  }

  let attempt = 0;
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  while (attempt <= retries) {
    attempt += 1;
    const controller = new AbortController();
    const externalSignal = init.signal;
    let onAbort: (() => void) | null = null;
    if (externalSignal?.aborted) {
      controller.abort();
    } else if (externalSignal) {
      onAbort = () => controller.abort();
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      lastResponse = response;
      if (!response.ok) {
        if (retryOn(response, null) && attempt <= retries) {
          await sleep(getRetryDelayMs(response, attempt, retryDelayMs));
          continue;
        }
      }
      return response;
    } catch (error) {
      lastError = error;
      if (queueOnOffline && isOffline()) {
        enqueueOfflineMutation(input.toString(), init);
        throw new OfflineQueuedError(
          requestLabel
            ? `${requestLabel} queued to sync when you're back online.`
            : "Change queued to sync when you're back online."
        );
      }
      if (retryOn(null, error) && attempt <= retries) {
        await sleep(getRetryDelayMs(null, attempt, retryDelayMs));
        continue;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (externalSignal && onAbort) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("Request failed.");
}

export async function apiJson<T>(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {},
  schema?: ZodSchema<T>
) {
  let response: Response;
  try {
    response = await apiFetch(input, options);
  } catch (error) {
    if (error instanceof OfflineQueuedError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      { status: 0, isNetworkError: true }
    );
  }

  const requestId = response.headers.get("X-Request-Id");
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      "Unexpected response from server.";
    throw new ApiError(message, {
      status: response.status,
      requestId,
      payload,
    });
  }
  if (schema) {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError("Invalid response from server.", {
        status: response.status,
        requestId,
        payload,
      });
    }
    return { data: parsed.data, requestId };
  }
  return { data: payload as T, requestId };
}

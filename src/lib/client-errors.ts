"use client";

type ClientErrorPayload = {
  message: string;
  stack?: string;
  requestId?: string | null;
  context?: Record<string, unknown>;
};

export async function reportClientError(payload: ClientErrorPayload) {
  try {
    await fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort reporting only.
  }
}

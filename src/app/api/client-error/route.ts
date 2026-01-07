import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limiter = rateLimit(getRateLimitKey(request), {
    keyPrefix: "client-error",
    max: 60,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many reports. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }
  const payload = await request.json().catch(() => null);
  if (payload) {
    console.error("Client error report", payload);
  }
  return jsonResponse({ ok: true });
}

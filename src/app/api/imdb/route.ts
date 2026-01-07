import { searchTitlesCached } from "@/lib/imdb";
import { jsonResponse } from "@/lib/api-response";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limiter = await rateLimit(getRateLimitKey(request), {
    keyPrefix: "imdb:search",
    max: 60,
    intervalMs: 60_000,
  });
  if (limiter.limited) {
    const retryAfter = Math.ceil((limiter.resetAt - Date.now()) / 1000);
    return jsonResponse(
      { error: "Too many search requests. Try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const normalizedType =
    typeParam === "movie" || typeParam === "series" ? typeParam : undefined;

  if (!query || query.trim().length < 2) {
    return jsonResponse(
      { results: [], error: "Search query must be at least two characters." },
      { status: 400 }
    );
  }

  try {
    const { results, source } = await searchTitlesCached(
      query.trim(),
      normalizedType
    );
    return jsonResponse({ results, source });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, { status: 500 });
  }
}

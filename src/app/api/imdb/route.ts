import { searchTitlesCached } from "@/lib/imdb";
import { jsonResponse } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const normalizedType = typeParam === "movie" || typeParam === "series" ? typeParam : undefined;

  if (!query || query.trim().length < 2) {
    return jsonResponse(
      { results: [], error: "Search query must be at least two characters." },
      { status: 400 }
    );
  }

  try {
    const { results, source } = await searchTitlesCached(
      query.trim(),
      normalizedType,
    );
    return jsonResponse({ results, source });
  } catch (error) {
    return jsonResponse(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

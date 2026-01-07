import { prisma } from "@/lib/prisma";
import { cacheSearchResults, searchTitles, searchTitlesCached, type ImdbTitle } from "@/lib/imdb";
import { jsonResponse } from "@/lib/api-response";

type Suggestion = ImdbTitle & { source: "local" | "cache" | "prefix-cache" | "tmdb" };

function normalizeType(typeParam: string | null) {
  return typeParam === "movie" || typeParam === "series" ? typeParam : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const normalizedType = normalizeType(typeParam);

  if (!query || query.trim().length < 2) {
    return jsonResponse({ suggestions: [] });
  }

  const trimmed = query.trim();
  const localRows = await prisma.watchEntry.findMany({
    where: {
      media: {
        title: { contains: trimmed, mode: "insensitive" },
        ...(normalizedType ? { type: normalizedType } : {}),
      },
    },
    distinct: ["mediaId"],
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      media: {
        select: {
          tmdbId: true,
          title: true,
          year: true,
          type: true,
          posterUrl: true,
          plot: true,
          genre: true,
        },
      },
    },
  });

  const localSuggestions: Suggestion[] = localRows
    .map((row) => row.media)
    .filter(
      (media): media is NonNullable<typeof media> =>
        media !== null && media !== undefined,
    )
    .map((media) => ({
      imdbId: media.tmdbId,
      title: media.title,
      year: media.year ?? undefined,
      type: media.type === "series" ? "series" : "movie",
      posterUrl: media.posterUrl ?? undefined,
      plot: media.plot ?? undefined,
      genre: media.genre ?? undefined,
      source: "local",
    }));

  if (localSuggestions.length >= 8) {
    return jsonResponse({ suggestions: localSuggestions.slice(0, 8) });
  }

  let { results, source } = await searchTitlesCached(trimmed, normalizedType, {
    allowPrefix: true,
  });
  if (source === "prefix-cache" && trimmed.length >= 5 && results.length < 6) {
    try {
      results = await searchTitles(trimmed, normalizedType);
      cacheSearchResults(trimmed, normalizedType, results);
      source = "tmdb";
    } catch {
      // Fall back to prefix cache results.
    }
  }
  const seen = new Set(localSuggestions.map((item) => item.imdbId));
  const merged = [...localSuggestions];

  for (const item of results) {
    if (merged.length >= 8) break;
    if (seen.has(item.imdbId)) continue;
    merged.push({ ...item, source });
    seen.add(item.imdbId);
  }

  return jsonResponse({ suggestions: merged });
}

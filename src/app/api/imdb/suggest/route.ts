import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cacheSearchResults, searchTitles, searchTitlesCached, type ImdbTitle } from "@/lib/imdb";

type Suggestion = ImdbTitle & { source: "local" | "cache" | "prefix-cache" | "omdb" };

function normalizeType(typeParam: string | null) {
  return typeParam === "movie" || typeParam === "series" ? typeParam : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const normalizedType = normalizeType(typeParam);

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const trimmed = query.trim();
  const localRows = await prisma.watchEntry.findMany({
    where: {
      title: { contains: trimmed, mode: "insensitive" },
      ...(normalizedType ? { type: normalizedType } : {}),
    },
    distinct: ["title"],
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      imdbId: true,
      title: true,
      year: true,
      type: true,
      posterUrl: true,
    },
  });

  const localSuggestions: Suggestion[] = localRows.map((row) => ({
    imdbId: row.imdbId,
    title: row.title,
    year: row.year ?? undefined,
    type: row.type === "series" ? "series" : "movie",
    posterUrl: row.posterUrl ?? undefined,
    source: "local",
  }));

  if (localSuggestions.length >= 8) {
    return NextResponse.json({ suggestions: localSuggestions.slice(0, 8) });
  }

  let { results, source } = await searchTitlesCached(trimmed, normalizedType, {
    allowPrefix: true,
  });
  if (source === "prefix-cache" && trimmed.length >= 5 && results.length < 6) {
    try {
      results = await searchTitles(trimmed, normalizedType);
      cacheSearchResults(trimmed, normalizedType, results);
      source = "omdb";
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

  return NextResponse.json({ suggestions: merged });
}

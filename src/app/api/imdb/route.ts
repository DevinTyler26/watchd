import { NextResponse } from "next/server";
import { searchTitles } from "@/lib/imdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const normalizedType = typeParam === "movie" || typeParam === "series" ? typeParam : undefined;

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { results: [], error: "Search query must be at least two characters." },
      { status: 400 },
    );
  }

  try {
    const results = await searchTitles(query.trim(), normalizedType);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

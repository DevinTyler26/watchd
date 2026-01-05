type OmdbSearchItem = {
  imdbID: string;
  Title: string;
  Year?: string;
  Type?: string;
  Poster?: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[];
  Response: "True" | "False";
  totalResults?: string;
  Error?: string;
};

type OmdbTitleResponse = {
  imdbID: string;
  Title: string;
  Year?: string;
  Type?: string;
  Poster?: string;
  Plot?: string;
  Response: "True" | "False";
  Error?: string;
};

export type ImdbTitle = {
  imdbId: string;
  title: string;
  year?: string;
  type: "movie" | "series" | "episode";
  posterUrl?: string;
  plot?: string;
  raw?: Record<string, unknown>;
};

type CacheEntry = {
  expiresAt: number;
  results: ImdbTitle[];
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CACHE_KEYS = 200;

function getSearchCache() {
  const globalCache = globalThis as typeof globalThis & {
    omdbSearchCache?: Map<string, CacheEntry>;
  };
  if (!globalCache.omdbSearchCache) {
    globalCache.omdbSearchCache = new Map();
  }
  return globalCache.omdbSearchCache;
}

function normalizeQueryKey(query: string, type?: "movie" | "series") {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalized}::${type ?? "all"}`;
}

function getCachedEntry(key: string) {
  const cache = getSearchCache();
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCachedEntry(key: string, results: ImdbTitle[]) {
  const cache = getSearchCache();
  if (cache.size >= MAX_CACHE_KEYS) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
}

function getPrefixCachedResults(
  query: string,
  type?: "movie" | "series",
): ImdbTitle[] | null {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 3) {
    return null;
  }
  for (let i = normalized.length - 1; i >= 3; i -= 1) {
    const prefix = normalized.slice(0, i);
    const entry = getCachedEntry(normalizeQueryKey(prefix, type));
    if (!entry) {
      continue;
    }
    return entry.results.filter((item) =>
      item.title.toLowerCase().includes(normalized),
    );
  }
  return null;
}

function requireApiKey() {
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    throw new Error("Missing OMDB_API_KEY. Create one at https://www.omdbapi.com/apikey.aspx");
  }
  return key;
}

export function normalizeType(type?: string | null): ImdbTitle["type"] {
  if (type === "movie" || type === "series" || type === "episode") {
    return type;
  }
  return "movie";
}

function toTitle(payload: OmdbTitleResponse | OmdbSearchItem): ImdbTitle {
  return {
    imdbId: payload.imdbID,
    title: payload.Title,
    year: payload.Year,
    posterUrl: payload.Poster && payload.Poster !== "N/A" ? payload.Poster : undefined,
    type: normalizeType(payload.Type),
    plot: "Plot" in payload ? payload.Plot : undefined,
    raw: "Response" in payload ? (payload as Record<string, unknown>) : undefined,
  };
}

export async function searchTitles(query: string, type?: "movie" | "series") {
  const key = requireApiKey();
  const params = new URLSearchParams({
    apikey: key,
    s: query,
  });

  if (type) {
    params.set("type", type);
  }

  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to reach OMDb right now. Please try again later.");
  }
  const data = (await response.json()) as OmdbSearchResponse;

  if (data.Response === "False") {
    return [];
  }

  return (data.Search ?? []).map(toTitle);
}

export async function searchTitlesCached(
  query: string,
  type?: "movie" | "series",
  options?: { allowPrefix?: boolean },
) {
  const key = normalizeQueryKey(query, type);
  const cached = getCachedEntry(key);
  if (cached) {
    return { results: cached.results, source: "cache" as const };
  }
  if (options?.allowPrefix) {
    const prefixHits = getPrefixCachedResults(query, type);
    if (prefixHits) {
      return { results: prefixHits, source: "prefix-cache" as const };
    }
  }
  const results = await searchTitles(query, type);
  setCachedEntry(key, results);
  return { results, source: "omdb" as const };
}

export function cacheSearchResults(
  query: string,
  type: "movie" | "series" | undefined,
  results: ImdbTitle[]
) {
  const key = normalizeQueryKey(query, type);
  setCachedEntry(key, results);
}

export async function fetchTitleById(imdbId: string): Promise<ImdbTitle | null> {
  const key = requireApiKey();
  const params = new URLSearchParams({ apikey: key, i: imdbId, plot: "short" });
  const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to reach OMDb right now. Please try again later.");
  }
  const data = (await response.json()) as OmdbTitleResponse;

  if (data.Response === "False") {
    return null;
  }

  return { ...toTitle(data), raw: data as Record<string, unknown> };
}

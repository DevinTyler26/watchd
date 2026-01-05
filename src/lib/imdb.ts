type TmdbSearchResult = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

type TmdbMovieResponse = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type TmdbTvResponse = {
  id: number;
  name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
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
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function getSearchCache() {
  const globalCache = globalThis as typeof globalThis & {
    tmdbSearchCache?: Map<string, CacheEntry>;
  };
  if (!globalCache.tmdbSearchCache) {
    globalCache.tmdbSearchCache = new Map();
  }
  return globalCache.tmdbSearchCache;
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
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      "Missing TMDB_API_KEY. Create one at https://www.themoviedb.org/settings/api",
    );
  }
  return key;
}

export function normalizeType(type?: string | null): ImdbTitle["type"] {
  if (type === "movie" || type === "series" || type === "episode") {
    return type;
  }
  if (type === "tv") {
    return "series";
  }
  return "movie";
}

function getYear(date?: string | null) {
  if (!date) {
    return undefined;
  }
  const year = date.split("-")[0];
  return /^\d{4}$/.test(year) ? year : undefined;
}

function buildPosterUrl(path?: string | null) {
  return path ? `${TMDB_IMAGE_BASE}${path}` : undefined;
}

function toMovieTitle(payload: TmdbMovieResponse | TmdbSearchResult): ImdbTitle | null {
  const title = payload.title;
  if (!title) {
    return null;
  }
  return {
    imdbId: String(payload.id),
    title,
    year: getYear(payload.release_date),
    type: "movie",
    posterUrl: buildPosterUrl(payload.poster_path),
    plot: payload.overview,
    raw: payload as Record<string, unknown>,
  };
}

function toSeriesTitle(payload: TmdbTvResponse | TmdbSearchResult): ImdbTitle | null {
  const title = payload.name;
  if (!title) {
    return null;
  }
  return {
    imdbId: String(payload.id),
    title,
    year: getYear(payload.first_air_date),
    type: "series",
    posterUrl: buildPosterUrl(payload.poster_path),
    plot: payload.overview,
    raw: payload as Record<string, unknown>,
  };
}

async function fetchTmdb(path: string, params: URLSearchParams) {
  const response = await fetch(`${TMDB_BASE_URL}${path}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { response, data: data as Record<string, unknown> };
}

export async function searchTitles(query: string, type?: "movie" | "series") {
  const key = requireApiKey();
  const params = new URLSearchParams({
    api_key: key,
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });

  const path =
    type === "movie"
      ? "/search/movie"
      : type === "series"
      ? "/search/tv"
      : "/search/multi";

  const { response, data } = await fetchTmdb(path, params);
  if (!response.ok) {
    throw new Error("Unable to reach TMDB right now. Please try again later.");
  }

  const results = Array.isArray((data as TmdbSearchResponse).results)
    ? ((data as TmdbSearchResponse).results as TmdbSearchResult[])
    : [];

  const titles: ImdbTitle[] = [];
  for (const result of results) {
    const mediaType =
      type === "movie"
        ? "movie"
        : type === "series"
        ? "tv"
        : result.media_type;

    if (mediaType === "movie") {
      const title = toMovieTitle(result);
      if (title) {
        titles.push(title);
      }
    } else if (mediaType === "tv") {
      const title = toSeriesTitle(result);
      if (title) {
        titles.push(title);
      }
    }
  }

  return titles;
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
  return { results, source: "tmdb" as const };
}

export function cacheSearchResults(
  query: string,
  type: "movie" | "series" | undefined,
  results: ImdbTitle[],
) {
  const key = normalizeQueryKey(query, type);
  setCachedEntry(key, results);
}

export async function fetchTitleById(
  imdbId: string,
  type?: "movie" | "series",
): Promise<ImdbTitle | null> {
  const key = requireApiKey();
  const id = Number(imdbId);
  if (!Number.isFinite(id)) {
    return null;
  }

  const params = new URLSearchParams({
    api_key: key,
    language: "en-US",
  });

  const paths =
    type === "movie"
      ? ["/movie"]
      : type === "series"
      ? ["/tv"]
      : ["/movie", "/tv"];

  for (const base of paths) {
    const { response, data } = await fetchTmdb(`${base}/${id}`, params);
    if (response.ok) {
      const title =
        base === "/movie"
          ? toMovieTitle(data as TmdbMovieResponse)
          : toSeriesTitle(data as TmdbTvResponse);
      return title ?? null;
    }
    if (response.status !== 404) {
      throw new Error("Unable to reach TMDB right now. Please try again later.");
    }
  }

  return null;
}

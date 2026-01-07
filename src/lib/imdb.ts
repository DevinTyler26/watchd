import { redisGetJson, redisSetJson } from "@/lib/redis-client";

type TmdbSearchResult = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  genre_ids?: number[];
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbMovieResponse = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  runtime?: number | null;
  genres?: TmdbGenre[];
};

type TmdbTvResponse = {
  id: number;
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  genres?: TmdbGenre[];
  in_production?: boolean;
  episode_run_time?: number[];
  number_of_seasons?: number;
};

type TmdbWatchProvider = {
  provider_name?: string;
};

type TmdbWatchProviderRegion = {
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
};

type TmdbWatchProviderResponse = {
  results?: Record<string, TmdbWatchProviderRegion>;
};

type TmdbVideo = {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
};

type TmdbVideoResponse = {
  results?: TmdbVideo[];
};

export type ImdbTitle = {
  imdbId: string;
  title: string;
  year?: string;
  type: "movie" | "series" | "episode";
  posterUrl?: string;
  plot?: string;
  genre?: string;
  inProduction?: boolean;
  watchProviders?: string[];
  runtimeMinutes?: number;
  seasonCount?: number;
  trailerUrl?: string;
};

type CacheEntry = {
  expiresAt: number;
  results: ImdbTitle[];
};

const CACHE_TTL_MS = 1000 * 60 * 60;
const MAX_CACHE_KEYS = 200;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const SEARCH_DETAIL_LIMIT = 100;
const GENRE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_WATCH_REGION = "US";
const REDIS_SEARCH_PREFIX = "imdb:search";

function getSearchCache() {
  const globalCache = globalThis as typeof globalThis & {
    tmdbSearchCache?: Map<string, CacheEntry>;
  };
  if (!globalCache.tmdbSearchCache) {
    globalCache.tmdbSearchCache = new Map();
  }
  return globalCache.tmdbSearchCache;
}

function getGenreCache() {
  const globalCache = globalThis as typeof globalThis & {
    tmdbGenreCache?: {
      expiresAt: number;
      movie: Record<number, string>;
      tv: Record<number, string>;
    };
  };
  if (!globalCache.tmdbGenreCache) {
    globalCache.tmdbGenreCache = {
      expiresAt: 0,
      movie: {},
      tv: {},
    };
  }
  return globalCache.tmdbGenreCache;
}

function normalizeQueryKey(query: string, type?: "movie" | "series") {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalized}::${type ?? "all"}`;
}

function getRedisSearchKey(key: string) {
  return `${REDIS_SEARCH_PREFIX}:${key}`;
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

async function getSharedCachedEntry(key: string) {
  return redisGetJson<ImdbTitle[]>(getRedisSearchKey(key));
}

async function setSharedCachedEntry(key: string, results: ImdbTitle[]) {
  await redisSetJson(getRedisSearchKey(key), results, CACHE_TTL_MS);
}

function getPrefixCachedResults(
  query: string,
  type?: "movie" | "series"
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
      item.title.toLowerCase().includes(normalized)
    );
  }
  return null;
}

function requireApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error(
      "Missing TMDB_API_KEY. Create one at https://www.themoviedb.org/settings/api"
    );
  }
  return key;
}

function getWatchRegion() {
  const region = process.env.TMDB_WATCH_REGION?.trim().toUpperCase();
  return region && region.length === 2 ? region : DEFAULT_WATCH_REGION;
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

function getYearRange(
  start?: string | null,
  end?: string | null,
  inProduction?: boolean
) {
  const startYear = getYear(start);
  if (!startYear) {
    return undefined;
  }
  if (inProduction) {
    return `${startYear}–`;
  }
  const endYear = getYear(end);
  if (!endYear) {
    return `${startYear}–`;
  }
  if (endYear === startYear) {
    return startYear;
  }
  return `${startYear}–${endYear}`;
}

function getRuntimeMinutes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function getEpisodeRuntimeMinutes(payload: TmdbTvResponse | TmdbSearchResult) {
  if (
    "episode_run_time" in payload &&
    Array.isArray(payload.episode_run_time)
  ) {
    const runtime = payload.episode_run_time.find(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value > 0
    );
    return getRuntimeMinutes(runtime);
  }
  return undefined;
}

function getSeasonCount(payload: TmdbTvResponse | TmdbSearchResult) {
  if ("number_of_seasons" in payload) {
    const count = payload.number_of_seasons;
    if (typeof count === "number" && Number.isFinite(count) && count > 0) {
      return Math.round(count);
    }
  }
  return undefined;
}

function buildPosterUrl(path?: string | null) {
  return path ? `${TMDB_IMAGE_BASE}${path}` : undefined;
}

function extractGenreFromPayload(payload: { genres?: TmdbGenre[] }) {
  const genre = payload.genres?.find((item) => item?.name)?.name;
  return genre ?? undefined;
}

function getGenreFromIds(
  ids: number[] | undefined,
  map: Record<number, string>
) {
  if (!ids?.length) {
    return undefined;
  }
  for (const id of ids) {
    if (map[id]) {
      return map[id];
    }
  }
  return undefined;
}

function extractWatchProviders(region?: TmdbWatchProviderRegion | null) {
  if (!region) {
    return [];
  }
  const buckets: Array<keyof TmdbWatchProviderRegion> = [
    "flatrate",
    "free",
    "ads",
    "rent",
    "buy",
  ];
  const seen = new Set<string>();
  const providers: string[] = [];
  for (const bucket of buckets) {
    const entries = region[bucket] ?? [];
    for (const entry of entries) {
      const name = entry?.provider_name?.trim();
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      providers.push(name);
    }
  }
  return providers;
}

function toMovieTitle(
  payload: TmdbMovieResponse | TmdbSearchResult,
  genreName?: string
): ImdbTitle | null {
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
    genre: genreName ?? extractGenreFromPayload(payload as TmdbMovieResponse),
    runtimeMinutes: getRuntimeMinutes(
      (payload as TmdbMovieResponse).runtime ?? null
    ),
  };
}

function toSeriesTitle(
  payload: TmdbTvResponse | TmdbSearchResult,
  genreName?: string
): ImdbTitle | null {
  const title = payload.name;
  if (!title) {
    return null;
  }
  return {
    imdbId: String(payload.id),
    title,
    year:
      "last_air_date" in payload
        ? getYearRange(
            payload.first_air_date,
            payload.last_air_date,
            (payload as { in_production?: boolean }).in_production
          )
        : getYear(payload.first_air_date),
    type: "series",
    posterUrl: buildPosterUrl(payload.poster_path),
    plot: payload.overview,
    genre: genreName ?? extractGenreFromPayload(payload as TmdbTvResponse),
    inProduction:
      (payload as { in_production?: boolean }).in_production ?? false,
    runtimeMinutes: getEpisodeRuntimeMinutes(payload),
    seasonCount: getSeasonCount(payload),
  };
}

async function fetchTmdb(path: string, params: URLSearchParams) {
  const response = await fetch(`${TMDB_BASE_URL}${path}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { response, data: data as Record<string, unknown> };
}

async function fetchWatchProviders(
  id: number,
  type: "movie" | "tv"
): Promise<string[] | null> {
  const key = requireApiKey();
  const params = new URLSearchParams({ api_key: key });
  const { response, data } = await fetchTmdb(
    `/${type}/${id}/watch/providers`,
    params
  );
  if (!response.ok) {
    return null;
  }
  const regionKey = getWatchRegion();
  const region = (data as TmdbWatchProviderResponse).results?.[regionKey];
  return extractWatchProviders(region);
}

function toTrailerUrl(payload: TmdbVideoResponse) {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const trailer = results.find(
    (video) =>
      video && video.site === "YouTube" && video.type === "Trailer" && video.key
  );
  const fallback = results.find(
    (video) => video && video.site === "YouTube" && video.key
  );
  const selected = trailer ?? fallback;
  return selected?.key
    ? `https://www.youtube.com/watch?v=${selected.key}`
    : undefined;
}

async function getGenreMaps() {
  const cache = getGenreCache();
  if (Date.now() < cache.expiresAt) {
    return cache;
  }
  const key = requireApiKey();
  const params = new URLSearchParams({ api_key: key, language: "en-US" });
  const [movieResponse, tvResponse] = await Promise.all([
    fetchTmdb("/genre/movie/list", params),
    fetchTmdb("/genre/tv/list", params),
  ]);

  if (!movieResponse.response.ok || !tvResponse.response.ok) {
    return cache;
  }

  const movieGenres = Array.isArray(
    (movieResponse.data as { genres?: TmdbGenre[] }).genres
  )
    ? ((movieResponse.data as { genres?: TmdbGenre[] }).genres as TmdbGenre[])
    : [];
  const tvGenres = Array.isArray(
    (tvResponse.data as { genres?: TmdbGenre[] }).genres
  )
    ? ((tvResponse.data as { genres?: TmdbGenre[] }).genres as TmdbGenre[])
    : [];

  cache.movie = Object.fromEntries(
    movieGenres.map((genre) => [genre.id, genre.name])
  );
  cache.tv = Object.fromEntries(
    tvGenres.map((genre) => [genre.id, genre.name])
  );
  cache.expiresAt = Date.now() + GENRE_CACHE_TTL_MS;
  return cache;
}

async function enrichSeriesTitles(titles: ImdbTitle[]) {
  const seriesIndexes: number[] = [];
  for (let i = 0; i < titles.length; i += 1) {
    if (seriesIndexes.length >= SEARCH_DETAIL_LIMIT) {
      break;
    }
    if (titles[i]?.type === "series") {
      seriesIndexes.push(i);
    }
  }
  if (!seriesIndexes.length) {
    return titles;
  }

  const enriched = [...titles];
  await Promise.all(
    seriesIndexes.map(async (index) => {
      const item = titles[index];
      try {
        const detail = await fetchTitleById(item.imdbId, "series");
        if (detail) {
          enriched[index] = detail;
        }
      } catch {
        // Keep the search result if TMDB detail fetch fails.
      }
    })
  );

  return enriched;
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

  const genreMaps = await getGenreMaps();
  const titles: ImdbTitle[] = [];
  for (const result of results) {
    const mediaType =
      type === "movie" ? "movie" : type === "series" ? "tv" : result.media_type;

    if (mediaType === "movie") {
      const genreName = getGenreFromIds(result.genre_ids, genreMaps.movie);
      const title = toMovieTitle(result, genreName);
      if (title) {
        titles.push(title);
      }
    } else if (mediaType === "tv") {
      const genreName = getGenreFromIds(result.genre_ids, genreMaps.tv);
      const title = toSeriesTitle(result, genreName);
      if (title) {
        titles.push(title);
      }
    }
  }

  if (type === "movie") {
    return titles;
  }
  return enrichSeriesTitles(titles);
}

export async function searchTitlesCached(
  query: string,
  type?: "movie" | "series",
  options?: { allowPrefix?: boolean }
) {
  const key = normalizeQueryKey(query, type);
  const cached = getCachedEntry(key);
  if (cached) {
    return { results: cached.results, source: "cache" as const };
  }
  const shared = await getSharedCachedEntry(key);
  if (shared) {
    setCachedEntry(key, shared);
    return { results: shared, source: "cache" as const };
  }
  if (options?.allowPrefix) {
    const prefixHits = getPrefixCachedResults(query, type);
    if (prefixHits) {
      return { results: prefixHits, source: "prefix-cache" as const };
    }
  }
  const results = await searchTitles(query, type);
  setCachedEntry(key, results);
  await setSharedCachedEntry(key, results);
  return { results, source: "tmdb" as const };
}

export function cacheSearchResults(
  query: string,
  type: "movie" | "series" | undefined,
  results: ImdbTitle[]
) {
  const key = normalizeQueryKey(query, type);
  setCachedEntry(key, results);
  void setSharedCachedEntry(key, results);
}

export async function fetchTitleById(
  imdbId: string,
  type?: "movie" | "series"
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
      if (!title) {
        return null;
      }
      const mediaType = base === "/movie" ? "movie" : "tv";
      const [providers, trailerData] = await Promise.all([
        fetchWatchProviders(id, mediaType),
        fetchTmdb(`/${mediaType}/${id}/videos`, params),
      ]);
      const trailerUrl = trailerData.response.ok
        ? toTrailerUrl(trailerData.data as TmdbVideoResponse)
        : undefined;
      const nextTitle: ImdbTitle = {
        ...title,
        ...(providers ? { watchProviders: providers } : {}),
        ...(trailerUrl ? { trailerUrl } : {}),
      };
      return nextTitle;
    }
    if (response.status !== 404) {
      throw new Error(
        "Unable to reach TMDB right now. Please try again later."
      );
    }
  }

  return null;
}

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

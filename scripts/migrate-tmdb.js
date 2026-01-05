#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Set it in your environment or .env file.",
    );
  }
  return url;
}

function parseArgs(argv) {
  const args = { dryRun: false, all: false, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--limit") {
      const value = argv[i + 1];
      i += 1;
      if (value && !Number.isNaN(Number(value))) {
        args.limit = Number(value);
      }
    } else if (arg.startsWith("--limit=")) {
      const value = arg.split("=")[1];
      if (value && !Number.isNaN(Number(value))) {
        args.limit = Number(value);
      }
    } else if (arg === "--help" || arg === "-h") {
      return { ...args, help: true };
    }
  }
  return args;
}

function getYear(date) {
  if (!date) return undefined;
  const year = String(date).split("-")[0];
  return /^\d{4}$/.test(year) ? year : undefined;
}

function buildPosterUrl(pathValue) {
  return pathValue ? `${TMDB_IMAGE_BASE}${pathValue}` : null;
}

async function tmdbFetch(pathname, params) {
  const response = await fetch(`${TMDB_BASE_URL}${pathname}?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function findTmdbMatch(tmdbKey, imdbId, entryType) {
  const params = new URLSearchParams({
    api_key: tmdbKey,
    external_source: "imdb_id",
    language: "en-US",
  });
  const { response, data } = await tmdbFetch(`/find/${encodeURIComponent(imdbId)}`, params);
  if (!response.ok) {
    throw new Error(`TMDB find failed (${response.status})`);
  }

  const movieResults = Array.isArray(data.movie_results) ? data.movie_results : [];
  const tvResults = Array.isArray(data.tv_results) ? data.tv_results : [];

  if (entryType === "series" && tvResults[0]) {
    return { type: "series", result: tvResults[0] };
  }
  if (entryType === "movie" && movieResults[0]) {
    return { type: "movie", result: movieResults[0] };
  }
  if (movieResults[0]) {
    return { type: "movie", result: movieResults[0] };
  }
  if (tvResults[0]) {
    return { type: "series", result: tvResults[0] };
  }
  return null;
}

async function fetchDetails(tmdbKey, tmdbId, type) {
  const params = new URLSearchParams({
    api_key: tmdbKey,
    language: "en-US",
  });
  const endpoint = type === "series" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const { response, data } = await tmdbFetch(endpoint, params);
  if (!response.ok) {
    throw new Error(`TMDB details failed (${response.status})`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/migrate-tmdb.js [--dry-run] [--all] [--limit N]");
    console.log("  --dry-run  Print changes without writing to the database.");
    console.log("  --all      Process all watch entries, not just IMDb (tt...) IDs.");
    console.log("  --limit N  Limit how many entries to process.");
    return;
  }

  loadEnv();

  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    throw new Error("TMDB_API_KEY is missing. Set it in your environment or .env file.");
  }

  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;
  let failed = 0;

  try {
    const where = args.all
      ? {}
      : { imdbId: { startsWith: "tt" } };

    const entries = await prisma.watchEntry.findMany({
      where,
      orderBy: { createdAt: "asc" },
      ...(args.limit ? { take: args.limit } : {}),
      select: {
        id: true,
        imdbId: true,
        title: true,
        type: true,
        groupId: true,
        userId: true,
      },
    });

    console.log(`Found ${entries.length} entries to process.`);

    for (const entry of entries) {
      processed += 1;
      try {
        const match = await findTmdbMatch(tmdbKey, entry.imdbId, entry.type === "series" ? "series" : "movie");
        if (!match) {
          skipped += 1;
          console.log(`[skip] ${entry.imdbId} (${entry.title}) - no TMDB match`);
          continue;
        }

        const tmdbId = String(match.result.id);
        const details = await fetchDetails(tmdbKey, tmdbId, match.type);
        const title = match.type === "series" ? details.name : details.title;
        const dateValue = match.type === "series" ? details.first_air_date : details.release_date;
        const year = getYear(dateValue) ?? null;
        const posterUrl = buildPosterUrl(details.poster_path ?? match.result.poster_path);

        const data = {
          imdbId: tmdbId,
          title: title ?? entry.title,
          year,
          type: match.type,
          posterUrl,
          omdb: details,
        };

        if (args.dryRun) {
          updated += 1;
          console.log(`[dry-run] ${entry.imdbId} -> ${tmdbId} (${data.title})`);
          continue;
        }

        try {
          await prisma.watchEntry.update({
            where: { id: entry.id },
            data,
          });
          updated += 1;
          console.log(`[ok] ${entry.imdbId} -> ${tmdbId} (${data.title})`);
        } catch (error) {
          if (error && error.code === "P2002") {
            conflicts += 1;
            console.log(`[conflict] ${entry.imdbId} -> ${tmdbId} (unique constraint)`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`[error] ${entry.imdbId} (${entry.title}) - ${message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("---");
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Conflicts: ${conflicts}`);
  console.log(`Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

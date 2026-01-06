#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

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
    throw new Error("DATABASE_URL is missing. Set it in your environment or .env file.");
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

function getYearRange(start, end, inProduction) {
  const startYear = getYear(start);
  if (!startYear) return undefined;
  if (inProduction) return `${startYear}–`;
  const endYear = getYear(end);
  if (!endYear) return `${startYear}–`;
  if (endYear === startYear) return startYear;
  return `${startYear}–${endYear}`;
}

function extractLegacyPlot(omdb) {
  if (!omdb || typeof omdb !== "object" || Array.isArray(omdb)) return null;
  if (typeof omdb.overview === "string") return omdb.overview;
  if (typeof omdb.Plot === "string") return omdb.Plot;
  return null;
}

function extractLegacyGenre(omdb) {
  if (!omdb || typeof omdb !== "object" || Array.isArray(omdb)) return null;
  if (Array.isArray(omdb.genres)) {
    const genre = omdb.genres.find((item) => item && typeof item.name === "string");
    if (genre && typeof genre.name === "string") return genre.name;
  }
  if (typeof omdb.Genre === "string") {
    return omdb.Genre.split(",")[0]?.trim() || null;
  }
  return null;
}

function buildPosterUrl(pathValue) {
  if (!pathValue || typeof pathValue !== "string") return null;
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/")) {
    return `https://image.tmdb.org/t/p/w500${pathValue}`;
  }
  return pathValue;
}

function inferType(entry) {
  if (entry.type === "series" || entry.type === "movie") return entry.type;
  const omdbType = entry.omdb?.Type ?? entry.omdb?.media_type;
  if (omdbType === "tv") return "series";
  if (omdbType === "series" || omdbType === "movie") return omdbType;
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/migrate-media-core.js [--dry-run] [--all] [--limit N]");
    console.log("  --dry-run  Print changes without writing to the database.");
    console.log("  --all      Process all watch entries, not just ones missing mediaId.");
    console.log("  --limit N  Limit how many entries to process.");
    return;
  }

  loadEnv();

  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const entries = await prisma.watchEntry.findMany({
      where: args.all ? {} : { mediaId: null },
      orderBy: { createdAt: "asc" },
      ...(args.limit ? { take: args.limit } : {}),
      select: {
        id: true,
        imdbId: true,
        title: true,
        year: true,
        posterUrl: true,
        type: true,
        omdb: true,
      },
    });

    console.log(`Found ${entries.length} entries to process.`);

    for (const entry of entries) {
      processed += 1;
      try {
        if (!entry.imdbId) {
          skipped += 1;
          console.log(`[skip] ${entry.id} missing tmdbId`);
          continue;
        }

        const mediaType = inferType(entry);
        if (!mediaType) {
          skipped += 1;
          console.log(`[skip] ${entry.imdbId} missing media type`);
          continue;
        }

        const plot = extractLegacyPlot(entry.omdb);
        const genre = extractLegacyGenre(entry.omdb);
        const inProduction = entry.omdb?.in_production === true;
        const year =
          entry.year ??
          getYearRange(
            entry.omdb?.first_air_date,
            entry.omdb?.last_air_date,
            inProduction
          ) ??
          getYear(entry.omdb?.release_date) ??
          getYear(entry.omdb?.first_air_date) ??
          null;

        const mediaData = {
          tmdbId: entry.imdbId,
          type: mediaType,
          title: entry.title ?? entry.omdb?.title ?? entry.omdb?.name ?? "Untitled",
          year,
          posterUrl:
            entry.posterUrl ??
            buildPosterUrl(entry.omdb?.poster_path ?? entry.omdb?.Poster) ??
            null,
          plot,
          genre,
          inProduction,
        };

        if (args.dryRun) {
          updated += 1;
          console.log(`[dry-run] ${entry.imdbId} -> media (${mediaType})`);
          continue;
        }

        const media = await prisma.media.upsert({
          where: { tmdbId_type: { tmdbId: mediaData.tmdbId, type: mediaData.type } },
          update: mediaData,
          create: mediaData,
          select: { id: true },
        });

        await prisma.watchEntry.update({
          where: { id: entry.id },
          data: { mediaId: media.id },
        });

        updated += 1;
        console.log(`[ok] ${entry.imdbId} -> media (${mediaType})`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`[error] ${entry.imdbId ?? entry.id} - ${message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("---");
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

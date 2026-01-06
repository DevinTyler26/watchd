#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_REGION = "US";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

function parseArgs(argv) {
  const args = new Set(argv);
  const getValue = (flag, fallback) => {
    const index = argv.indexOf(flag);
    if (index === -1 || index + 1 >= argv.length) return fallback;
    return argv[index + 1];
  };
  return {
    dryRun: args.has("--dry-run"),
    force: args.has("--force"),
    limit: Number(getValue("--limit", "0")) || 0,
    sleepMs: Number(getValue("--sleep", "200")) || 0,
  };
}

function requireApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("Missing TMDB_API_KEY in environment.");
  }
  return key;
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL in environment.");
  }
  return url;
}

function getRegion() {
  const region = process.env.TMDB_WATCH_REGION?.trim().toUpperCase();
  return region && region.length === 2 ? region : DEFAULT_REGION;
}

async function fetchWatchProviders(tmdbId, type, apiKey, region) {
  const endpoint = `${TMDB_BASE_URL}/${type}/${tmdbId}/watch/providers`;
  const response = await fetch(`${endpoint}?api_key=${apiKey}`);
  if (!response.ok) {
    return null;
  }
  const payload = await response.json().catch(() => ({}));
  const regionEntry = payload?.results?.[region];
  if (!regionEntry) {
    return [];
  }

  const buckets = ["flatrate", "free", "ads", "rent", "buy"];
  const seen = new Set();
  const providers = [];
  for (const bucket of buckets) {
    const entries = regionEntry[bucket] ?? [];
    for (const entry of entries) {
      const name = entry?.provider_name?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      providers.push(name);
    }
  }
  return providers;
}

async function main() {
  loadEnv();
  const { dryRun, force, limit, sleepMs } = parseArgs(process.argv.slice(2));
  const apiKey = requireApiKey();
  const region = getRegion();
  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let cursor = undefined;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const batchSize = 50;

  try {
    while (true) {
      const mediaRows = await prisma.media.findMany({
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, tmdbId: true, type: true, watchProviders: true },
      });

      if (!mediaRows.length) break;
      for (const media of mediaRows) {
        if (limit && processed >= limit) break;
        processed += 1;
        cursor = media.id;

        const hasProviders = Array.isArray(media.watchProviders) && media.watchProviders.length > 0;
        if (hasProviders && !force) {
          skipped += 1;
          continue;
        }

        const type = media.type === "series" ? "tv" : "movie";
        let providers = null;
        try {
          providers = await fetchWatchProviders(media.tmdbId, type, apiKey, region);
        } catch {
          providers = null;
        }

        if (providers === null) {
          failed += 1;
          continue;
        }

        if (!dryRun) {
          await prisma.media.update({
            where: { id: media.id },
            data: { watchProviders: providers },
          });
        }

        updated += 1;

        if (sleepMs) {
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
      }

      if (limit && processed >= limit) break;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("---");
  console.log(`Region: ${region}`);
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(dryRun ? "Dry run only (no changes written)." : "Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

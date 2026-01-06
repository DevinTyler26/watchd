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
    if (!prisma.watchEntry || !prisma.media) {
      console.log("Prisma client is not initialized for WatchEntry/Media.");
      return;
    }

    if (!args.all) {
      console.log("Legacy columns are removed. Backfill is no longer required.");
      console.log("Use --all only if you intentionally want to re-link all entries.");
      return;
    }

    const entries = await prisma.watchEntry.findMany({
      where: {},
      orderBy: { createdAt: "asc" },
      ...(args.limit ? { take: args.limit } : {}),
      select: {
        id: true,
        mediaId: true,
      },
    });

    console.log(`Found ${entries.length} entries to process.`);

    for (const entry of entries) {
      processed += 1;
      try {
        if (args.dryRun) {
          updated += 1;
          console.log(`[dry-run] ${entry.id} already linked: ${entry.mediaId}`);
          continue;
        }

        if (!entry.mediaId) {
          skipped += 1;
          console.log(`[skip] ${entry.id} missing mediaId`);
          continue;
        }
        updated += 1;
        console.log(`[ok] ${entry.id} already linked: ${entry.mediaId}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        console.log(`[error] ${entry.id} - ${message}`);
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

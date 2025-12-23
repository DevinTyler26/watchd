import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Update your .env file so Prisma can connect to Postgres.",
    );
  }
  return url;
}

declare global {
  var prisma: PrismaClient | undefined;
  var prismaPool: Pool | undefined;
}

function getPool() {
  if (globalThis.prismaPool) {
    return globalThis.prismaPool;
  }

  const pool = new Pool({ connectionString: requireDatabaseUrl() });

  if (process.env.NODE_ENV !== "production") {
    globalThis.prismaPool = pool;
  }

  return pool;
}

const adapter = new PrismaPg(getPool());

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

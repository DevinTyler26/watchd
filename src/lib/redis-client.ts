import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

export type RedisClient =
  | { kind: "upstash"; client: UpstashRedis }
  | { kind: "ioredis"; client: IORedis };

let redisClient: RedisClient | null = null;
let redisUnavailableUntil: number | null = null;
const REDIS_BACKOFF_MS = 30_000;

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (
    process.env.RATE_LIMIT_DEBUG !== "1" &&
    process.env.REDIS_DEBUG !== "1"
  ) {
    return;
  }
  if (meta) {
    console.log(`[redis] ${message}`, meta);
  } else {
    console.log(`[redis] ${message}`);
  }
}

export function getRedisClient(): RedisClient | null {
  if (redisUnavailableUntil && Date.now() < redisUnavailableUntil) {
    debugLog("redis unavailable, using fallback");
    return null;
  }
  if (redisClient) return redisClient;

  const redisUrl =
    process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? null;
  if (!redisUrl) {
    debugLog("REDIS_URL not set, using fallback");
    return null;
  }

  if (redisUrl.startsWith("http")) {
    const token =
      process.env.REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
    if (!token) {
      debugLog("Upstash token missing, using fallback");
      return null;
    }
    redisClient = {
      kind: "upstash",
      client: new UpstashRedis({ url: redisUrl, token }),
    };
    debugLog("using upstash redis");
    return redisClient;
  }

  if (redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")) {
    const client = new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: null,
    });
    client.on("error", (error) => {
      debugLog("ioredis error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    redisClient = { kind: "ioredis", client };
    debugLog("using ioredis");
    return redisClient;
  }

  debugLog("unsupported REDIS_URL scheme, using fallback");
  return null;
}

export function markRedisFailure(error?: unknown, context?: string) {
  redisUnavailableUntil = Date.now() + REDIS_BACKOFF_MS;
  debugLog("redis error, backing off", {
    context,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function ensureRedisConnected(redis: RedisClient) {
  if (redis.kind === "ioredis" && redis.client.status !== "ready") {
    await redis.client.connect();
  }
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    await ensureRedisConnected(redis);
    const value =
      redis.kind === "upstash"
        ? await redis.client.get<string>(key)
        : await redis.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    markRedisFailure(error, "get");
    return null;
  }
}

export async function redisSetJson(
  key: string,
  value: unknown,
  ttlMs: number
) {
  const redis = getRedisClient();
  if (!redis) return;
  const payload = JSON.stringify(value);
  try {
    await ensureRedisConnected(redis);
    if (redis.kind === "upstash") {
      await redis.client.set(key, payload, { px: ttlMs });
    } else {
      await redis.client.set(key, payload, "PX", ttlMs);
    }
  } catch (error) {
    markRedisFailure(error, "set");
  }
}

export async function redisDelete(key: string) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await ensureRedisConnected(redis);
    if (redis.kind === "upstash") {
      await redis.client.del(key);
    } else {
      await redis.client.del(key);
    }
  } catch (error) {
    markRedisFailure(error, "del");
  }
}

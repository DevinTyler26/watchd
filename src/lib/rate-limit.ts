import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

type RateLimitConfig = {
  max: number;
  intervalMs: number;
  keyPrefix?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RedisClient =
  | { kind: "upstash"; client: UpstashRedis }
  | { kind: "ioredis"; client: IORedis };

let redisClient: RedisClient | null = null;
let redisUnavailableUntil: number | null = null;
const REDIS_BACKOFF_MS = 30_000;

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    watchdRateLimitStore?: Map<string, RateLimitEntry>;
  };
  if (!globalStore.watchdRateLimitStore) {
    globalStore.watchdRateLimitStore = new Map();
  }
  return globalStore.watchdRateLimitStore;
}

export function getRateLimitKey(request: Request, userId?: string | null) {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return `ip:${ip ?? "unknown"}`;
}

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (process.env.RATE_LIMIT_DEBUG !== "1") return;
  if (meta) {
    console.log(`[rate-limit] ${message}`, meta);
  } else {
    console.log(`[rate-limit] ${message}`);
  }
}

function getRedisClient(): RedisClient | null {
  if (redisUnavailableUntil && Date.now() < redisUnavailableUntil) {
    debugLog("redis unavailable, using in-memory");
    return null;
  }
  if (redisClient) return redisClient;

  const redisUrl =
    process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? null;
  if (!redisUrl) {
    debugLog("REDIS_URL not set, using in-memory");
    return null;
  }

  if (redisUrl.startsWith("http")) {
    const token =
      process.env.REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
    if (!token) {
      debugLog("Upstash token missing, using in-memory");
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
    });
    redisClient = { kind: "ioredis", client };
    debugLog("using ioredis");
    return redisClient;
  }

  debugLog("unsupported REDIS_URL scheme, using in-memory");
  return null;
}

async function rateLimitWithRedis(
  redis: RedisClient,
  key: string,
  config: RateLimitConfig
) {
  if (redis.kind === "ioredis" && redis.client.status !== "ready") {
    await redis.client.connect();
  }
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  let count: number;
  let ttl: number;

  if (redis.kind === "upstash") {
    const pipeline = redis.client.pipeline();
    pipeline.incr(fullKey);
    pipeline.pttl(fullKey);
    const [countResult, ttlResult] = (await pipeline.exec()) as [
      number,
      number,
    ];
    count = countResult;
    ttl = ttlResult;
  } else {
    const pipeline = redis.client.pipeline();
    pipeline.incr(fullKey);
    pipeline.pttl(fullKey);
    const results = await pipeline.exec();
    count = Number(results?.[0]?.[1] ?? 0);
    ttl = Number(results?.[1]?.[1] ?? -1);
  }

  if (ttl <= 0) {
    if (redis.kind === "upstash") {
      await redis.client.pexpire(fullKey, config.intervalMs);
    } else {
      await redis.client.pexpire(fullKey, config.intervalMs);
    }
    ttl = config.intervalMs;
  }

  const limited = count > config.max;
  return {
    limited,
    remaining: Math.max(0, config.max - count),
    resetAt: now + ttl,
  };
}

export async function rateLimit(key: string, config: RateLimitConfig) {
  const redis = getRedisClient();
  if (redis) {
    try {
      return await rateLimitWithRedis(redis, key, config);
    } catch (error) {
      redisUnavailableUntil = Date.now() + REDIS_BACKOFF_MS;
      debugLog("redis error, backing off to in-memory", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const store = getStore();
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  const existing = store.get(fullKey);

  if (!existing || existing.resetAt <= now) {
    store.set(fullKey, { count: 1, resetAt: now + config.intervalMs });
    return { limited: false, remaining: config.max - 1, resetAt: now + config.intervalMs };
  }

  if (existing.count >= config.max) {
    return { limited: true, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  store.set(fullKey, existing);
  return {
    limited: false,
    remaining: Math.max(0, config.max - existing.count),
    resetAt: existing.resetAt,
  };
}

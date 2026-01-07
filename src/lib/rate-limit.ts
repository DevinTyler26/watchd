import {
  ensureRedisConnected,
  getRedisClient,
  markRedisFailure,
  type RedisClient,
} from "@/lib/redis-client";

type RateLimitConfig = {
  max: number;
  intervalMs: number;
  keyPrefix?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

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

async function rateLimitWithRedis(
  redis: RedisClient,
  key: string,
  config: RateLimitConfig
) {
  await ensureRedisConnected(redis);
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
      markRedisFailure(error, "rate-limit");
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

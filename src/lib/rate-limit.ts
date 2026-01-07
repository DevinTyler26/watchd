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

export function rateLimit(key: string, config: RateLimitConfig) {
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

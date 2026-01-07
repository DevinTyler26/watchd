export type CommentPayload = {
  id: string;
  body: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type CommentCacheEntry = {
  comments: CommentPayload[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 1000 * 60 * 3;

function getCache() {
  const globalCache = globalThis as typeof globalThis & {
    entryCommentsCache?: Map<string, CommentCacheEntry>;
  };
  if (!globalCache.entryCommentsCache) {
    globalCache.entryCommentsCache = new Map();
  }
  return globalCache.entryCommentsCache;
}

export function getCachedComments(entryId: string) {
  const cache = getCache();
  const cached = cache.get(entryId);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    cache.delete(entryId);
    return null;
  }
  return cached.comments;
}

export function setCachedComments(entryId: string, comments: CommentPayload[]) {
  const cache = getCache();
  cache.set(entryId, { comments, fetchedAt: Date.now() });
}

// Small in-process LRU cache with a time-to-live. Each API instance keeps its own copy, so
// a write on one instance is visible on the others within `ttlMs` at most.
const caches = new Set();

export function createTtlCache({ ttlMs, maxEntries = 500, clock = () => Date.now() }) {
  const entries = new Map();
  const cache = {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= clock()) { entries.delete(key); return undefined; }
      entries.delete(key); entries.set(key, entry); // most recently used last
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: clock() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return value;
    },
    // Concurrent misses for the same key share one load (no stampede on a cold cache).
    async wrap(key, load) {
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const pending = load();
      cache.set(key, pending);
      try {
        return cache.set(key, await pending);
      } catch (error) {
        entries.delete(key);
        throw error;
      }
    },
    clear() { entries.clear(); },
  };
  caches.add(cache);
  return cache;
}

export function clearAllCaches() {
  for (const cache of caches) cache.clear();
}

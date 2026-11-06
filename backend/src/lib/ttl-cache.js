// Small in-process LRU cache with a time-to-live. Each API instance keeps its own copy, so
// a write on one instance is visible on the others within `ttlMs` at most.
//
// `staleMs` (optional) adds stale-while-revalidate to `wrap`: for that long after an entry expires
// it is still answered at once, and one background reload refreshes it. Visitors then never wait on
// the database for shared data; `clear()` (called by admin writes) still drops entries immediately,
// so an edit is never hidden behind a stale copy on the instance that made it.
const caches = new Set();

export function createTtlCache({ ttlMs, staleMs = 0, maxEntries = 500, clock = () => Date.now() }) {
  const entries = new Map();
  const refreshing = new Set();
  let generation = 0; // bumped by clear(), so a reload started before it cannot write old data back

  const fresh = (entry) => entry.expiresAt > clock();
  const usable = (entry) => entry.expiresAt + staleMs > clock();
  const touch = (key, entry) => { entries.delete(key); entries.set(key, entry); }; // most recently used last

  const cache = {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (!fresh(entry)) { entries.delete(key); return undefined; }
      touch(key, entry);
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
      const entry = entries.get(key);
      if (entry && fresh(entry)) { touch(key, entry); return entry.value; }
      if (entry && staleMs && usable(entry) && !(entry.value instanceof Promise)) {
        touch(key, entry);
        if (!refreshing.has(key)) {
          refreshing.add(key);
          const started = generation;
          Promise.resolve().then(load)
            .then((value) => { if (started === generation) cache.set(key, value); })
            .catch(() => {}) // keep serving the stale copy; the next request retries
            .finally(() => refreshing.delete(key));
        }
        return entry.value;
      }
      const pending = load();
      cache.set(key, pending);
      try {
        return cache.set(key, await pending);
      } catch (error) {
        entries.delete(key);
        throw error;
      }
    },
    clear() { entries.clear(); generation += 1; },
  };
  caches.add(cache);
  return cache;
}

export function clearAllCaches() {
  for (const cache of caches) cache.clear();
}

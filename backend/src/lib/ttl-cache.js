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
  const loads = new Map();

  const fresh = (entry) => entry.expiresAt > clock();
  const usable = (entry) => entry.expiresAt + staleMs > clock();
  const touch = (key, entry) => { entries.delete(key); entries.set(key, entry); }; // most recently used last

  function startLoad(key, load) {
    const pending = Promise.resolve().then(load).then((value) => {
      if (loads.get(key) === pending) cache.set(key, value);
      return value;
    }).finally(() => {
      if (loads.get(key) === pending) loads.delete(key);
    });
    loads.set(key, pending);
    return pending;
  }

  const cache = {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (!fresh(entry)) { entries.delete(key); return undefined; }
      touch(key, entry);
      return entry.value;
    },
    set(key, value) {
      loads.delete(key);
      entries.delete(key);
      entries.set(key, { value, expiresAt: clock() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      return value;
    },
    // Concurrent misses for the same key share one load (no stampede on a cold cache).
    async wrap(key, load) {
      const entry = entries.get(key);
      if (entry && fresh(entry)) { touch(key, entry); return entry.value; }
      const pending = loads.get(key);
      if (entry && usable(entry)) {
        touch(key, entry);
        if (!pending) startLoad(key, load).catch(() => {}); // keep serving the stale copy on failure
        return entry.value;
      }
      return pending ?? startLoad(key, load);
    },
    delete(key) {
      loads.delete(key);
      entries.delete(key);
    },
    clear() {
      loads.clear();
      entries.clear();
    },
  };
  caches.add(cache);
  return cache;
}

export function clearAllCaches() {
  for (const cache of caches) cache.clear();
}

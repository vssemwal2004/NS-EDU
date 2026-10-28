// In-memory fixed-window limiter. State is per process: use a shared store
// (for example Redis) before running more than one API instance.
const limiters = new Set();

export function createRateLimiter({ windowMs, max, clock = () => Date.now() }) {
  const windows = new Map();
  const prune = (now) => {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
  };
  const limiter = {
    hit(key) {
      const now = clock();
      if (windows.size > 10_000) prune(now);
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        windows.set(key, entry);
      }
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      if (entry.count >= max) return { allowed: false, retryAfterSeconds };
      entry.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    /** Same answer as hit() without counting, for limits charged only after the work succeeds. */
    peek(key) {
      const now = clock();
      const entry = windows.get(key);
      if (!entry || entry.resetAt <= now || entry.count < max) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    },
    delete(key) { windows.delete(key); },
    reset() { windows.clear(); },
  };
  limiters.add(limiter);
  return limiter;
}

export function resetRateLimits() {
  for (const limiter of limiters) limiter.reset();
}

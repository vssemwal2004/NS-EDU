// Typeahead client for GET /api/search/suggest.
// - Answers are kept in a small in-memory LRU for the page's lifetime, keyed by the normalised
//   query, so typing back over a word (or reopening search) is instant and costs no request.
// - Identical concurrent requests share one fetch.
// - Callers pass an AbortSignal; an aborted caller stops waiting, but a shared fetch still fills
//   the cache for whoever asks next.
import { api } from '@/lib/api/client';

const MAX_ENTRIES = 120;
const TTL_MS = 2 * 60_000;
const cache = new Map();
const inflight = new Map();

export const EMPTY_SUGGESTIONS = Object.freeze({ query: '', corrected: '', universities: [], universityTotal: 0, courses: [], exams: [], places: [] });

/** Same spelling rules as the server, so "UPES ", "upes" and "u p e s" share one cache entry. */
export const suggestKey = (value) => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);

export function cachedSuggestions(query) {
  const key = suggestKey(query);
  const entry = cache.get(key);
  if (!entry || entry.expires < Date.now()) return null;
  cache.delete(key); cache.set(key, entry); // most recently used last
  return entry.value;
}

function remember(key, value) {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

/** Resolves with suggestions for `query` (EMPTY_SUGGESTIONS for a blank query). */
export function fetchSuggestions(query, { signal, limit = 6 } = {}) {
  const key = suggestKey(query);
  if (!key) return Promise.resolve(EMPTY_SUGGESTIONS);
  const hit = cachedSuggestions(key);
  if (hit) return Promise.resolve(hit);
  let shared = inflight.get(key);
  if (!shared) {
    shared = api(`/search/suggest?q=${encodeURIComponent(key)}&limit=${limit}`)
      .then((data) => { const value = { ...EMPTY_SUGGESTIONS, ...data }; remember(key, value); return value; })
      .finally(() => inflight.delete(key));
    inflight.set(key, shared);
  }
  if (!signal) return shared;
  const aborted = () => new window.DOMException('Aborted', 'AbortError');
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const onAbort = () => reject(aborted());
    signal.addEventListener('abort', onAbort, { once: true });
    shared.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Where a place suggestion leads: the directory filtered to that state or city. */
export function placeHref(place) {
  const params = new URLSearchParams(place.kind === 'state' ? { state: place.name } : { state: place.state ?? '', city: place.name });
  return `/universities?${params}`;
}

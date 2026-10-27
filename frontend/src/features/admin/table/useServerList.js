'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Query string from a params object: empty values are dropped and keys sorted, so equal filters share one cache entry. */
export function toQuery(params = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return new URLSearchParams(entries).toString();
}

// Small per-tab LRU of recent responses. Cached rows render instantly and are always refetched in the
// background, except a prefetched page that nobody has seen yet: it is served once, as is.
const MAX_ENTRIES = 40;
const FRESH_MS = 15_000;
const MAX_AGE_MS = 5 * 60_000;
const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  if (Date.now() - entry.at > MAX_AGE_MS) return null;
  cache.set(key, entry);
  return entry;
}
function cacheSet(key, data, { prefetched = false } = {}) {
  cache.delete(key);
  cache.set(key, { data, at: Date.now(), prefetched });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}
/** Drops cached responses whose URL starts with `prefix` (all of them when omitted), e.g. after a write elsewhere. */
export function clearServerListCache(prefix = '') {
  for (const key of [...cache.keys()]) if (key.includes(`|${prefix}`)) cache.delete(key);
}

const idle = (callback) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(callback, { timeout: 1500 }) : window.setTimeout(callback, 300));
const cancelIdle = (id) => (typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id));

/**
 * Loads `path?params` through `request(path, {signal})` (e.g. useAdminSession().request).
 * - Keeps the previous rows on screen while the next request runs (`busy`); `loading` is the first load only.
 * - Options: `enabled` (false = wait), `scope` (cache namespace, e.g. the signed-in admin's id),
 *   `next(data, params)` → params of the page to prefetch after a successful load, or null.
 * Returns { data, error, loading, busy, refreshing, reload }.
 */
export function useServerList(request, path, params, { enabled = true, scope = '', next = null } = {}) {
  const query = toQuery(params);
  const url = query ? `${path}?${query}` : path;
  const key = `${scope}|${url}`;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, version: -1, data: null, error: '' });
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; });

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let idleId = null;
    const cached = cacheGet(key);
    const load = cached?.prefetched && Date.now() - cached.at < FRESH_MS ? Promise.resolve(cached.data) : request(url, { signal });
    load.then((data) => {
      // api() resolves null when an abort lands while the body is still downloading; never keep that.
      if (signal.aborted) return;
      if (data == null) throw new Error('The server sent an empty response. Try again.');
      cacheSet(key, data);
      setState({ key, version, data, error: '' });
      const nextParams = nextRef.current?.(data, Object.fromEntries(new URLSearchParams(query)));
      if (!nextParams) return;
      const nextQuery = toQuery(nextParams);
      const nextKey = `${scope}|${path}?${nextQuery}`;
      if (cacheGet(nextKey)) return;
      idleId = idle(() => {
        request(`${path}?${nextQuery}`, { signal }).then((nextData) => {
          if (!signal.aborted && nextData != null) cacheSet(nextKey, nextData, { prefetched: true });
        }).catch(() => {});
      });
    }).catch((failure) => {
      if (signal.aborted || failure.name === 'AbortError') return;
      setState({ key, version, data: null, error: failure.message || 'Could not load this list.' });
    });
    return () => { controller.abort(); if (idleId !== null) cancelIdle(idleId); };
  }, [enabled, key, path, query, request, scope, url, version]);

  const reload = useCallback(() => { clearServerListCache(path); setVersion((current) => current + 1); }, [path]);
  const settled = state.key === key && state.version === version;
  // While a new key loads, show its cached copy if there is one, else the previous rows.
  const cached = settled ? undefined : cache.get(key)?.data;
  const shown = settled ? state.data : (cached ?? state.data);
  return {
    data: shown,
    error: settled ? state.error : '',
    loading: !settled && !shown,
    // `busy`: the rows on screen belong to the previous request; `refreshing`: cached rows of this request are being revalidated.
    busy: enabled && !settled && !cached && Boolean(shown),
    refreshing: enabled && !settled && Boolean(cached),
    reload,
  };
}

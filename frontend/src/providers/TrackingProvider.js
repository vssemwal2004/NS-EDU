'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

/**
 * Batches the small activity events that power recommendations and the admin insights screen.
 *
 * - At most one request every 5 seconds, sent on an idle callback, with at most 20 events in it.
 * - A pending batch is flushed with navigator.sendBeacon when the tab is hidden or closed.
 * - Do Not Track is honoured: nothing is queued and nothing is sent.
 * - Failures are silent. Tracking never blocks, retries or surfaces an error to the viewer.
 * Only the declared fields travel: type, query, institutionSlug, state, city, stream, courseSlug,
 * results, the route (never its query string) and a timestamp.
 */
const TrackingContext = createContext(null);
const ENDPOINT = '/api/insights/events';
const FLUSH_MS = 5000;
const MAX_BATCH = 20;
const MAX_QUEUE = 60;
const FIELDS = ['type', 'query', 'institutionSlug', 'state', 'city', 'stream', 'courseSlug', 'results'];

function doNotTrack() {
  try {
    const flags = [window.navigator.doNotTrack, window.doNotTrack, window.navigator.msDoNotTrack];
    return flags.some((flag) => flag === '1' || flag === 'yes' || flag === true);
  } catch { return false; }
}

const clean = (event) => Object.fromEntries(FIELDS
  .map((key) => [key, event[key]])
  .filter(([, value]) => value !== undefined && value !== null && value !== ''));

export function TrackingProvider({ children, enabled = true }) {
  const queue = useRef([]);

  const flush = useCallback((beacon = false) => {
    const events = queue.current.splice(0, MAX_BATCH);
    if (!events.length) return;
    const payload = JSON.stringify({ events });
    try {
      const blob = new window.Blob([payload], { type: 'application/json' });
      if (beacon && window.navigator.sendBeacon?.(ENDPOINT, blob)) return;
      window.fetch(ENDPOINT, {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: payload,
      }).catch(() => {});
    } catch { /* tracking must never break the page */ }
  }, []);

  const track = useCallback((event) => {
    if (!enabled || !event?.type || doNotTrack()) return;
    const body = clean(event);
    if (!Object.keys(body).some((key) => key !== 'type')) return;
    if (queue.current.length >= MAX_QUEUE) queue.current.shift();
    queue.current.push({ ...body, path: window.location.pathname, at: new Date().toISOString() });
  }, [enabled]);

  // One drain every FLUSH_MS, on an idle callback: that is the whole rate limit, and a queue
  // that stays empty costs nothing. Anything still queued leaves with the page.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run) => window.setTimeout(run, 0));
    const ticker = window.setInterval(() => { if (queue.current.length) idle(() => flush()); }, FLUSH_MS);
    const send = () => flush(true);
    const onHide = () => { if (document.visibilityState === 'hidden') send(); };
    window.addEventListener('pagehide', send);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(ticker);
      window.removeEventListener('pagehide', send);
      document.removeEventListener('visibilitychange', onHide);
      send();
    };
  }, [flush]);

  const value = useMemo(() => ({
    track,
    trackSearch: (query, extra = {}) => track({ ...extra, type: 'search', query }),
    trackFilter: (filters) => track({ ...filters, type: 'filter' }),
    trackView: (institutionSlug, extra = {}) => track({ ...extra, type: 'view', institutionSlug }),
    trackCompare: (institutionSlug, extra = {}) => track({ ...extra, type: 'compare', institutionSlug }),
    trackApplyOpen: (institutionSlug, extra = {}) => track({ ...extra, type: 'apply-open', institutionSlug }),
  }), [track]);
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

const NOOP = Object.freeze({
  track: () => {}, trackSearch: () => {}, trackFilter: () => {}, trackView: () => {}, trackCompare: () => {}, trackApplyOpen: () => {},
});

/** Public hook. Outside the provider every call is a no-op, so components stay safe to render anywhere. */
export const useTracking = () => useContext(TrackingContext) ?? NOOP;

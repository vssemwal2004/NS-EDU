'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { UNI_COMPARE_EVENT, UNI_COMPARE_KEY, UNI_COMPARE_MAX, cleanSlugs, parseSlugs } from './compare-slugs';

// Institution shortlist for /compare: localStorage 'nsedu:compare-unis' = ["slug", ...], max 3.
// Deliberately a different key from 'nsedu:compare' (features/colleges/compareStore.js), which holds
// the per-course programme picks: the two comparisons are independent and neither clears the other.
// Server snapshot is null so useSyncExternalStore hydrates without a mismatch; if storage is blocked
// the shortlist lives in memory for this visit.
export { UNI_COMPARE_KEY, UNI_COMPARE_EVENT, UNI_COMPARE_MAX, cleanSlugs, parseSlugs } from './compare-slugs';
export { uniCompareHref } from './compare-slugs';

let memory = '';

function subscribe(callback) {
  window.addEventListener('storage', callback);
  window.addEventListener(UNI_COMPARE_EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(UNI_COMPARE_EVENT, callback); };
}
function getSnapshot() {
  try { return window.localStorage.getItem(UNI_COMPARE_KEY) ?? memory; } catch { return memory; }
}
function getServerSnapshot() { return null; }

export function writeSlugs(list) {
  const slugs = cleanSlugs(list);
  const raw = JSON.stringify(slugs);
  if (raw === getSnapshot()) return slugs;
  memory = raw;
  try { window.localStorage.setItem(UNI_COMPARE_KEY, raw); } catch { /* storage unavailable: memory only */ }
  window.dispatchEvent(new window.Event(UNI_COMPARE_EVENT));
  return slugs;
}

/** Shortlist + actions. Actions return 'added' | 'removed' | 'full' | 'unchanged' so callers can announce the result. */
export function useUniCompare() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const slugs = parseSlugs(raw);
    const current = () => parseSlugs(getSnapshot());
    return {
      ready: raw !== null,
      slugs,
      count: slugs.length,
      has: (slug) => slugs.includes(String(slug ?? '').toLowerCase()),
      add(slug) {
        const listNow = current();
        if (listNow.includes(slug)) return 'unchanged';
        if (listNow.length >= UNI_COMPARE_MAX) return 'full';
        writeSlugs([...listNow, slug]);
        return 'added';
      },
      remove(slug) { writeSlugs(current().filter((item) => item !== slug)); return 'removed'; },
      toggle(slug) {
        const listNow = current();
        if (listNow.includes(slug)) { writeSlugs(listNow.filter((item) => item !== slug)); return 'removed'; }
        if (listNow.length >= UNI_COMPARE_MAX) return 'full';
        writeSlugs([...listNow, slug]);
        return 'added';
      },
      set: (listNext) => writeSlugs(listNext),
      clear: () => writeSlugs([]),
    };
  }, [raw]);
}

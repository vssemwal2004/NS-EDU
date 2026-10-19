'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Compare selections are owned by the compare feature ({ [courseId]: [programmeId] } in
// localStorage). The header only reads them, on window focus and on cross-tab storage events.
const compareKey = 'nsedu:compare';
const readRaw = () => { try { return window.localStorage.getItem(compareKey) || ''; } catch { return ''; } };
function subscribeCompare(onChange) {
  window.addEventListener('storage', onChange);
  window.addEventListener('focus', onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener('focus', onChange); };
}

export function useCompareSummary() {
  const raw = useSyncExternalStore(subscribeCompare, readRaw, () => '');
  return useMemo(() => {
    let picks = {};
    try { picks = JSON.parse(raw) || {}; } catch { /* malformed value */ }
    const entries = Object.entries(picks).filter(([, ids]) => Array.isArray(ids) && ids.length);
    const top = entries.sort((a, b) => b[1].length - a[1].length)[0];
    return { count: entries.reduce((sum, [, ids]) => sum + ids.length, 0), courseId: top?.[0] || '' };
  }, [raw]);
}

// Recent searches stay in this browser only.
const recentKey = 'nsedu:recent-searches';
const recentLimit = 5;
export function readRecent() {
  try { const list = JSON.parse(window.localStorage.getItem(recentKey)); return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, recentLimit) : []; } catch { return []; }
}
export function writeRecent(list) {
  try { window.localStorage.setItem(recentKey, JSON.stringify(list)); } catch { /* storage unavailable */ }
  return list;
}
export function rememberSearch(query) {
  const value = query.trim().slice(0, 80);
  if (!value) return readRecent();
  return writeRecent([value, ...readRecent().filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, recentLimit));
}

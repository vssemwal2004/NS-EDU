'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Shared compare picks: localStorage 'nsedu:compare' = { [courseId]: [programmeId, ...] }, max 3 per course.
// Same key and change event as /compare, so every page instance stays in sync. The server snapshot is
// null, so hydration never mismatches; if storage is blocked, picks live in memory for this visit.
export const COMPARE_KEY = 'nsedu:compare';
export const COMPARE_EVENT = 'nsedu:compare-change';
export const COMPARE_MAX = 3;
let memory = '';

function subscribe(callback) {
  window.addEventListener('storage', callback);
  window.addEventListener(COMPARE_EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(COMPARE_EVENT, callback); };
}
function getSnapshot() {
  try { return window.localStorage.getItem(COMPARE_KEY) ?? memory; } catch { return memory; }
}
function getServerSnapshot() { return null; }
function parse(raw) {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function write(value) {
  const raw = JSON.stringify(value);
  memory = raw;
  try { window.localStorage.setItem(COMPARE_KEY, raw); } catch { /* storage unavailable: memory only */ }
  window.dispatchEvent(new window.Event(COMPARE_EVENT));
}

export function compareHref(courseId, ids = []) {
  return `/compare?course=${encodeURIComponent(courseId)}${ids.length ? `&c=${ids.map(encodeURIComponent).join(',')}` : ''}`;
}

// Returns the sanitised picks (known programmes of the right course only) plus actions.
// Actions return 'added' | 'removed' | 'full' | 'unchanged' so callers can announce the result.
export function useCompare(records) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const known = new Map(records.map((row) => [row.id, row]));
    const clean = (store, courseId) => [...new Set(Array.isArray(store[courseId]) ? store[courseId] : [])]
      .filter((id) => known.get(id)?.courseId === courseId).slice(0, COMPARE_MAX);
    const stored = parse(raw);
    const lists = {};
    for (const courseId of Object.keys(stored)) {
      const ids = clean(stored, courseId);
      if (ids.length) lists[courseId] = ids.map((id) => known.get(id));
    }
    const selected = new Set(Object.values(lists).flat().map((row) => row.id));
    function commit(courseId, ids) {
      const next = parse(getSnapshot());
      if (ids.length) next[courseId] = ids; else delete next[courseId];
      write(next);
    }
    return {
      ready: raw !== null,
      lists,
      total: selected.size,
      has: (id) => selected.has(id),
      count: (courseId) => lists[courseId]?.length || 0,
      toggle(row) {
        const ids = clean(parse(getSnapshot()), row.courseId);
        if (ids.includes(row.id)) { commit(row.courseId, ids.filter((id) => id !== row.id)); return 'removed'; }
        if (ids.length >= COMPARE_MAX) return 'full';
        commit(row.courseId, [...ids, row.id]);
        return 'added';
      },
      remove(row) { commit(row.courseId, clean(parse(getSnapshot()), row.courseId).filter((id) => id !== row.id)); },
      clear(courseId) { commit(courseId, []); },
      // Adds every programme (same course) or nothing: never silently drops an existing pick.
      addAll(rows) {
        const courseId = rows[0]?.courseId;
        const ids = clean(parse(getSnapshot()), courseId);
        const missing = rows.map((row) => row.id).filter((id) => !ids.includes(id));
        if (!missing.length) return 'unchanged';
        if (ids.length + missing.length > COMPARE_MAX) return 'full';
        commit(courseId, [...ids, ...missing]);
        return 'added';
      },
    };
  }, [raw, records]);
}

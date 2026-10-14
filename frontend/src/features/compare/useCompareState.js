'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePreferences } from '@/providers/PreferencesProvider';
import { STORAGE_KEY, parseStore, sanitizeIds } from './compare-data';

// Picks live in localStorage as { [courseId]: [programmeId, ...] } (shared with /colleges).
// Read through useSyncExternalStore: the server snapshot is null, so hydration never mismatches
// and no state is set inside effects. If storage is blocked, picks fall back to memory for this visit.
const CHANGE_EVENT = 'nsedu:compare-change';
let memory = '';

function subscribe(callback) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(CHANGE_EVENT, callback); };
}
function getSnapshot() {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? memory; } catch { return memory; }
}
function getServerSnapshot() { return null; }
function writeStore(value) {
  const raw = JSON.stringify(value);
  memory = raw;
  try { window.localStorage.setItem(STORAGE_KEY, raw); } catch { /* storage unavailable: memory only */ }
  window.dispatchEvent(new window.Event(CHANGE_EVENT));
}

function replaceUrl(courseId, ids) {
  const url = new URL(window.location.href);
  url.searchParams.set('course', courseId);
  if (ids.length) url.searchParams.set('c', ids.join(',')); else url.searchParams.delete('c');
  window.history.replaceState(window.history.state, '', `${url.pathname}?${url.searchParams.toString().replaceAll('%2C', ',')}${url.hash}`);
}

export function useCompareState({ initialCourse = '', initialList = '', groups, comparable }) {
  const initialIds = useMemo(() => initialList.split(',').map((id) => id.trim()).filter(Boolean), [initialList]);
  const preferences = usePreferences();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stored = useMemo(() => parseStore(raw), [raw]);
  const [chosenCourse, setChosenCourse] = useState(null);
  // True until the visitor changes anything: URL ids win and the "link changed" note can show.
  const [fresh, setFresh] = useState(true);

  const urlCourse = groups.has(initialCourse) ? initialCourse : '';
  const urlIds = useMemo(() => sanitizeIds(initialIds, groups.get(urlCourse) || []), [initialIds, groups, urlCourse]);
  const preferred = comparable.includes(preferences.course) ? preferences.course : '';
  const course = chosenCourse ?? (urlCourse || preferred || comparable[0] || groups.keys().next().value || '');
  const rows = useMemo(() => groups.get(course) || [], [groups, course]);
  const fromUrl = fresh && urlIds.length > 0 && course === urlCourse;
  const ids = useMemo(() => (fromUrl ? urlIds : sanitizeIds(stored[course], rows)), [fromUrl, urlIds, stored, course, rows]);
  const selected = useMemo(() => ids.map((id) => rows.find((row) => row.id === id)), [ids, rows]);
  const linkRows = groups.get(urlCourse) || [];
  const droppedFromLink = fresh ? [...new Set(initialIds)].filter((id) => !linkRows.some((row) => row.id === id)).length : 0;

  // A shared link's picks are copied into storage once, so /colleges and other tabs see them.
  useEffect(() => {
    if (urlIds.length) writeStore({ ...parseStore(getSnapshot()), [urlCourse]: urlIds });
  }, [urlCourse, urlIds]);

  function commit(nextIds) {
    const next = { ...parseStore(getSnapshot()) };
    if (nextIds.length) next[course] = nextIds; else delete next[course];
    writeStore(next);
    setFresh(false);
    replaceUrl(course, nextIds);
    if (preferences.course !== course) preferences.setCourse(course);
  }

  return {
    course,
    rows,
    ids,
    selected,
    hydrated: raw !== null || fromUrl,
    droppedFromLink,
    add: (id) => commit(sanitizeIds([...ids, id], rows)),
    remove: (id) => commit(ids.filter((item) => item !== id)),
    clear: () => commit([]),
    setCourse(id) {
      setChosenCourse(id);
      setFresh(false);
      preferences.setCourse(id);
      replaceUrl(id, sanitizeIds(parseStore(getSnapshot())[id], groups.get(id) || []));
    },
  };
}

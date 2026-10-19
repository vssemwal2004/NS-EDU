'use client';
import { useMemo, useSyncExternalStore } from 'react';

// Ticks persist per guide in localStorage ('nsedu:guide-checklist:<guide>' = [itemId, ...]), only on this device.
// The server snapshot is empty so hydration never mismatches; every reader of a key re-renders on change.
const PREFIX = 'nsedu:guide-checklist:';
const listeners = new Set();
const read = (key) => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
function subscribe(callback) {
  listeners.add(callback);
  const onStorage = (event) => { if (!event.key || event.key.startsWith(PREFIX)) callback(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
}
function write(key, ids) {
  try { window.localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  listeners.forEach((callback) => callback());
}

// `ids` is every known item of the guide (unknown saved ids are ignored and dropped on the next write).
export function useTicks(guide, ids) {
  const key = PREFIX + guide;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '');
  const done = useMemo(() => {
    try { const list = JSON.parse(raw || '[]'); return new Set(Array.isArray(list) ? list.filter((id) => ids.includes(id)) : []); } catch { return new Set(); }
  }, [raw, ids]);
  const toggle = (id) => write(key, ids.filter((itemId) => (itemId === id ? !done.has(id) : done.has(itemId))));
  const clear = () => write(key, []);
  return { done, toggle, clear, count: done.size, total: ids.length };
}

'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

// Chosen columns per viewer, in localStorage ({ v: 1, keys: [...] }). A per-tab memory copy keeps the
// choice working when storage is blocked; another tab's change replaces it through the 'storage' event.
const memory = new Map();
const listeners = new Set();
function subscribe(callback) {
  const onStorage = (event) => { if (event.key) memory.delete(event.key); callback(); };
  listeners.add(callback);
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
}
function read(key) {
  if (memory.has(key)) return memory.get(key);
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key, raw) {
  memory.set(key, raw);
  try { if (raw === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, raw); } catch { /* storage unavailable: memory only */ }
  listeners.forEach((listener) => listener());
}
function parse(raw) {
  try { const value = JSON.parse(raw); return Array.isArray(value?.keys) ? value.keys.filter((key) => typeof key === 'string') : null; } catch { return null; }
}

/**
 * Visible column keys for `storageKey` (e.g. "gv-admin-cols:leads:<adminId>"), limited to `available`
 * and falling back to `defaults`. Returns [keys, save(keys | null)]; null forgets the choice.
 * The server render uses the defaults, so hydration never mismatches.
 */
export function useColumnPrefs(storageKey, available, defaults) {
  const raw = useSyncExternalStore(subscribe, () => (storageKey ? read(storageKey) : null), () => null);
  const keys = useMemo(() => {
    const known = new Set(available);
    const stored = parse(raw)?.filter((key) => known.has(key));
    return stored?.length ? stored : defaults.filter((key) => known.has(key));
  }, [raw, available, defaults]);
  const save = useCallback((next) => { if (storageKey) write(storageKey, next ? JSON.stringify({ v: 1, keys: next }) : null); }, [storageKey]);
  return [keys, save];
}

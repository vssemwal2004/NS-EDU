'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

// Text size and row density, remembered per browser (same approach as useColumnPrefs): the server render
// and first paint use the defaults so hydration never mismatches, a memory copy keeps it working when
// storage is blocked, and another tab's change arrives through the 'storage' event.
const KEY = 'gv-admin-display';
const DEFAULTS = { text: 'default', density: 'comfortable', nav: 'expanded' };
const TEXT = ['default', 'large', 'xlarge'];
const DENSITY = ['comfortable', 'compact'];
const NAV = ['expanded', 'collapsed'];
let memory;
const listeners = new Set();

function subscribe(callback) {
  const onStorage = (event) => { if (event.key === KEY) { memory = undefined; callback(); } };
  listeners.add(callback);
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
}
function read() {
  if (memory !== undefined) return memory;
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
function write(raw) {
  memory = raw;
  try { window.localStorage.setItem(KEY, raw); } catch { /* memory only */ }
  listeners.forEach((listener) => listener());
}

export function useDisplayPrefs() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const prefs = useMemo(() => {
    try {
      const saved = JSON.parse(raw);
      return {
        text: TEXT.includes(saved?.text) ? saved.text : DEFAULTS.text,
        density: DENSITY.includes(saved?.density) ? saved.density : DEFAULTS.density,
        nav: NAV.includes(saved?.nav) ? saved.nav : DEFAULTS.nav,
      };
    } catch { return DEFAULTS; }
  }, [raw]);
  const update = useCallback((patch) => write(JSON.stringify({ ...prefs, ...patch })), [prefs]);
  return [prefs, update];
}

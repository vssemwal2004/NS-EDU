'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Course and city choices follow the student across pages for this browser.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
const PreferencesContext = createContext(null);
const storageKey = 'nsedu:preferences';

function read() {
  try { return JSON.parse(window.localStorage.getItem(storageKey)) || {}; } catch { return {}; }
}

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState({ course: '', city: '' });
  // Hydrate after mount so server and first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const stored = read(); setPreferences((previous) => ({ ...previous, ...stored })); }, []);
  const update = useCallback((patch) => setPreferences((previous) => {
    const next = { ...previous, ...patch };
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  }), []);
  const value = useMemo(() => ({
    ...preferences,
    setCourse: (course) => update({ course }),
    setCity: (city) => update({ city }),
  }), [preferences, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}

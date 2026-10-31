// A random number from 0 to 99, fixed for this browser tab's session. Recommendation requests send it
// so the default list (what a visitor with no history sees) rotates between sessions instead of being
// the same top colleges every time. It identifies nobody and lives only in sessionStorage, which can be
// unavailable (private mode, blocked site data), so every access is guarded.
const KEY = 'gv:variant';

export function sessionVariant() {
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored !== null && /^\d{1,2}$/.test(stored)) return Number(stored);
  } catch { /* storage unavailable: fall through to a fresh number */ }
  const value = Math.floor(Math.random() * 100);
  try { window.sessionStorage.setItem(KEY, String(value)); } catch { /* the number just will not persist */ }
  return value;
}

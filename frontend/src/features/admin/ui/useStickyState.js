'use client';
// Filters that survive leaving the page, a new tab and a new sign-in: kept per person and per screen in
// localStorage ("gv-admin-sticky:<admin id>:<name>"). Paging is never kept, so a screen always reopens on page 1.
// Admin screens only mount after the session has loaded (the shell shows a splash until then), so reading storage
// in the state initialiser cannot cause a hydration mismatch.
import { useEffect, useState } from 'react';
import { useAdminSession } from '../AdminSession';

const PREFIX = 'gv-admin-sticky:';
const PAGING = ['page', 'cursor', 'dir'];

const storageKey = (adminId, name) => (adminId && name ? `${PREFIX}${adminId}:${name}` : '');

export function readSticky(adminId, name) {
  const key = storageKey(adminId, name);
  if (!key) return null;
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function writeSticky(adminId, name, value) {
  const key = storageKey(adminId, name);
  if (!key) return;
  try {
    if (value === null || value === undefined || value === '') window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full or blocked: filters simply are not remembered */ }
}

const withoutPaging = (value, initial) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...value };
  for (const key of PAGING) if (key in copy) copy[key] = initial && typeof initial === 'object' && key in initial ? initial[key] : undefined;
  return copy;
};

/** Restores a saved value for `name` (object values are merged over `initial`, only known keys), saves every change. */
export function restoreSticky(adminId, name, initial) {
  const saved = readSticky(adminId, name);
  if (saved === null) return initial;
  if (initial && typeof initial === 'object' && !Array.isArray(initial)) {
    if (!saved || typeof saved !== 'object') return initial;
    const known = Object.fromEntries(Object.keys(initial).filter((key) => key in saved && !PAGING.includes(key)).map((key) => [key, saved[key]]));
    return { ...initial, ...known };
  }
  return typeof saved === typeof initial ? saved : initial;
}

export function useStickyState(name, initial) {
  const { admin } = useAdminSession();
  const adminId = admin?.id ?? '';
  const [value, setValue] = useState(() => restoreSticky(adminId, name, initial));
  useEffect(() => { writeSticky(adminId, name, withoutPaging(value, initial)); }, [adminId, name, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue];
}

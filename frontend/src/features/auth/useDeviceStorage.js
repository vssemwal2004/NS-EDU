'use client';
import { useSyncExternalStore } from 'react';

// Reads a raw localStorage string and stays in sync with other tabs ('storage')
// and with writes made here. The server snapshot is undefined ("not read yet").
const listeners = new Set();
function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => { listeners.delete(callback); window.removeEventListener('storage', callback); };
}
function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function useStoredString(key) {
  return useSyncExternalStore(subscribe, () => read(key), () => undefined);
}

export function writeStoredJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  listeners.forEach((listener) => listener());
}

export function parseJson(raw, fallback) {
  try { return raw ? JSON.parse(raw) ?? fallback : fallback; } catch { return fallback; }
}

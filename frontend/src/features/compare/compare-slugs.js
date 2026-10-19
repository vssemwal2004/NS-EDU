// Pure shortlist helpers, shared by the server page and the client store (no 'use client' here,
// so the server component can sanitise ?u= with exactly the rules the browser store uses).
export const UNI_COMPARE_KEY = 'nsedu:compare-unis';
export const UNI_COMPARE_EVENT = 'nsedu:compare-unis-change';
export const UNI_COMPARE_MAX = 3;
const SLUG = /^[a-z0-9][a-z0-9-]{0,160}$/;

export function cleanSlugs(list) {
  const seen = (Array.isArray(list) ? list : []).map((value) => String(value ?? '').trim().toLowerCase()).filter((value) => SLUG.test(value));
  return [...new Set(seen)].slice(0, UNI_COMPARE_MAX);
}

export function parseSlugs(raw) {
  if (!raw) return [];
  try { return cleanSlugs(JSON.parse(raw)); } catch { return []; }
}

export const slugsFromParam = (value) => cleanSlugs(String(Array.isArray(value) ? value.join(',') : value || '').split(','));

export const uniCompareHref = (slugs = []) => (slugs.length ? `/compare?u=${slugs.map(encodeURIComponent).join(',')}` : '/compare');

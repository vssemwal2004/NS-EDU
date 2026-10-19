import { slugify } from '../../lib/validation.js';

// Search keys for 20k+ institutions without an external search engine: every word of the name,
// short name, aliases, city and state is indexed as edge n-grams (2..12 chars) in one multikey
// field, so "iit bom", "bombay iit" and "techn mumb" are all index lookups, in any word order.
const MIN_PREFIX = 2;
const MAX_PREFIX = 12;
const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'de', '&']);

export const foldText = (value) => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

export const nameKeyOf = (name) => foldText(name).slice(0, 160);

export function wordsOf(value) {
  return foldText(value).split(' ').filter((word) => word.length >= MIN_PREFIX && !STOP_WORDS.has(word));
}

export function prefixesOf(values) {
  const keys = new Set();
  for (const value of values.flat()) {
    for (const word of wordsOf(value)) {
      for (let size = MIN_PREFIX; size <= Math.min(word.length, MAX_PREFIX); size += 1) keys.add(word.slice(0, size));
    }
  }
  return [...keys];
}

// Query words become the keys to match; longer words are clipped to the indexed prefix length.
export function queryKeys(q) {
  return [...new Set(wordsOf(q).map((word) => word.slice(0, MAX_PREFIX)))].slice(0, 6);
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const acronymOf = (name) => wordsOf(name).filter((word) => !/^\d+$/.test(word)).map((word) => word[0]).join('');

// Derived fields are recomputed on every write so search never drifts from the visible data.
export function derivedFields(doc) {
  const aliases = Array.isArray(doc.aliases) ? doc.aliases : [];
  const acronym = acronymOf(doc.name);
  return {
    nameKey: nameKeyOf(doc.name),
    domain: domainOf(doc.website),
    searchPrefixes: prefixesOf([doc.name, doc.shortName ?? '', aliases, doc.city ?? '', doc.district ?? '', doc.state ?? '', acronym.length >= 2 ? acronym : '']),
  };
}

// Candidate slugs in preference order: name, then name + city; callers add a numeric suffix if both are taken.
export const slugCandidates = (doc) => [...new Set([slugify(doc.name), slugify(`${doc.name} ${doc.city ?? ''}`)].filter(Boolean))];

import { COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { foldText, queryKeys } from '../universities/normalize.js';
import { PUBLIC_FILTER, toSummary } from '../universities/university-service.js';
import { eventsCollection } from './events.js';

// Recommendations are explainable on purpose: every point in the score comes from a stored event
// of this viewer, and every `reason` string is built from one of those events. Nothing is invented.
const WINDOW_DAYS = 90;
const HALF_LIFE_DAYS = 21;
const MAX_EVENTS_READ = 200;
const PER_QUERY_LIMIT = 24;
const MAX_LIMIT = 24;

const cache = createTtlCache({ ttlMs: 60_000, maxEntries: 2000 });
export const invalidateRecommendationCache = () => cache.clear();

const SORT = { popularity: -1, nameKey: 1, _id: 1 };
const PROJECTION = { searchPrefixes: 0 };
const NAAC_POINTS = { 'A++': 1, 'A+': 0.8, A: 0.6, 'B++': 0.4, 'B+': 0.3, B: 0.2, C: 0.1 };
const VERBS = { search: 'searched', filter: 'filtered for', view: 'viewed', compare: 'compared', 'apply-open': 'started an application for' };

const decay = (at, now) => 0.5 ** (Math.max(0, now - new Date(at).getTime()) / (HALF_LIFE_DAYS * 86_400_000));
const top = (map, size) => [...map.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, size);
const normalise = (map) => {
  const max = Math.max(0, ...map.values());
  return (key) => (max > 0 && key ? (map.get(key) ?? 0) / max : 0);
};

/** Recency-weighted counts per dimension, plus what the viewer has already seen or applied to. */
export function buildSignals(events, now = Date.now()) {
  const states = new Map(); const cities = new Map(); const streams = new Map(); const courses = new Map();
  const tokens = new Map(); const searches = new Map(); const viewed = new Map(); const applied = new Set();
  const bump = (map, key, weight) => { if (key) map.set(key, (map.get(key) ?? 0) + weight); };
  for (const event of events) {
    const weight = decay(event.at, now);
    bump(states, event.state, weight);
    bump(cities, event.city, weight);
    bump(streams, event.stream, weight);
    bump(courses, event.courseSlug, weight);
    const keys = queryKeys(event.query);
    for (const token of keys) bump(tokens, token, weight);
    if (keys.length) bump(searches, keys.join(' '), weight);
    if (!event.institutionSlug) continue;
    if (event.type === 'apply-open') applied.add(event.institutionSlug);
    else if (event.type === 'view') viewed.set(event.institutionSlug, (viewed.get(event.institutionSlug) ?? 0) + 1);
  }
  return { states, cities, streams, courses, tokens, searches, viewed, applied };
}

// A handful of indexed lookups (state, city, streams, courseSlugs, searchPrefixes), each capped,
// instead of one scan: the candidate pool stays small whatever the viewer has been doing.
async function candidatePool(signals, limit) {
  const collection = (await getDb()).collection(COLLECTIONS.institutions);
  const filters = [
    ...top(signals.cities, 3).map(([city]) => ({ city })),
    ...top(signals.states, 2).map(([state]) => ({ state })),
    ...top(signals.streams, 3).map(([stream]) => ({ streams: stream })),
    ...top(signals.courses, 3).map(([course]) => ({ courseSlugs: course })),
    ...top(signals.searches, 3).map(([keys]) => ({ searchPrefixes: { $all: keys.split(' ') } })),
  ];
  const sets = await Promise.all(filters.map((filter) => collection
    .find({ ...PUBLIC_FILTER, ...filter }, { projection: PROJECTION }).sort(SORT).limit(PER_QUERY_LIMIT).toArray()));
  const pool = new Map();
  for (const doc of sets.flat()) pool.set(doc.slug, doc);
  // Always keep a sensible floor so a brand-new (or very narrow) viewer still gets a full set.
  if (pool.size < limit * 3) {
    const [ranked, popular] = await Promise.all([
      collection.find({ ...PUBLIC_FILTER, nirfRank: { $type: 'number' } }, { projection: PROJECTION }).sort({ nirfRank: 1, _id: 1 }).limit(limit * 3).toArray(),
      collection.find(PUBLIC_FILTER, { projection: PROJECTION }).sort(SORT).limit(limit * 3).toArray(),
    ]);
    for (const doc of [...ranked, ...popular]) pool.set(doc.slug, doc);
  }
  return [...pool.values()];
}

function scoreOf(doc, signals, weight) {
  const streams = doc.streams ?? [];
  const courseSlugs = doc.courseSlugs ?? [];
  const matched = [];
  let score = 0;
  const city = weight.city(doc.city);
  const state = weight.state(doc.state);
  if (city > 0) { score += 3 * city; matched.push('city'); }
  if (state > 0) { score += 2 * state; matched.push('state'); }
  const stream = Math.max(0, ...streams.map((value) => weight.stream(value)));
  if (stream > 0) { score += 3 * stream; matched.push('stream'); }
  const course = Math.max(0, ...courseSlugs.map((value) => weight.course(value)));
  if (course > 0) { score += 3.5 * course; matched.push('course'); }
  const haystack = foldText([doc.name, doc.shortName, doc.city, doc.state].filter(Boolean).join(' '));
  const tokens = top(signals.tokens, 8);
  const hits = tokens.filter(([token]) => haystack.includes(token));
  if (hits.length) {
    score += 2 * (hits.reduce((sum, [, value]) => sum + value, 0) / tokens.reduce((sum, [, value]) => sum + value, 0));
    matched.push('name');
  }
  if (typeof doc.nirfRank === 'number') score += 1.2 * (1 - Math.min(doc.nirfRank, 200) / 200);
  score += 0.8 * (NAAC_POINTS[doc.naacGrade] ?? 0);
  // Already-seen pages are damped, not banned: the first visit costs nothing, every repeat after
  // that shrinks the score so the list keeps offering options the viewer has not opened yet.
  const seen = signals.viewed.get(doc.slug) ?? 0;
  const repeats = Math.min(Math.max(0, seen - 1), 6);
  return { score: score / (1 + 0.8 * repeats), matched, seen };
}

/** The reason line: the newest event of this viewer that this institution actually matches. */
export function reasonFor(doc, events, courseNames = new Map()) {
  const haystack = foldText([doc.name, doc.shortName, doc.city, doc.state].filter(Boolean).join(' '));
  for (const event of events) {
    if (event.institutionSlug && event.institutionSlug === doc.slug) continue;
    const place = event.city && event.city === doc.city ? event.city : event.state && event.state === doc.state ? event.state : '';
    const label = event.courseSlug && (doc.courseSlugs ?? []).includes(event.courseSlug) ? (courseNames.get(event.courseSlug) || event.courseSlug)
      : event.stream && (doc.streams ?? []).includes(event.stream) ? event.stream : '';
    const keys = queryKeys(event.query);
    const queryMatch = keys.length && keys.every((token) => haystack.includes(token)) ? event.query : '';
    if (!place && !label && !queryMatch) continue;
    return `Because you ${VERBS[event.type] ?? 'viewed'} ${label || queryMatch || 'universities'}${place ? ` in ${place}` : ''}`.slice(0, 160);
  }
  if (typeof doc.nirfRank === 'number') return `Ranked ${doc.nirfRank} in the NIRF list${doc.nirfYear ? ` (${doc.nirfYear})` : ''}`;
  if (doc.naacGrade) return `NAAC grade ${doc.naacGrade} as reported by the source directory`;
  return doc.popularity > 0 ? 'Popular with students on Gyaan Vidhya' : 'From the Gyaan Vidhya directory';
}

async function appliedSlugs(studentId) {
  if (!studentId) return [];
  const rows = await (await getDb()).collection(COLLECTIONS.applications)
    .find({ studentId }, { projection: { 'preference.institutionSlug': 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
  return rows.map((row) => row.preference?.institutionSlug).filter(Boolean);
}

async function courseNamesFor(slugs) {
  if (!slugs.length) return new Map();
  const rows = await (await getDb()).collection(COLLECTIONS.courses)
    .find({ slug: { $in: slugs } }, { projection: { slug: 1, name: 1 } }).toArray();
  return new Map(rows.map((row) => [row.slug, row.name]));
}

/**
 * Ranked, explained suggestions for one viewer (student or anonymous visitor).
 * @param {{ studentId?: import('mongodb').ObjectId|null, visitorId: string, limit?: number, exclude?: string }} viewer
 */
export async function recommendUniversities({ studentId = null, visitorId, limit = 8, exclude = '' }) {
  const size = Math.min(Math.max(Number.parseInt(limit, 10) || 8, 1), MAX_LIMIT);
  const key = `s:${studentId ?? ''}|v:${visitorId}|${size}|${exclude}`;
  return cache.wrap(key, async () => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    // A student who searched before signing in keeps those results: both ids are theirs, on this device.
    const filter = studentId ? { $or: [{ studentId }, { visitorId }] } : { visitorId };
    const [events, applied] = await Promise.all([
      (await eventsCollection()).find({ ...filter, at: { $gte: since } }).sort({ at: -1 }).limit(MAX_EVENTS_READ).toArray(),
      appliedSlugs(studentId),
    ]);
    const signals = buildSignals(events);
    for (const slug of applied) signals.applied.add(slug);
    const [pool, courseNames] = await Promise.all([
      candidatePool(signals, size),
      courseNamesFor([...new Set(events.map((event) => event.courseSlug).filter(Boolean))]),
    ]);
    const weight = {
      city: normalise(signals.cities), state: normalise(signals.states),
      stream: normalise(signals.streams), course: normalise(signals.courses),
    };
    const scored = pool
      .filter((doc) => doc.slug !== exclude && !signals.applied.has(doc.slug))
      .map((doc) => ({ doc, ...scoreOf(doc, signals, weight) }))
      .sort((a, b) => b.score - a.score
        || (a.doc.nirfRank ?? 1e9) - (b.doc.nirfRank ?? 1e9)
        || (a.doc.nameKey < b.doc.nameKey ? -1 : a.doc.nameKey > b.doc.nameKey ? 1 : 0))
      .slice(0, size);
    return {
      items: scored.map(({ doc, score, matched }) => ({
        ...toSummary(doc),
        reason: reasonFor(doc, events, courseNames),
        score: Math.round(score * 1000) / 1000,
        matched,
      })),
      personalised: events.length > 0,
      basedOnEvents: events.length,
      limit: size,
    };
  });
}

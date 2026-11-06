import { activeFilter, COLLECTIONS, getDb } from '../../db/collections.js';
import { liveImage } from '../../lib/retired-images.js';
import { foldText } from '../universities/normalize.js';
import { PUBLIC_FILTER } from '../universities/public-filter.js';
import { acronymsOf, buildSearchIndex, defaultRank, FIELD, search } from './search-engine.js';

/**
 * Holds the in-memory search indexes (see search-engine.js) for this API process and keeps them
 * in step with MongoDB:
 *  - built in the background at start-up (server.js) and on first use;
 *  - rebuilt after any write made through this process (markSearchStale, called by the
 *    university and catalogue cache invalidation);
 *  - checked at most once a minute against a cheap signature (record count + newest updatedAt),
 *    which catches writes made by other processes such as the crawler.
 * Until a fresh index exists, `readyIndex()` returns null and callers use the MongoDB query path,
 * so results are never wrong — only slower — while an index is being (re)built.
 */

const CHECK_EVERY_MS = 60_000;
const INSTITUTION_FIELDS = {
  slug: 1, name: 1, shortName: 1, aliases: 1, city: 1, district: 1, state: 1, type: 1, category: 1, ownership: 1,
  streams: 1, courseSlugs: 1, naacGrade: 1, nirfRank: 1, nirfYear: 1, establishedYear: 1, popularity: 1, logoUrl: 1, nameKey: 1,
};

const state = { indexes: null, generation: 0, builtGeneration: -1, building: null, checkedAt: 0, signature: '', checking: null };

const nirfBoost = (rank) => (typeof rank === 'number' && rank > 0 ? Math.max(0, 8 - Math.log2(rank)) : 0);
const popularityBoost = (value) => Math.min(12, Math.log1p(Math.max(0, Number(value) || 0)) * 2);
const keyOf = (value) => foldText(value).replace(/ /g, '');

export function institutionRecord(doc) {
  const name = doc.name ?? '';
  const aliases = Array.isArray(doc.aliases) ? doc.aliases : [];
  return {
    kind: 'university',
    slug: doc.slug,
    name,
    shortName: doc.shortName || '',
    city: doc.city || '',
    district: doc.district || '',
    state: doc.state ?? null,
    type: doc.type || 'university',
    category: doc.category || 'other',
    ownership: doc.ownership || 'unknown',
    streams: doc.streams ?? [],
    courseSlugs: doc.courseSlugs ?? [],
    naacGrade: doc.naacGrade || '',
    nirfRank: typeof doc.nirfRank === 'number' ? doc.nirfRank : null,
    nirfYear: doc.nirfYear ?? null,
    establishedYear: typeof doc.establishedYear === 'number' ? doc.establishedYear : null,
    popularity: Number(doc.popularity) || 0,
    logoUrl: liveImage(doc.logoUrl),
    nameKey: doc.nameKey || foldText(name),
    shortKey: doc.shortName ? keyOf(doc.shortName) : '',
    acronyms: [...new Set([...acronymsOf(name), ...(doc.shortName && keyOf(doc.shortName).length <= 10 ? [keyOf(doc.shortName)] : [])])],
    boost: popularityBoost(doc.popularity) + nirfBoost(doc.nirfRank) + (doc.type === 'university' ? 1 : 0),
    texts: [
      { text: name, field: FIELD.NAME },
      { text: doc.shortName, field: FIELD.ALIAS },
      ...aliases.map((alias) => ({ text: alias, field: FIELD.ALIAS })),
      { text: doc.city, field: FIELD.PLACE },
      { text: doc.district, field: FIELD.PLACE },
      { text: doc.state, field: FIELD.PLACE },
    ],
  };
}

// Courses and exams are a few hundred documents, so the full document rides along (`doc`) for
// callers that render the catalogue's own shape.
const courseRecord = (course) => ({
  doc: course, kind: 'course', slug: course.slug, name: course.name, fullName: course.fullName ?? '', field: course.field ?? '', icon: course.icon ?? 'cap',
  nameKey: foldText(course.name), shortKey: keyOf(course.name), acronyms: acronymsOf(course.fullName ?? ''), boost: course.popular ? 4 : 0,
  texts: [{ text: course.name, field: FIELD.NAME }, { text: course.fullName, field: FIELD.ALIAS }, { text: course.slug?.replace(/-/g, ' '), field: FIELD.ALIAS }, { text: course.field, field: FIELD.PLACE }],
});

const examRecord = (exam) => ({
  doc: exam, kind: 'exam', slug: exam.slug, name: exam.name, field: exam.field ?? '', icon: exam.icon ?? 'document', href: exam.href ?? '',
  nameKey: foldText(exam.name), shortKey: keyOf(exam.name), acronyms: [], boost: 0,
  texts: [{ text: exam.name, field: FIELD.NAME }, { text: exam.slug?.replace(/-/g, ' '), field: FIELD.ALIAS }, { text: exam.field, field: FIELD.PLACE }],
});

// States and cities with how many public institutions each has, so "dehra" offers "Dehradun · 61".
function placeRecords(institutions) {
  const states = new Map();
  const cities = new Map();
  for (const item of institutions) {
    if (item.state) states.set(item.state, (states.get(item.state) ?? 0) + 1);
    if (item.city && item.state) {
      const key = `${item.state}\u0000${item.city}`;
      cities.set(key, (cities.get(key) ?? 0) + 1);
    }
  }
  const record = (kind, name, placeState, count) => ({
    kind, name, state: placeState, count, nameKey: foldText(name), shortKey: '', acronyms: [], boost: Math.min(10, Math.log1p(count) * 2),
    texts: [{ text: name, field: FIELD.NAME }],
  });
  return [
    ...[...states].map(([name, count]) => record('state', name, name, count)),
    ...[...cities].map(([key, count]) => { const [placeState, city] = key.split('\u0000'); return record('city', city, placeState, count); }),
  ];
}

function finish(records) {
  const index = buildSearchIndex(records);
  for (const record of records) delete record.texts; // only needed while building
  return index;
}

async function signatureOf(db) {
  const collection = db.collection(COLLECTIONS.institutions);
  const [count, newest] = await Promise.all([
    collection.estimatedDocumentCount(),
    collection.findOne({}, { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }),
  ]);
  return `${count}:${newest?.updatedAt?.valueOf?.() ?? 0}`;
}

async function build() {
  const generation = state.generation;
  const started = performance.now();
  const db = await getDb();
  const signature = await signatureOf(db);
  const [institutionDocs, courseDocs, examDocs] = await Promise.all([
    db.collection(COLLECTIONS.institutions).find(PUBLIC_FILTER, { projection: INSTITUTION_FIELDS }).batchSize(5000).toArray(),
    db.collection(COLLECTIONS.courses).find(activeFilter).toArray(),
    db.collection(COLLECTIONS.exams).find(activeFilter).toArray(),
  ]);
  const institutions = institutionDocs.filter((doc) => doc.slug && doc.name).map(institutionRecord);
  state.indexes = {
    institutions: finish(institutions),
    places: finish(placeRecords(institutions)),
    courses: finish(courseDocs.filter((doc) => doc.slug && doc.name).map(courseRecord)),
    exams: finish(examDocs.filter((doc) => doc.slug && doc.name).map(examRecord)),
    builtAt: new Date(),
    buildMs: Math.round(performance.now() - started),
  };
  state.builtGeneration = generation;
  state.signature = signature;
  state.checkedAt = Date.now();
}

/** Starts a (re)build unless one is running. Resolves when the index reflects every write marked so far. */
export function refreshSearch() {
  state.building ??= build()
    .catch((error) => { console.error('[search] index build failed:', error.message); })
    .finally(() => {
      state.building = null;
      // A write was marked while this build was reading: build again so it is included.
      if (state.indexes && state.builtGeneration !== state.generation) refreshSearch();
    });
  return state.building;
}

/** Called after writes made through this process. Searches use MongoDB until the rebuild lands. */
export function markSearchStale() {
  state.generation += 1;
  if (state.indexes) refreshSearch();
}

function checkForOutsideWrites() {
  if (state.checking || state.building || Date.now() - state.checkedAt < CHECK_EVERY_MS) return;
  state.checkedAt = Date.now();
  state.checking = getDb().then(signatureOf)
    .then((signature) => { if (signature !== state.signature) markSearchStale(); })
    .catch(() => {})
    .finally(() => { state.checking = null; });
}

/**
 * The indexes when they are current, else null (and a build is started). `allowStale` accepts an
 * index that is waiting for a rebuild — fine for typeahead, not for result lists and counts.
 */
export function readyIndex({ allowStale = false } = {}) {
  if (!state.indexes) { refreshSearch(); return null; }
  checkForOutsideWrites();
  if (state.builtGeneration !== state.generation && !allowStale) return null;
  return state.indexes;
}

/** For server start-up and tests: builds once and waits for it. */
export async function warmSearch() {
  // A build already running may have started before the latest write, so wait for the next one too.
  for (let attempt = 0; attempt < 3 && (!state.indexes || state.builtGeneration !== state.generation); attempt += 1) {
    await refreshSearch();
  }
  return state.indexes;
}

export function searchStatus() {
  const indexes = state.indexes;
  return indexes ? {
    ready: state.builtGeneration === state.generation,
    builtAt: indexes.builtAt,
    buildMs: indexes.buildMs,
    counts: Object.fromEntries(['institutions', 'places', 'courses', 'exams'].map((key) => [key, indexes[key].records.length])),
  } : { ready: false };
}

// ---------------------------------------------------------------------------------------------
// Queries

const institutionRank = (record, base, context) => defaultRank(record, base, context);

// The directory's default order (most popular first, then by name), computed once per index build.
const popularOrder = new WeakMap();
const byPopularity = (a, b) => b.popularity - a.popularity || (a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0);

/**
 * Every public institution record (the in-memory copy), most popular first — for listing without a
 * text query, recommendations and "similar" lists. Null while no current index exists.
 * Records carry slug, name, place, type, streams, courseSlugs, NAAC, NIRF and popularity — not the
 * full document; callers fetch full documents only for the rows they finally show.
 */
export function institutionRecords({ allowStale = false } = {}) {
  const indexes = readyIndex({ allowStale });
  if (!indexes) return null;
  const { records } = indexes.institutions;
  if (!popularOrder.has(records)) popularOrder.set(records, records.toSorted(byPopularity));
  return popularOrder.get(records);
}

/** Every public institution matching `query` (and `filter`), best first. Null while no index is ready. */
export function searchInstitutions(query, { filter, allowStale = false } = {}) {
  const indexes = readyIndex({ allowStale });
  if (!indexes) return null;
  return search(indexes.institutions, query, { filter, rank: institutionRank });
}

/** Best course and exam matches (used by the catalogue search). Null while no index is ready. */
export function searchCatalogIndex(query, { limit = 20, allowStale = true } = {}) {
  const indexes = readyIndex({ allowStale });
  if (!indexes) return null;
  const courses = search(indexes.courses, query, { rank: defaultRank });
  const exams = search(indexes.exams, query, { rank: defaultRank });
  return {
    courses: courses.hits.slice(0, limit).map((hit) => hit.record),
    exams: exams.hits.slice(0, limit).map((hit) => hit.record),
    corrected: courses.corrected || exams.corrected,
  };
}

const upper = (value) => value.toUpperCase();

/**
 * One call for the typeahead: universities, courses, exams and places, each ranked on its own,
 * plus the corrected query when typos were fixed. Null while no index has been built yet.
 */
export function suggestEverything(query, { limit = 6 } = {}) {
  const indexes = readyIndex({ allowStale: true });
  if (!indexes) return null;
  const started = performance.now();
  const groups = {
    universities: search(indexes.institutions, query, { rank: institutionRank }),
    courses: search(indexes.courses, query, { rank: defaultRank }),
    exams: search(indexes.exams, query, { rank: defaultRank }),
    places: search(indexes.places, query, { rank: defaultRank }),
  };
  // What was typed exactly beats a guess: "neet" is the exam, not a misspelt "Netaji …".
  if (Object.values(groups).some((group) => group.mode === 'exact' && group.hits.length)) {
    for (const [key, group] of Object.entries(groups)) if (group.mode !== 'exact') groups[key] = { hits: [], corrected: '', mode: 'none' };
  }
  const { universities, courses, exams, places } = groups;
  const corrected = universities.corrected || courses.corrected || exams.corrected || places.corrected || '';
  return {
    query,
    corrected,
    universities: universities.hits.slice(0, limit).map(({ record, acronym }) => ({
      id: record.slug, name: record.name, shortName: record.shortName, city: record.city, state: record.state, type: record.type, logoUrl: record.logoUrl,
      ...(acronym && { matchedShortForm: upper(acronym) }),
    })),
    universityTotal: universities.hits.length,
    courses: courses.hits.slice(0, 4).map(({ record }) => ({ id: record.slug, name: record.name, fullName: record.fullName, field: record.field, icon: record.icon })),
    exams: exams.hits.slice(0, 3).map(({ record }) => ({ id: record.slug, name: record.name, field: record.field, icon: record.icon, href: record.href })),
    places: places.hits.slice(0, 3).map(({ record }) => ({ kind: record.kind, name: record.name, state: record.state, institutions: record.count })),
    tookMs: Math.round((performance.now() - started) * 100) / 100,
  };
}

import { COLLECTIONS, getDb } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { slugify, validate } from '../../lib/validation.js';
import { withFeeEstimates } from './fee-estimates.js';
import { derivedFields, foldText, nameKeyOf, domainOf, queryKeys, siteKeyOf, slugCandidates } from './normalize.js';
import { IMPORTABLE_FIELDS, INSTITUTION_CATEGORIES, INSTITUTION_FIELDS, INSTITUTION_TYPES, OWNERSHIP } from './schema.js';
import { isCredibleAward } from '../../scraper/deep.js';
import { isRetiredImage, liveImage } from '../../lib/retired-images.js';
import { institutionRecords, markSearchStale, searchInstitutions } from '../search/search-store.js';
import { PUBLIC_FILTER } from './public-filter.js';
import { listCourses } from '../catalog/catalog-service.js';

export { PUBLIC_FILTER };

// Public, identical for every visitor: answered from memory, refreshed in the background when old
// (staleMs). Writes through this API clear both at once (invalidateUniversityCaches).
const listCache = createTtlCache({ ttlMs: 60_000, staleMs: 15 * 60_000, maxEntries: 1000 });
const aggregateCache = createTtlCache({ ttlMs: 5 * 60_000, staleMs: 30 * 60_000, maxEntries: 200 });
export function invalidateUniversityCaches() {
  listCache.clear();
  aggregateCache.clear();
  markSearchStale();
}

const institutions = async () => (await getDb()).collection(COLLECTIONS.institutions);
const pick = (value, options) => (options.includes(value) ? value : '');
const MAX_PAGE_SIZE = 48;

// A listing row shows more than a name: one line about the institution, a campus photo, the fee it
// starts at and its placement headline. Everything here is already on the document, so the preview
// costs no extra query — it is clipped hard because a page carries up to 48 of them.
const firstSentence = (about) => {
  const text = String(about || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const stop = text.search(/[.!?](\s|$)/);
  const sentence = stop > 40 ? text.slice(0, stop + 1) : text;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
};

// Photos from the retired Cloudinary account no longer load; they are left out until replaced.
const liveGallery = (doc) => (doc.gallery ?? []).filter((row) => row?.url && !isRetiredImage(row.url));

const PACKAGE_KEYS = ['averagePackageLpa', 'highestPackageLpa', 'placedPercent'];
const previewOf = (doc) => {
  const programmes = doc.programmesOffered ?? [];
  const lowest = (field) => {
    const values = programmes.map((row) => row[field]).filter((value) => typeof value === 'number' && value > 0);
    return values.length ? Math.min(...values) : null;
  };
  // The lowest fee for the period the site prints most usefully: a year, else a semester, else the
  // whole programme. The period travels with the amount so it is never read as an annual figure.
  const [feeFromInr, feePeriod] = [['annualFeeInr', 'year'], ['semesterFeeInr', 'semester'], ['totalFeeInr', 'total']]
    .map(([field, period]) => [lowest(field), period]).find(([value]) => value !== null) ?? [null, null];
  // The single-season snapshot when it has a figure, else the newest season of the year-wise record;
  // the two are never mixed, so every figure keeps the year it belongs to.
  const snapshot = doc.placements ?? null;
  const placements = PACKAGE_KEYS.some((key) => typeof snapshot?.[key] === 'number') ? snapshot
    : (doc.placementHistory ?? []).find((row) => PACKAGE_KEYS.some((key) => typeof row[key] === 'number')) ?? snapshot;
  const gallery = liveGallery(doc);
  return {
    tagline: firstSentence(doc.about),
    photoUrl: liveImage(doc.coverUrl) || gallery[0]?.url || '',
    photoCount: gallery.length,
    // Programme names the student recognises, longest-form first so "B.Tech Computer Science" wins
    // over a bare "B.Tech" when both were extracted.
    topProgrammes: [...new Set(programmes.map((row) => row.name).filter(Boolean))].slice(0, 4),
    programmeCount: programmes.length,
    feeFromInr,
    feePeriod,
    placementSeasons: doc.placementHistory?.length ?? 0,
    averagePackageLpa: placements?.averagePackageLpa ?? null,
    highestPackageLpa: placements?.highestPackageLpa ?? null,
    placedPercent: placements?.placedPercent ?? null,
    placementYear: placements?.year ?? null,
    facilities: (doc.facilities ?? []).slice(0, 6),
    facilityCount: doc.facilities?.length ?? 0,
    activityCount: doc.activities?.length ?? 0,
    awardCount: (doc.awards ?? []).filter((award) => isCredibleAward(award?.title ?? '')).length,
    hostelAvailable: doc.campus?.hostelAvailable ?? null,
    campusAcres: doc.campus?.sizeAcres ?? null,
  };
};

// Exactly the fields toSummary/previewOf read. A full record carries every programme row with its fee
// notes and source links, the raw course list and the directory snapshot — about 30 KB each, of which
// a card uses ~3 KB — so list pages, featured, "similar" and recommendations read only these.
export const SUMMARY_PROJECTION = Object.freeze({
  slug: 1, name: 1, shortName: 1, type: 1, category: 1, ownership: 1, city: 1, district: 1, state: 1,
  establishedYear: 1, naacGrade: 1, nirfRank: 1, nirfYear: 1, nirfCategory: 1, approvals: 1, streams: 1, courseSlugs: 1,
  logoUrl: 1, coverUrl: 1, website: 1, verification: 1, isIllustrative: 1, demoRating: 1, art: 1, updatedAt: 1,
  'source.kind': 1, 'source.name': 1, 'source.url': 1, 'source.fetchedAt': 1,
  about: 1, 'gallery.url': 1, placements: 1, placementHistory: 1, facilities: 1, activities: 1, 'awards.title': 1,
  'campus.hostelAvailable': 1, 'campus.sizeAcres': 1,
  'programmesOffered.name': 1, 'programmesOffered.annualFeeInr': 1, 'programmesOffered.semesterFeeInr': 1, 'programmesOffered.totalFeeInr': 1,
});

export const toSummary = (doc) => ({
  id: doc.slug,
  name: doc.name,
  shortName: doc.shortName || '',
  type: doc.type || 'university',
  category: doc.category || 'other',
  ownership: doc.ownership || 'unknown',
  city: doc.city || '',
  district: doc.district || '',
  state: doc.state ?? null,
  establishedYear: doc.establishedYear ?? null,
  naacGrade: doc.naacGrade || '',
  nirfRank: doc.nirfRank ?? null,
  nirfYear: doc.nirfYear ?? null,
  nirfCategory: doc.nirfCategory || '',
  approvals: doc.approvals ?? [],
  streams: doc.streams ?? [],
  courseSlugs: doc.courseSlugs ?? [],
  logoUrl: liveImage(doc.logoUrl),
  coverUrl: liveImage(doc.coverUrl),
  website: doc.website || '',
  verification: doc.verification || 'unverified',
  isIllustrative: Boolean(doc.isIllustrative),
  demoRating: doc.demoRating ?? null,
  art: doc.art ?? null,
  source: doc.source ? { kind: doc.source.kind, name: doc.source.name || '', url: doc.source.url || '', fetchedAt: doc.source.fetchedAt ?? null } : null,
  updatedAt: doc.updatedAt ?? null,
  preview: previewOf(doc),
});

const toDetail = (doc) => ({
  ...toSummary(doc),
  aliases: doc.aliases ?? [],
  admissionUrl: doc.admissionUrl || '',
  email: doc.email || '',
  phone: doc.phone || '',
  address: doc.address || '',
  pincode: doc.pincode || '',
  affiliatedTo: doc.affiliatedTo || '',
  coursesOffered: doc.coursesOffered ?? [],
  about: doc.about || '',
  // Scraped depth (every field optional and absent when unknown) plus the raw directory snapshot.
  // The profile shows each with its source page; none of it is presented as verified.
  aboutSource: doc.aboutSource || '',
  gallery: liveGallery(doc),
  programmesOffered: doc.programmesOffered ?? [],
  placements: doc.placements ?? null,
  placementHistory: doc.placementHistory ?? [],
  facilities: doc.facilities ?? [],
  activities: doc.activities ?? [],
  campus: doc.campus ?? null,
  admissionNote: doc.admissionNote || '',
  entranceExams: doc.entranceExams ?? [],
  // Rows stored before the award test was tightened are filtered on the way out as well.
  awards: (doc.awards ?? []).filter((award) => isCredibleAward(award?.title ?? '')),
  directory: doc.directory ?? null,
});

// ---------------------------------------------------------------------------------------------
// Public listing

const SORTS = {
  relevance: { popularity: -1, nameKey: 1, _id: 1 },
  name: { nameKey: 1, _id: 1 },
  '-name': { nameKey: -1, _id: 1 },
  established: { establishedYear: 1, nameKey: 1, _id: 1 },
  nirf: { nirfRank: 1, nameKey: 1, _id: 1 },
};

export function parseListQuery(query = {}) {
  const { page, limit } = pagination(query, { defaultLimit: 24, maxLimit: MAX_PAGE_SIZE });
  return {
    q: queryString(query.q, 120),
    state: queryString(query.state, 60),
    city: queryString(query.city, 80),
    type: pick(queryString(query.type, 30), INSTITUTION_TYPES),
    category: pick(queryString(query.category, 40), INSTITUTION_CATEGORIES),
    ownership: pick(queryString(query.ownership, 20), OWNERSHIP),
    stream: queryString(query.stream, 40),
    course: slugify(queryString(query.course, 60)),
    naac: queryString(query.naac, 3),
    sort: Object.hasOwn(SORTS, query.sort) ? query.sort : 'relevance',
    page,
    limit,
  };
}

export function buildFilter(criteria, base = PUBLIC_FILTER) {
  const filter = { ...base };
  const keys = queryKeys(criteria.q);
  if (keys.length) filter.searchPrefixes = { $all: keys };
  if (criteria.state) filter.state = criteria.state;
  if (criteria.city) filter.city = criteria.city;
  if (criteria.type) filter.type = criteria.type;
  if (criteria.category) filter.category = criteria.category;
  if (criteria.ownership) filter.ownership = criteria.ownership;
  if (criteria.stream) filter.streams = criteria.stream;
  if (criteria.course) filter.courseSlugs = criteria.course;
  if (criteria.naac) filter.naacGrade = criteria.naac;
  if (criteria.sort === 'nirf') filter.nirfRank = { $type: 'number' };
  return filter;
}

// Curated fee rows for the institutions on one result page (at most 48 slugs).
async function programmeSummaries(slugs) {
  if (!slugs.length) return new Map();
  const rows = await (await getDb()).collection(COLLECTIONS.programmes).aggregate([
    { $match: { active: { $ne: false }, institutionSlug: { $in: slugs } } },
    { $group: { _id: '$institutionSlug', count: { $sum: 1 }, feeMin: { $min: '$annualTuitionInr' }, feeMax: { $max: '$annualTuitionInr' }, courseIds: { $addToSet: '$courseSlug' }, tuitionYear: { $first: '$tuitionYear' } } },
  ]).toArray();
  return new Map(rows.map(({ _id, ...summary }) => [_id, summary]));
}

// The same filters as buildFilter, applied to an in-memory search record (search-store.js).
function recordFilter(criteria) {
  const checks = [
    criteria.state && ((record) => record.state === criteria.state),
    criteria.city && ((record) => record.city === criteria.city),
    criteria.type && ((record) => record.type === criteria.type),
    criteria.category && ((record) => record.category === criteria.category),
    criteria.ownership && ((record) => record.ownership === criteria.ownership),
    criteria.stream && ((record) => record.streams.includes(criteria.stream)),
    criteria.course && ((record) => record.courseSlugs.includes(criteria.course)),
    criteria.naac && ((record) => record.naacGrade === criteria.naac),
    criteria.sort === 'nirf' && ((record) => record.nirfRank !== null),
  ].filter(Boolean);
  return checks.length ? (record) => checks.every((check) => check(record)) : undefined;
}

const byName = (a, b) => (a.record.nameKey < b.record.nameKey ? -1 : a.record.nameKey > b.record.nameKey ? 1 : 0);
// Mongo's ascending order puts missing values first; the in-memory sorts keep that behaviour.
const ascending = (field) => (a, b) => (a.record[field] ?? -Infinity) - (b.record[field] ?? -Infinity) || byName(a, b);
const HIT_SORTS = {
  name: byName,
  '-name': (a, b) => byName(b, a),
  established: ascending('establishedYear'),
  nirf: ascending('nirfRank'),
};

// A listing answered from the in-memory index: matching, filtering, counting and sorting happen in
// this process (about a millisecond for 20k records; typo-tolerant when there is a query), and only
// the page's rows are read from MongoDB. Without it, an unfiltered page cost a count over the whole
// collection (the public filter's $ne tests cannot use an index). Null when the index is not ready,
// so the caller falls back to the database query.
async function listFromIndex(criteria, skip) {
  let result;
  if (criteria.q) {
    result = searchInstitutions(criteria.q, { filter: recordFilter(criteria) });
  } else {
    const records = institutionRecords();
    const keep = recordFilter(criteria);
    result = records && { hits: (keep ? records.filter(keep) : records).map((record) => ({ record })), corrected: '', mode: 'exact' };
  }
  if (!result) return null;
  const hits = criteria.sort === 'relevance' ? result.hits : result.hits.toSorted(HIT_SORTS[criteria.sort]);
  const slugs = hits.slice(skip, skip + criteria.limit).map((hit) => hit.record.slug);
  // The page's documents and their fee rows only need the slugs, so both are read in parallel.
  const [rows, fees] = slugs.length ? await Promise.all([
    (async () => (await institutions()).find({ ...PUBLIC_FILTER, slug: { $in: slugs } }, { projection: SUMMARY_PROJECTION }).toArray())(),
    programmeSummaries(slugs),
  ]) : [[], new Map()];
  const bySlug = new Map(rows.map((doc) => [doc.slug, doc]));
  const shortForms = new Map(hits.slice(skip, skip + criteria.limit).filter((hit) => hit.acronym).map((hit) => [hit.record.slug, hit.acronym.toUpperCase()]));
  return {
    docs: slugs.map((slug) => bySlug.get(slug)).filter(Boolean),
    fees,
    total: hits.length,
    search: { corrected: result.corrected, mode: result.mode, shortForms },
  };
}

// `place` (from catalog placeFilter) replaces the exact city match, so a destination tile's link
// lists the same rows its count covers. It derives from criteria.city alone, so the key stays valid.
export async function listUniversities(query, { place = null } = {}) {
  const criteria = parseListQuery(query);
  const key = JSON.stringify({ ...criteria, place: Boolean(place) });
  return listCache.wrap(key, async () => {
    const filter = place ? { ...buildFilter({ ...criteria, city: '' }), $and: [place] } : buildFilter(criteria);
    const skip = (criteria.page - 1) * criteria.limit;
    const collection = await institutions();
    let docs;
    let total;
    let search = null;
    let fees = null;
    const folded = foldText(criteria.q);
    const indexed = !place ? await listFromIndex(criteria, skip) : null;
    if (indexed) {
      ({ docs, total, search, fees } = indexed);
    } else if (folded && criteria.sort === 'relevance') {
      // Names that start with the query rank above names that merely contain all its words.
      const [result] = await collection.aggregate([
        { $match: filter },
        { $addFields: { _rank: { $switch: { branches: [
          { case: { $eq: ['$nameKey', folded] }, then: 3 },
          { case: { $eq: [{ $indexOfCP: ['$nameKey', folded] }, 0] }, then: 2 },
          { case: { $gte: [{ $indexOfCP: ['$nameKey', folded] }, 0] }, then: 1 },
        ], default: 0 } } } },
        { $sort: { _rank: -1, ...SORTS.relevance } },
        { $facet: { items: [{ $skip: skip }, { $limit: criteria.limit }], total: [{ $count: 'value' }] } },
      // Fallback path only (the index is still building). A broad word such as "college" matches
      // thousands of full documents, more than the 32 MB in-memory sort allows.
      ], { allowDiskUse: true }).toArray();
      docs = result.items;
      total = result.total[0]?.value ?? 0;
    } else {
      [docs, total] = await Promise.all([
        collection.find(filter).sort(SORTS[criteria.sort]).skip(skip).limit(criteria.limit).toArray(),
        collection.countDocuments(filter),
      ]);
    }
    fees ??= await programmeSummaries(docs.map((doc) => doc.slug));
    const items = docs.map((doc) => ({
      ...toSummary(doc),
      programmes: fees.get(doc.slug) ?? null,
      ...(search?.shortForms.has(doc.slug) && { matchedShortForm: search.shortForms.get(doc.slug) }),
    }));
    return {
      items, total, page: criteria.page, limit: criteria.limit, pages: Math.max(1, Math.ceil(total / criteria.limit)), criteria,
      // `corrected`: the query as understood after fixing typos ("petrolium" → "petroleum"), else "".
      ...(search && criteria.q && { search: { corrected: search.corrected, mode: search.mode } }),
    };
  });
}

// Public landing-page set: the most popular visible institutions, with curated fee summaries.
export const FEATURED_MAX = 12;
// `course` narrows the set to institutions offering one course (the homepage's course tabs). An
// unknown or malformed slug simply matches nothing — it is never passed through as a pattern.
export async function featuredUniversities(rawLimit, rawCourse = '') {
  const limit = Math.min(Math.max(Number.parseInt(rawLimit, 10) || 8, 1), FEATURED_MAX);
  const course = /^[a-z0-9-]{1,40}$/.test(String(rawCourse)) ? String(rawCourse) : '';
  return aggregateCache.wrap(`featured:${limit}:${course}`, async () => {
    const filter = course ? { ...PUBLIC_FILTER, courseSlugs: course } : PUBLIC_FILTER;
    const docs = await (await institutions()).find(filter, { projection: SUMMARY_PROJECTION })
      .sort(SORTS.relevance).limit(limit).toArray();
    const fees = await programmeSummaries(docs.map((doc) => doc.slug));
    return { items: docs.map((doc) => ({ ...toSummary(doc), programmes: fees.get(doc.slug) ?? null })), limit };
  });
}

export async function suggestUniversities(rawQuery, limit = 8) {
  const q = queryString(rawQuery, 120);
  const size = Math.min(Math.max(Number(limit) || 8, 1), 15);
  // Typeahead may use an index that is a moment behind a write: it only offers names to pick from.
  const indexed = q ? searchInstitutions(q, { allowStale: true }) : null;
  if (indexed) {
    return {
      query: q,
      corrected: indexed.corrected,
      items: indexed.hits.slice(0, size).map(({ record, acronym }) => ({
        id: record.slug, name: record.name, shortName: record.shortName, city: record.city, state: record.state, type: record.type, logoUrl: record.logoUrl,
        ...(acronym && { matchedShortForm: acronym.toUpperCase() }),
      })),
    };
  }
  const keys = queryKeys(q);
  if (!keys.length) return { query: q, items: [] };
  return listCache.wrap(`suggest:${size}:${keys.join(' ')}`, async () => {
    const folded = foldText(q);
    const docs = await (await institutions()).find({ ...PUBLIC_FILTER, searchPrefixes: { $all: keys } }, {
      projection: { slug: 1, name: 1, shortName: 1, city: 1, state: 1, logoUrl: 1, nameKey: 1, popularity: 1, type: 1 },
    }).sort(SORTS.relevance).limit(size * 5).toArray();
    const rank = (doc) => (doc.nameKey === folded ? 3 : doc.nameKey.startsWith(folded) ? 2 : doc.nameKey.includes(folded) ? 1 : 0);
    const items = docs.toSorted((a, b) => rank(b) - rank(a)).slice(0, size)
      .map((doc) => ({ id: doc.slug, name: doc.name, shortName: doc.shortName || '', city: doc.city || '', state: doc.state ?? null, type: doc.type || 'university', logoUrl: doc.logoUrl || '' }));
    return { query: q, items };
  });
}

// Counts for filter panels. Cities are only listed inside a chosen state to keep the payload small.
export async function universityFacets(query = {}) {
  const state = queryString(query.state, 60);
  return aggregateCache.wrap(`facets:${state}`, async () => {
    const group = (field) => [{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $match: { _id: { $nin: [null, ''] } } }, { $sort: { count: -1, _id: 1 } }];
    const [result] = await (await institutions()).aggregate([
      { $match: PUBLIC_FILTER },
      { $facet: {
        states: group('state'),
        types: group('type'),
        categories: group('category'),
        ownership: group('ownership'),
        naac: group('naacGrade'),
        streams: [{ $unwind: '$streams' }, ...group('streams')],
        cities: state ? [{ $match: { state } }, ...group('city'), { $limit: 300 }] : [{ $match: { _id: null } }],
        total: [{ $count: 'value' }],
      } },
    ]).toArray();
    const list = (rows) => rows.map((row) => ({ value: row._id, count: row.count }));
    return {
      total: result.total[0]?.value ?? 0,
      states: list(result.states), types: list(result.types), categories: list(result.categories), ownership: list(result.ownership),
      naac: list(result.naac), streams: list(result.streams), cities: list(result.cities), state,
    };
  });
}

// Slugs for search-engine sitemaps, 10,000 per page (Google allows 50,000 per file).
export const SITEMAP_PAGE_SIZE = 10_000;
export async function sitemapPage(rawPage) {
  const page = /^\d{1,4}$/.test(String(rawPage ?? '')) ? Number(rawPage) : 0;
  return aggregateCache.wrap(`sitemap:${page}`, async () => {
    const collection = await institutions();
    const [total, docs] = await Promise.all([
      collection.countDocuments(PUBLIC_FILTER),
      collection.find(PUBLIC_FILTER, { projection: { slug: 1, updatedAt: 1 } }).sort({ _id: 1 }).skip(page * SITEMAP_PAGE_SIZE).limit(SITEMAP_PAGE_SIZE).toArray(),
    ]);
    return { page, pageSize: SITEMAP_PAGE_SIZE, pages: Math.ceil(total / SITEMAP_PAGE_SIZE), total, items: docs.map((doc) => ({ id: doc.slug, updatedAt: doc.updatedAt ?? null })) };
  });
}

// Similar: same region and a shared stream first, then a shared stream anywhere, then the same
// region, most popular first. Chosen from the in-memory index (no query) and then read as four
// documents; three database queries while the index is still building.
async function similarTo(db, doc) {
  const region = (item) => (doc.state ? item.state === doc.state : item.city === doc.city);
  const sharesStream = (item) => (doc.streams ?? []).some((stream) => item.streams.includes(stream));
  const records = institutionRecords({ allowStale: true });
  if (records) {
    const tiers = [doc.streams?.length && ((item) => region(item) && sharesStream(item)), doc.streams?.length && sharesStream, region].filter(Boolean);
    const slugs = [];
    for (const keep of tiers) {
      for (const item of records) {
        if (slugs.length >= 4) break;
        if (item.slug !== doc.slug && !slugs.includes(item.slug) && keep(item)) slugs.push(item.slug);
      }
    }
    if (!slugs.length) return [];
    const rows = await db.collection(COLLECTIONS.institutions).find({ ...PUBLIC_FILTER, slug: { $in: slugs } }, { projection: SUMMARY_PROJECTION }).toArray();
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    return slugs.map((value) => bySlug.get(value)).filter(Boolean);
  }
  const regionFilter = doc.state ? { state: doc.state } : { city: doc.city };
  const streams = doc.streams?.length ? { streams: { $in: doc.streams } } : null;
  const sets = await Promise.all([streams && { ...regionFilter, ...streams }, streams, regionFilter].filter(Boolean)
    .map((extra) => db.collection(COLLECTIONS.institutions).find({ ...PUBLIC_FILTER, slug: { $ne: doc.slug }, ...extra }, { projection: { searchPrefixes: 0 } }).sort(SORTS.relevance).limit(4).toArray()));
  return [...new Map(sets.flat().map((item) => [item.slug, item])).values()].slice(0, 4);
}

export async function getUniversity(rawSlug) {
  const slug = slugify(queryString(rawSlug, 120));
  if (!slug) throw new HttpError(404, 'University not found');
  return listCache.wrap(`detail:${slug}`, async () => {
    const db = await getDb();
    const doc = await db.collection(COLLECTIONS.institutions).findOne({ ...PUBLIC_FILTER, slug });
    if (!doc) throw new HttpError(404, 'University not found');
    // Everything else in one parallel round: programmes, the four similar records, the course
    // catalogue (cached) and the fee estimates (cached).
    const [programmes, similar, catalogue, item] = await Promise.all([
      db.collection(COLLECTIONS.programmes).find({ active: { $ne: false }, institutionSlug: slug }).sort({ order: 1, _id: 1 }).toArray(),
      similarTo(db, doc),
      listCourses(),
      withFeeEstimates(toDetail(doc)),
    ]);
    const courseSlugs = new Set([...(doc.courseSlugs ?? []), ...programmes.map((row) => row.courseSlug)]);
    const courses = catalogue.filter((course) => courseSlugs.has(course.id)); // catalogue order
    const visibleCourses = new Set(courses.map((course) => course.id));
    return {
      item,
      courses: courses.map((course) => ({ id: course.id, name: course.name, fullName: course.fullName ?? '', field: course.field ?? '' })),
      programmes: programmes.filter((row) => visibleCourses.has(row.courseSlug)).map((row) => ({
        id: row.slug, courseId: row.courseSlug, annualTuitionInr: row.annualTuitionInr, medianSalaryLpa: row.medianSalaryLpa ?? null,
        highestSalaryLpa: row.highestSalaryLpa ?? null, tuitionYear: row.tuitionYear, placementYear: row.placementYear,
      })),
      similar: similar.map(toSummary),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Import / scraper upsert

function cleanRecord(raw) {
  const fields = INSTITUTION_FIELDS.filter((field) => IMPORTABLE_FIELDS.includes(field.name) || field.name === 'slug');
  const { value, errors } = validate(fields, raw ?? {}, { partial: true });
  if (!value.name) errors.name = errors.name ?? 'This field is required';
  // Sources often publish a state but no city; one of the two is enough to place the institution.
  if (!value.city && !value.state) errors.city = errors.city ?? 'Enter a city or a state';
  // Drop empty values so a sparse source never blanks out data that another source filled in.
  const data = Object.fromEntries(Object.entries(value).filter(([, item]) => !(item === '' || item === null || (Array.isArray(item) && !item.length))));
  return { data, errors };
}

const BATCH = 500;
const sameDomainLimit = 5;

// Loads every stored record that could match a batch, in three indexed queries instead of three per row.
async function loadCandidates(collection, batch) {
  const slugs = [...new Set(batch.flatMap(({ data }) => [data.slug, ...slugCandidates(data)].filter(Boolean)))];
  const domains = [...new Set(batch.map(({ data }) => domainOf(data.website)).filter(Boolean))];
  const nameKeys = [...new Set(batch.map(({ data }) => nameKeyOf(data.name)))];
  const docs = await collection.find({ $or: [{ slug: { $in: slugs } }, { domain: { $in: domains } }, { nameKey: { $in: nameKeys } }] }, { projection: { searchPrefixes: 0 } }).toArray();
  // `queried` slugs were all looked up above, so a queried slug that is not in bySlug is known to be free.
  const index = { bySlug: new Map(), byDomain: new Map(), byNameKey: new Map(), queried: new Set(slugs) };
  for (const doc of docs) remember(index, doc);
  return index;
}

function remember(index, doc) {
  index.bySlug.set(doc.slug, doc);
  if (doc.domain) index.byDomain.set(doc.domain, [...(index.byDomain.get(doc.domain) ?? []), doc]);
  index.byNameKey.set(doc.nameKey, [...(index.byNameKey.get(doc.nameKey) ?? []), doc]);
}

// Fields a new value adds to instead of replacing. A placement season the site has since taken down
// stays on record; a season printed again replaces the stored row for that year.
const ACCUMULATING = { placementHistory: { key: 'year', max: 6 } };
const FEE_KEYS = ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'];
const hasFee = (row) => FEE_KEYS.some((key) => row?.[key] > 0);
const rowKey = (row) => String(row?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// A crawl that finds a programme but no fee must not erase a fee someone already recorded from the
// institution's own fee document. A fee the page prints now still replaces the stored one, and a
// stored fee row the crawl did not see this time is kept (fee pages are often client-rendered).
function keepStoredFees(existingRows, incomingRows) {
  const stored = new Map(existingRows.filter(hasFee).map((row) => [rowKey(row), row]));
  if (!stored.size) return incomingRows;
  const seen = new Set();
  const merged = incomingRows.map((row) => {
    const key = rowKey(row);
    seen.add(key);
    const old = stored.get(key);
    if (!old || hasFee(row)) return row;
    return { ...row, ...Object.fromEntries([...FEE_KEYS, 'feeYear', 'feeNote', 'sourcePage'].filter((field) => old[field] != null && old[field] !== '').map((field) => [field, old[field]])) };
  });
  for (const [key, row] of stored) if (!seen.has(key) && merged.length < 500) merged.push(row);
  return merged;
}

function accumulate(existing, data) {
  const out = { ...data };
  if (Array.isArray(data.programmesOffered) && Array.isArray(existing.programmesOffered)) out.programmesOffered = keepStoredFees(existing.programmesOffered, data.programmesOffered);
  for (const [field, { key, max }] of Object.entries(ACCUMULATING)) {
    if (!Array.isArray(data[field]) || !Array.isArray(existing[field])) continue;
    const rows = new Map(existing[field].map((row) => [row[key], row]));
    for (const row of data[field]) rows.set(row[key], row);
    out[field] = [...rows.values()].sort((a, b) => b[key] - a[key]).slice(0, max);
  }
  return out;
}

// Matching order: explicit slug, then official website domain + name, then name + state (or city),
// and last the same site with a drifted name.
// The last rule compares the whole site key (host + path), not just the host: university groups
// publish every constituent college under one hostname, so "only one record on this host" would
// otherwise fold a dental college and a fashion school into a single chimera record.
function findMatch(index, data) {
  if (data.slug && index.bySlug.has(data.slug)) return index.bySlug.get(data.slug);
  const nameKey = nameKeyOf(data.name);
  const domain = domainOf(data.website);
  const sameDomain = domain ? (index.byDomain.get(domain) ?? []).slice(0, sameDomainLimit) : [];
  const exact = sameDomain.find((doc) => doc.nameKey === nameKey);
  if (exact) return exact;
  const byName = (index.byNameKey.get(nameKey) ?? []).find((doc) => (data.state ? doc.state === data.state : doc.city === data.city));
  if (byName) return byName;
  const siteKey = siteKeyOf(data.website);
  return (siteKey && sameDomain.find((doc) => !doc.isIllustrative && siteKeyOf(doc.website) === siteKey)) || null;
}

async function allocateSlug(collection, data, index) {
  const free = async (candidate) => !index.bySlug.has(candidate)
    && (index.queried.has(candidate) || !await collection.countDocuments({ slug: candidate }, { limit: 1 }));
  if (data.slug && await free(data.slug)) return data.slug;
  for (const candidate of slugCandidates(data)) if (await free(candidate)) return candidate;
  const base = (slugCandidates(data).at(-1) || 'institution').slice(0, 94);
  for (let suffix = 2; suffix < 10_000; suffix += 1) if (await free(`${base}-${suffix}`)) return `${base}-${suffix}`;
  throw new Error(`Could not allocate a slug for ${data.name}`);
}

/**
 * Inserts or updates institutions from an import file or a scraper run, in batches of 500
 * (a handful of indexed reads and one bulk write per batch, so 20k rows take seconds, not hours).
 * - Fields listed in a record's `lockedFields` (set when an admin edits them) are never overwritten.
 * - Empty values never overwrite stored values; duplicate rows within one file merge into one record.
 * - New records start `unverified`; `publish` decides whether students see them before review.
 * @param {object[]} records
 * @param {{ source: { kind: 'import'|'scrape'|'seed', name?: string, url?: string }, publish?: boolean, dryRun?: boolean }} options
 */
export async function upsertUniversities(records, { source, publish = true, dryRun = false }) {
  if (!Array.isArray(records)) throw new HttpError(400, 'Expected a list of records');
  const collection = await institutions();
  const now = new Date();
  const summary = { inserted: 0, updated: 0, unchanged: 0, failed: 0, errors: [], items: [] };
  const note = (item) => { if (summary.items.length < 500) summary.items.push(item); };

  for (let start = 0; start < records.length; start += BATCH) {
    const batch = [];
    for (const [offset, raw] of records.slice(start, start + BATCH).entries()) {
      const index = start + offset;
      const { data, errors } = cleanRecord(raw);
      if (Object.keys(errors).length) {
        summary.failed += 1;
        if (summary.errors.length < 200) summary.errors.push({ index, name: typeof raw?.name === 'string' ? raw.name.slice(0, 120) : '', errors });
        continue;
      }
      // `fields` records what this source supplied, so reviewers can see which facts to check.
      batch.push({ index, data, recordSource: { kind: source.kind, name: source.name ?? '', url: raw.sourceUrl || source.url || '', fetchedAt: raw.fetchedAt ? new Date(raw.fetchedAt) : now, fields: Object.keys(data).filter((key) => key !== 'slug') } });
    }
    if (!batch.length) continue;
    const index = await loadCandidates(collection, batch);
    const pending = new Map(); // _id or new slug -> write state, so repeated rows merge before writing

    for (const { index: row, data, recordSource } of batch) {
      const existing = findMatch(index, data);
      if (existing) {
        const locked = new Set(existing.lockedFields ?? []);
        const changes = Object.fromEntries(Object.entries(accumulate(existing, data)).filter(([key, value]) => key !== 'slug' && !locked.has(key)
          && JSON.stringify(existing[key]) !== JSON.stringify(value)));
        if (!Object.keys(changes).length) { summary.unchanged += 1; note({ index: row, slug: existing.slug, action: 'unchanged' }); continue; }
        Object.assign(existing, changes);
        const key = existing._id ? String(existing._id) : existing.slug;
        const entry = pending.get(key) ?? { doc: existing, changes: {}, isNew: !existing._id };
        Object.assign(entry.changes, changes);
        // A directory import that corrects a couple of columns must not take the credit for a
        // record the crawler filled: the page would then stop saying the facts came from the
        // institution's own website. The richer provenance stands unless a crawl replaces it.
        entry.recordSource = existing.source?.kind === 'scrape' && recordSource.kind !== 'scrape' ? existing.source : recordSource;
        pending.set(key, entry);
        if (entry.isNew) { note({ index: row, slug: existing.slug, action: 'merged' }); continue; }
        summary.updated += 1;
        note({ index: row, slug: existing.slug, action: 'updated', fields: Object.keys(changes) });
        continue;
      }
      const slug = await allocateSlug(collection, data, index);
      const doc = {
        type: 'university', category: 'other', ownership: 'unknown', state: null, aliases: [], approvals: [], streams: [], courseSlugs: [], coursesOffered: [],
        ...data, slug,
        popularity: 0, verification: 'unverified', isIllustrative: false, active: Boolean(publish), lockedFields: [],
        source: recordSource, createdAt: now, updatedAt: now,
      };
      Object.assign(doc, derivedFields(doc));
      remember(index, doc);
      pending.set(slug, { doc, changes: {}, isNew: true, recordSource });
      summary.inserted += 1;
      note({ index: row, slug, action: 'inserted' });
    }

    const operations = [...pending.values()].map(({ doc, changes, isNew, recordSource }) => (isNew
      ? { insertOne: { document: { ...doc, ...derivedFields(doc) } } }
      : { updateOne: { filter: { _id: doc._id }, update: { $set: { ...changes, ...derivedFields(doc), source: recordSource, updatedAt: now } } } }));
    if (!dryRun && operations.length) {
      try {
        await collection.bulkWrite(operations, { ordered: false });
      } catch (error) {
        // A concurrent writer took a slug between our check and the write: report those rows, keep the rest.
        const failures = error.writeErrors ?? [];
        if (!failures.length || failures.some((failure) => failure.code !== 11000)) throw error;
        summary.inserted -= failures.length;
        summary.failed += failures.length;
        for (const failure of failures.slice(0, 50)) summary.errors.push({ index: -1, name: operations[failure.index]?.insertOne?.document?.name ?? '', errors: { slug: 'Already in use, retry the import' } });
      }
    }
  }
  if (!dryRun && (summary.inserted || summary.updated)) invalidateUniversityCaches();
  return summary;
}


// Recomputes nameKey / searchPrefixes / domain for every record (after changing the search rules).
export async function reindexUniversities() {
  const collection = await institutions();
  let updated = 0;
  let batch = [];
  for await (const doc of collection.find({}, { projection: { name: 1, shortName: 1, aliases: 1, city: 1, district: 1, state: 1, website: 1 } })) {
    batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: derivedFields(doc) } } });
    if (batch.length === 500) { await collection.bulkWrite(batch, { ordered: false }); updated += batch.length; batch = []; }
  }
  if (batch.length) { await collection.bulkWrite(batch, { ordered: false }); updated += batch.length; }
  invalidateUniversityCaches();
  return { updated };
}

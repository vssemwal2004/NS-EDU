import { activeFilter, COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { escapeRegex } from '../../lib/validation.js';
import { queryKeys } from '../universities/normalize.js';
import { PUBLIC_FILTER } from '../universities/university-service.js';

// Catalogue reads are identical for every visitor; admin writes clear this cache immediately.
const cache = createTtlCache({ ttlMs: 60_000, maxEntries: 200 });
export const invalidateCatalogCache = () => cache.clear();

const BY_ORDER = { order: 1, name: 1, _id: 1 };
const SEARCH_LIMIT = 20;

const toCourse = (course) => ({
  id: course.slug, name: course.name, fullName: course.fullName ?? '', field: course.field ?? '',
  icon: course.icon ?? 'cap', summary: course.summary ?? '', popular: Boolean(course.popular),
  ...(course.level && { level: course.level }),
});
// level, courseSlugs and note are optional admin fields; they are omitted when unset.
const toExam = (exam) => ({
  id: exam.slug, name: exam.name, field: exam.field ?? '', icon: exam.icon ?? 'cap', summary: exam.summary ?? '', href: exam.href,
  ...(exam.level && { level: exam.level }), ...(exam.courseSlugs?.length && { courseSlugs: exam.courseSlugs }), ...(exam.note && { note: exam.note }),
});
const toLocation = (place, institutions = 0) => ({ name: place.name, landmark: place.landmark ?? '', crop: place.crop ?? null, featured: Boolean(place.featured), institutions });
const matching = (fields, q) => ({ $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) });

async function find(name, filter = {}, options = {}) {
  const cursor = (await getDb()).collection(name).find({ ...activeFilter, ...filter }).sort(options.sort ?? BY_ORDER);
  return (options.limit ? cursor.limit(options.limit) : cursor).toArray();
}

export const listCourses = () => cache.wrap('courses', async () => (await find(COLLECTIONS.courses)).map(toCourse));
export const listExams = () => cache.wrap('exams', async () => (await find(COLLECTIONS.exams)).map(toExam));

export const listScholarships = () => cache.wrap('scholarships', async () => (await find(COLLECTIONS.scholarships, {}, { sort: { order: 1, label: 1, _id: 1 } }))
  .map((item) => ({ id: item.slug, label: item.label, href: item.href, description: item.description ?? '' })));

// How many directory institutions sit in each curated destination.
// The AISHE source names places by district, which rarely equals the destination tile's name:
// Bengaluru's records sit in "Bengaluru Urban"/"Bengaluru Rural" and Delhi's in "North", "South
// West" … with state "Delhi". So a tile matches on its leading word appearing as a whole word in
// the record's city, district or state. Counting runs over distinct city/district/state triples
// (about 1,500 of them), so a record that matches on two of the three is still counted once.
const placeWords = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function placeMatcher(name) {
  const full = placeWords(name);
  const lead = full.split(' ')[0];
  if (!lead) return () => false;
  const word = new RegExp(`(^| )${lead}( |$)`);
  return (triple) => triple.some((value) => value === full || word.test(value));
}

async function placeTriples() {
  const rows = await (await getDb()).collection(COLLECTIONS.institutions).aggregate([
    { $match: PUBLIC_FILTER },
    { $group: { _id: { city: '$city', district: '$district', state: '$state' }, count: { $sum: 1 } } },
  ]).toArray();
  return rows.map((row) => ({
    count: row.count,
    triple: [row._id.city, row._id.district, row._id.state].map(placeWords).filter(Boolean),
    state: placeWords(row._id.state),
  }));
}

const countFor = (triples, name) => {
  const matches = placeMatcher(name);
  return triples.reduce((total, row) => (matches(row.triple) ? total + row.count : total), 0);
};

export const listLocations = () => cache.wrap('locations', async () => {
  const sort = { featured: -1, order: 1, name: 1, _id: 1 };
  const [cities, states, triples] = await Promise.all([
    find(COLLECTIONS.cities, {}, { sort }), find(COLLECTIONS.states, {}, { sort }), placeTriples(),
  ]);
  return {
    cities: cities.map((place) => toLocation(place, countFor(triples, place.name))),
    // A state tile is an exact match: "Punjab" must not pick up "Punjabi University".
    states: states.map((place) => toLocation(place, triples.reduce((total, row) => (row.state === placeWords(place.name) ? total + row.count : total), 0))),
    // What the directory actually covers, which is far wider than the curated destination tiles.
    totals: {
      cities: new Set(triples.flatMap((row) => row.triple.filter((value) => value !== row.state))).size,
      states: new Set(triples.map((row) => row.state).filter(Boolean)).size,
    },
  };
});

// Programme rows whose institution and course are both visible, in seed/admin order.
// Only the institutions that programmes reference are loaded, never the whole directory.
async function visibleProgrammes(filter = {}) {
  const [programmes, courses] = await Promise.all([
    find(COLLECTIONS.programmes, filter, { sort: { order: 1, _id: 1 } }),
    find(COLLECTIONS.courses),
  ]);
  const institutions = await find(COLLECTIONS.institutions, { ...PUBLIC_FILTER, slug: { $in: [...new Set(programmes.map((row) => row.institutionSlug))] } });
  const institutionBySlug = new Map(institutions.map((item) => [item.slug, item]));
  const courseSlugs = new Set(courses.map((item) => item.slug));
  return programmes
    .filter((programme) => institutionBySlug.has(programme.institutionSlug) && courseSlugs.has(programme.courseSlug))
    .map((programme) => ({ programme, institution: institutionBySlug.get(programme.institutionSlug) }));
}

const toProgrammeRow = ({ programme, institution }) => ({
  id: programme.slug,
  collegeId: programme.institutionSlug,
  courseId: programme.courseSlug,
  name: institution.name,
  shortName: institution.shortName || institution.name,
  city: institution.city,
  state: institution.state ?? null,
  demoRating: institution.demoRating ?? null,
  art: institution.art ?? null,
  logoUrl: institution.logoUrl || '',
  annualTuitionInr: programme.annualTuitionInr,
  medianSalaryLpa: programme.medianSalaryLpa ?? null,
  highestSalaryLpa: programme.highestSalaryLpa ?? null,
  tuitionYear: programme.tuitionYear,
  placementYear: programme.placementYear,
  isIllustrative: Boolean(institution.isIllustrative),
});

// Curated programme rows (fees and placements entered by admins) power compare, budgets and
// course pages. The full university directory is served separately by /api/universities.
export const listColleges = () => cache.wrap('colleges', async () => (await visibleProgrammes()).map(toProgrammeRow));

export async function searchCatalog(rawQuery) {
  const query = (typeof rawQuery === 'string' ? rawQuery : '').trim().slice(0, 120);
  if (!query) return { query, courses: [], exams: [], colleges: [] };
  return cache.wrap(`search:${query.toLowerCase()}`, async () => {
    const keys = queryKeys(query);
    const [courses, exams, institutions] = await Promise.all([
      find(COLLECTIONS.courses, matching(['name', 'fullName', 'field', 'slug'], query), { limit: SEARCH_LIMIT }),
      find(COLLECTIONS.exams, matching(['name', 'field', 'slug'], query), { limit: SEARCH_LIMIT }),
      keys.length ? find(COLLECTIONS.institutions, { ...PUBLIC_FILTER, searchPrefixes: { $all: keys } }, { limit: SEARCH_LIMIT, sort: { popularity: -1, nameKey: 1, _id: 1 } }) : [],
    ]);
    const offered = new Map(institutions.map((item) => [item.slug, [...(item.courseSlugs ?? [])]]));
    if (offered.size) {
      for (const { programme } of await visibleProgrammes({ institutionSlug: { $in: [...offered.keys()] } })) {
        const list = offered.get(programme.institutionSlug);
        if (!list.includes(programme.courseSlug)) list.push(programme.courseSlug);
      }
    }
    return {
      query,
      courses: courses.map(toCourse),
      exams: exams.map(toExam),
      colleges: institutions.map((item) => ({ id: item.slug, name: item.name, city: item.city, state: item.state ?? null, type: item.type || 'university', courses: offered.get(item.slug) })),
    };
  });
}

// How many directory institutions offer each course, and each field of study. A field counts an
// institution once even when it offers several of the field's courses (B.Tech and M.Tech).
// Counts only — no institution details — so they are safe on the public homepage.
async function offeringCounts(db) {
  const institutions = db.collection(COLLECTIONS.institutions);
  const [courses, perCourse] = await Promise.all([
    db.collection(COLLECTIONS.courses).find(activeFilter, { projection: { slug: 1, field: 1 } }).toArray(),
    institutions.aggregate([
      { $match: { ...PUBLIC_FILTER, 'courseSlugs.0': { $exists: true } } },
      { $unwind: '$courseSlugs' },
      { $group: { _id: '$courseSlugs', count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const byField = new Map();
  for (const course of courses) if (course.field) byField.set(course.field, [...(byField.get(course.field) ?? []), course.slug]);
  const fields = await Promise.all([...byField].map(async ([field, slugs]) => [field, await institutions.countDocuments({ ...PUBLIC_FILTER, courseSlugs: { $in: slugs } })]));
  return { courseCounts: Object.fromEntries(perCourse.map((row) => [row._id, row.count])), fieldCounts: Object.fromEntries(fields) };
}

export const platformStats = () => cache.wrap('stats', async () => {
  const db = await getDb();
  const names = ['courses', 'exams', 'programmes', 'cities', 'states', 'scholarships'];
  const [counts, institutions, statesCovered, offerings] = await Promise.all([
    Promise.all(names.map((name) => db.collection(name).countDocuments(activeFilter))),
    db.collection(COLLECTIONS.institutions).countDocuments(PUBLIC_FILTER),
    db.collection(COLLECTIONS.institutions).distinct('state', PUBLIC_FILTER),
    offeringCounts(db),
  ]);
  return { ...Object.fromEntries(names.map((name, index) => [name, counts[index]])), institutions, statesWithInstitutions: statesCovered.filter(Boolean).length, ...offerings };
});

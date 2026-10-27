import { activeFilter, COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { escapeRegex } from '../../lib/validation.js';
import { INDIAN_STATES } from '../applications/schema.js';
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
const toLocation = (place, institutions = 0) => ({
  name: place.name, landmark: place.landmark ?? '', crop: place.crop ?? null, featured: Boolean(place.featured), institutions,
  image: place.imageUrl ? { url: place.imageUrl, alt: place.imageAlt || place.name } : null,
});
const matching = (fields, q) => ({ $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) });

async function find(name, filter = {}, options = {}) {
  const cursor = (await getDb()).collection(name).find({ ...activeFilter, ...filter }).sort(options.sort ?? BY_ORDER);
  return (options.limit ? cursor.limit(options.limit) : cursor).toArray();
}

export const listCourses = () => cache.wrap('courses', async () => (await find(COLLECTIONS.courses)).map(toCourse));
export const listExams = () => cache.wrap('exams', async () => (await find(COLLECTIONS.exams)).map(toExam));

export const listScholarships = () => cache.wrap('scholarships', async () => (await find(COLLECTIONS.scholarships, {}, { sort: { order: 1, label: 1, _id: 1 } }))
  .map((item) => ({ id: item.slug, label: item.label, href: item.href, description: item.description ?? '' })));

// How many directory institutions sit in each destination, so students see the busiest places first.
// The AISHE source names places by district, which rarely equals a tile's name: Bengaluru's records
// sit in "Bengaluru Urban"/"Bengaluru Rural", Mumbai's in "Mumbai Suburban", and Delhi's in "North",
// "South West" … with state "Delhi". Keys drop those qualifiers and fold a few historic spellings;
// anything else must match exactly, so "Punjab" never picks up "Punjabi University".
const placeWords = (value) => String(value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const QUALIFIER = /( (urban|rural|suburban|city|district))+$/;
const CITY_ALIASES = {
  bangalore: 'bengaluru', bombay: 'mumbai', madras: 'chennai', calcutta: 'kolkata', poona: 'pune', mysore: 'mysuru',
  gurgaon: 'gurugram', noida: 'gautam buddha nagar', 'greater noida': 'gautam buddha nagar', 'new delhi': 'delhi',
};
const STATE_ALIASES = {
  orissa: 'odisha', pondicherry: 'puducherry', uttaranchal: 'uttarakhand', 'nct of delhi': 'delhi', 'national capital territory of delhi': 'delhi',
  'andaman and nicobar': 'andaman and nicobar islands', 'dadra and nagar haveli': 'dadra and nagar haveli and daman and diu', 'daman and diu': 'dadra and nagar haveli and daman and diu',
};
// Curated tiles that cover more than one directory place (keys as produced by cityKey).
const CITY_GROUPS = { 'delhi ncr': ['delhi', 'gurugram', 'gautam buddha nagar', 'ghaziabad', 'faridabad'] };
// Every district of the NCT is one study city.
const CITY_STATES = new Set(['delhi']);

const stateKey = (value) => { const key = placeWords(value); return STATE_ALIASES[key] ?? key; };
const cityKey = (value) => { const key = placeWords(value).replace(QUALIFIER, ''); return CITY_ALIASES[key] ?? key; };
const tileKeys = (name) => CITY_GROUPS[placeWords(name)] ?? [cityKey(name)];
const STATE_NAMES = new Map(INDIAN_STATES.map((name) => [stateKey(name), name]));
const byCount = (a, b) => b.institutions - a.institutions || a.name.localeCompare(b.name);
const add = (map, key, count) => key && map.set(key, (map.get(key) ?? 0) + count);

// One $group over the public directory (about 1,500 city/district/state triples for 20k records),
// folded into city and state counts here. No index: PUBLIC_FILTER is two $ne tests, which an index
// cannot narrow, and the result is cached for a minute, so a collection scan per minute is cheaper
// than another index paid on every import write.
// `raw` keeps the stored spellings behind each city key, so a tile's directory link can select
// exactly the rows its count covers (see placeFilter).
const placeCounts = () => cache.wrap('place-counts', async () => {
  const rows = await (await getDb()).collection(COLLECTIONS.institutions).aggregate([
    { $match: PUBLIC_FILTER },
    { $group: { _id: { city: '$city', district: '$district', state: '$state' }, count: { $sum: 1 } } },
  ]).toArray();
  const cities = new Map();
  const states = new Map();
  const stateSpelling = new Map();
  const places = new Set();
  const raw = { byKey: new Map(), blankCities: new Set(), cityStates: new Set() };
  const rawOf = (key) => raw.byKey.get(key) ?? raw.byKey.set(key, { states: new Set(), cities: new Set(), districts: new Set() }).get(key);
  for (const { _id: { city = null, district = null, state = null }, count } of rows) {
    const sKey = stateKey(state);
    add(states, sKey, count);
    if (sKey && !stateSpelling.has(sKey)) stateSpelling.set(sKey, String(state).trim());
    const hasCity = Boolean(placeWords(city));
    const key = CITY_STATES.has(sKey) ? sKey : cityKey(hasCity ? city : district);
    add(cities, key, count);
    if (CITY_STATES.has(sKey)) { rawOf(key).states.add(state); raw.cityStates.add(state); }
    else if (hasCity) rawOf(key).cities.add(city);
    else if (key) { rawOf(key).districts.add(district); raw.blankCities.add(city); }
    for (const value of [city, district].map(placeWords)) if (value && value !== placeWords(state)) places.add(value);
  }
  return { cities, states, stateSpelling, raw, totals: { cities: places.size, states: states.size } };
});

// The directory filter for a city tile: the same rows its count covers (aliases, "Urban"/"Suburban"
// districts, every NCT district for Delhi, the NCR group). Null when nothing in the directory matches.
export async function placeFilter(name) {
  if (typeof name !== 'string' || !placeWords(name)) return null;
  const { raw } = await placeCounts();
  // A row in a city-state (Delhi) belongs to that city whatever its city field says.
  const outsideCityStates = { state: { $nin: [...raw.cityStates] } };
  const clauses = tileKeys(name).flatMap((key) => {
    const values = raw.byKey.get(key);
    if (!values) return [];
    return [
      values.states.size && { state: { $in: [...values.states] } },
      values.cities.size && { city: { $in: [...values.cities] }, ...outsideCityStates },
      values.districts.size && { city: { $in: [...raw.blankCities] }, district: { $in: [...values.districts] }, ...outsideCityStates },
    ].filter(Boolean);
  });
  return clauses.length ? { $or: clauses } : null;
}

export const listLocations = () => cache.wrap('locations', async () => {
  const db = await getDb();
  const [cities, states, allStateNames, counts] = await Promise.all([
    find(COLLECTIONS.cities), find(COLLECTIONS.states), db.collection(COLLECTIONS.states).distinct('name'), placeCounts(),
  ]);
  const cityCount = (place) => tileKeys(place.name).reduce((total, key) => total + (counts.cities.get(key) ?? 0), 0);
  // States with institutions but no curated entry still get a plain tile. Hidden entries count as
  // curated, so a state an admin switched off stays off.
  const curated = new Set(allStateNames.map(stateKey));
  const missing = [...counts.states].filter(([key]) => !curated.has(key))
    .map(([key, institutions]) => toLocation({ name: STATE_NAMES.get(key) ?? counts.stateSpelling.get(key) }, institutions));
  return {
    // `featured` and `order` stay editable but no longer decide the order: the busiest places come first.
    cities: cities.map((place) => toLocation(place, cityCount(place))).sort(byCount),
    states: [...states.map((place) => toLocation(place, counts.states.get(stateKey(place.name)) ?? 0)), ...missing].sort(byCount),
    // What the directory actually covers, which is far wider than the curated destination tiles.
    totals: counts.totals,
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

import { activeFilter, COLLECTIONS, getDb } from '../../db/collections.js';
import { escapeRegex } from '../../lib/validation.js';

const BY_ORDER = { order: 1, name: 1, _id: 1 };
const SEARCH_LIMIT = 20;

const toCourse = (course) => ({
  id: course.slug, name: course.name, fullName: course.fullName ?? '', field: course.field ?? '',
  icon: course.icon ?? 'cap', summary: course.summary ?? '', popular: Boolean(course.popular),
});
const toExam = (exam) => ({ id: exam.slug, name: exam.name, field: exam.field ?? '', icon: exam.icon ?? 'cap', summary: exam.summary ?? '', href: exam.href });
const toLocation = (place) => ({ name: place.name, landmark: place.landmark ?? '', crop: place.crop ?? null, featured: Boolean(place.featured) });
const matching = (fields, q) => ({ $or: fields.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) });

async function find(name, filter = {}, options = {}) {
  const cursor = (await getDb()).collection(name).find({ ...activeFilter, ...filter }).sort(options.sort ?? BY_ORDER);
  return (options.limit ? cursor.limit(options.limit) : cursor).toArray();
}

export const listCourses = async () => (await find(COLLECTIONS.courses)).map(toCourse);
export const listExams = async () => (await find(COLLECTIONS.exams)).map(toExam);

export async function listScholarships() {
  return (await find(COLLECTIONS.scholarships, {}, { sort: { order: 1, label: 1, _id: 1 } }))
    .map((item) => ({ id: item.slug, label: item.label, href: item.href, description: item.description ?? '' }));
}

export async function listLocations() {
  const sort = { featured: -1, order: 1, name: 1, _id: 1 };
  const [cities, states] = await Promise.all([find(COLLECTIONS.cities, {}, { sort }), find(COLLECTIONS.states, {}, { sort })]);
  return { cities: cities.map(toLocation), states: states.map(toLocation) };
}

// Programme rows whose institution and course are both visible, in seed/admin order.
async function visibleProgrammes(filter = {}) {
  const [programmes, institutions, courses] = await Promise.all([
    find(COLLECTIONS.programmes, filter, { sort: { order: 1, _id: 1 } }),
    find(COLLECTIONS.institutions),
    find(COLLECTIONS.courses),
  ]);
  const institutionBySlug = new Map(institutions.map((item) => [item.slug, item]));
  const courseSlugs = new Set(courses.map((item) => item.slug));
  return programmes
    .filter((programme) => institutionBySlug.has(programme.institutionSlug) && courseSlugs.has(programme.courseSlug))
    .map((programme) => ({ programme, institution: institutionBySlug.get(programme.institutionSlug) }));
}

export async function listColleges() {
  return (await visibleProgrammes()).map(({ programme, institution }) => ({
    id: programme.slug,
    collegeId: programme.institutionSlug,
    courseId: programme.courseSlug,
    name: institution.name,
    shortName: institution.shortName,
    city: institution.city,
    state: institution.state ?? null,
    demoRating: institution.demoRating,
    art: institution.art,
    annualTuitionInr: programme.annualTuitionInr,
    medianSalaryLpa: programme.medianSalaryLpa ?? null,
    highestSalaryLpa: programme.highestSalaryLpa ?? null,
    tuitionYear: programme.tuitionYear,
    placementYear: programme.placementYear,
    isIllustrative: institution.isIllustrative !== false,
  }));
}

export async function searchCatalog(rawQuery) {
  const query = (typeof rawQuery === 'string' ? rawQuery : '').trim().slice(0, 120);
  if (!query) return { query, courses: [], exams: [], colleges: [] };
  const [courses, exams, institutions] = await Promise.all([
    find(COLLECTIONS.courses, matching(['name', 'fullName', 'field', 'slug'], query), { limit: SEARCH_LIMIT }),
    find(COLLECTIONS.exams, matching(['name', 'field', 'slug'], query), { limit: SEARCH_LIMIT }),
    find(COLLECTIONS.institutions, matching(['name', 'shortName', 'city', 'state'], query), { limit: SEARCH_LIMIT }),
  ]);
  const offered = new Map(institutions.map((item) => [item.slug, []]));
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
    colleges: institutions.map((item) => ({ id: item.slug, name: item.name, city: item.city, state: item.state ?? null, courses: offered.get(item.slug) })),
  };
}

export async function platformStats() {
  const db = await getDb();
  const names = ['courses', 'exams', 'institutions', 'programmes', 'cities', 'states', 'scholarships'];
  const counts = await Promise.all(names.map((name) => db.collection(name).countDocuments(activeFilter)));
  return Object.fromEntries(names.map((name, index) => [name, counts[index]]));
}

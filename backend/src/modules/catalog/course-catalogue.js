// The course catalogue as a whole: adding the full list of Indian degrees, importing more from an
// admin's CSV/JSON file, and linking every institution's published programmes to catalogue courses.
// Linking is what lets "B.Tech Computer Science" on a college's own page appear under B.Tech, with
// its fee, on the course pages and in the B.Tech filter.
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { isPlainObject, slugify, validate } from '../../lib/validation.js';
import { seedCourses } from '../../data/seed/courses.js';
import { parseCsv, rowsToObjects, unguardCell } from '../../scraper/csv.js';
import { courseMatcher } from '../../scraper/extract.js';
import { resources } from '../admin/resources.js';
import { invalidateUniversityCaches } from '../universities/university-service.js';
import { invalidateCatalogCache } from './catalog-service.js';
import { invalidateOfferingsCache } from './course-offerings.js';

const MAX_ROWS = 2000;
const MAX_BYTES = 2 * 1024 * 1024;
export const COURSE_TEMPLATE_COLUMNS = ['name', 'slug', 'fullName', 'field', 'level', 'icon', 'summary', 'aliases', 'popular', 'order', 'active'];

/**
 * Re-derives `courseSlugs` and each programme row's `courseSlug` for every institution from the
 * programme names it publishes, plus the curated programme rows admins entered. Fields an admin has
 * locked are left alone. Writes only the records whose links changed, 500 at a time.
 */
export async function relinkInstitutions({ db: given, log = () => {} } = {}) {
  const db = given ?? await getDb();
  const courses = await db.collection(COLLECTIONS.courses).find({ active: { $ne: false } }, { projection: { _id: 0, slug: 1, name: 1, fullName: 1, aliases: 1 } }).toArray();
  const match = courseMatcher(courses);
  const curated = new Map((await db.collection(COLLECTIONS.programmes).aggregate([
    { $match: { active: { $ne: false } } }, { $group: { _id: '$institutionSlug', slugs: { $addToSet: '$courseSlug' } } },
  ]).toArray()).map((row) => [row._id, row.slugs]));
  const institutions = db.collection(COLLECTIONS.institutions);
  const cursor = institutions.find({}, { projection: { slug: 1, coursesOffered: 1, programmesOffered: 1, courseSlugs: 1, lockedFields: 1 } }).batchSize(500);
  const summary = { scanned: 0, updated: 0, linkedProgrammes: 0, institutionsWithCourses: 0 };
  let batch = [];
  const flush = async () => {
    if (batch.length) await institutions.bulkWrite(batch, { ordered: false });
    batch = [];
  };
  for await (const doc of cursor) {
    summary.scanned += 1;
    const locked = new Set(doc.lockedFields ?? []);
    const rows = Array.isArray(doc.programmesOffered) ? doc.programmesOffered : [];
    const linkedRows = locked.has('programmesOffered') ? rows : rows.map((row) => {
      const courseSlug = match(row?.name ?? '');
      const { courseSlug: _previous, ...rest } = row ?? {};
      return courseSlug ? { ...rest, courseSlug } : rest;
    });
    const slugs = [...new Set([
      ...(doc.coursesOffered ?? []).map(match),
      ...linkedRows.map((row) => row.courseSlug),
      ...(curated.get(doc.slug) ?? []),
    ].filter(Boolean))].slice(0, 150);
    summary.linkedProgrammes += linkedRows.filter((row) => row.courseSlug).length;
    const set = {};
    if (!locked.has('courseSlugs') && JSON.stringify(slugs) !== JSON.stringify(doc.courseSlugs ?? [])) set.courseSlugs = slugs;
    if (!locked.has('programmesOffered') && JSON.stringify(linkedRows) !== JSON.stringify(rows)) set.programmesOffered = linkedRows;
    if ((set.courseSlugs ?? doc.courseSlugs ?? []).length) summary.institutionsWithCourses += 1;
    if (Object.keys(set).length) {
      batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
      summary.updated += 1;
    }
    if (batch.length >= 500) {
      await flush();
      log(`  ${summary.scanned} scanned, ${summary.updated} relinked…`);
    }
  }
  await flush();
  invalidateUniversityCaches();
  invalidateCatalogCache();
  invalidateOfferingsCache();
  return summary;
}

/**
 * Adds every catalogue course that is not in the database yet and fills fields added later
 * (aliases, level) where they are missing. Courses an admin has edited keep their edits; the one
 * exception is the old "Healthcare" field on B.Sc Nursing, moved to "Nursing" only if unchanged.
 */
export async function syncCatalogue({ db: given } = {}) {
  const db = given ?? await getDb();
  const collection = db.collection(COLLECTIONS.courses);
  const now = new Date();
  const inserted = await collection.bulkWrite(seedCourses.map((course) => ({
    updateOne: { filter: { slug: course.slug }, update: { $setOnInsert: { ...course, createdAt: now, updatedAt: now } }, upsert: true },
  })), { ordered: false });
  let backfilled = 0;
  for (const field of ['aliases', 'level', 'fullName']) {
    const operations = seedCourses.filter((course) => course[field] !== undefined && course[field] !== '').map((course) => ({
      updateOne: { filter: { slug: course.slug, $or: [{ [field]: { $exists: false } }, { [field]: '' }, { [field]: [] }] }, update: { $set: { [field]: course[field] } } },
    }));
    if (operations.length) backfilled += (await collection.bulkWrite(operations, { ordered: false })).modifiedCount;
  }
  backfilled += (await collection.updateOne({ slug: 'nursing', field: 'Healthcare' }, { $set: { field: 'Nursing' } })).modifiedCount;
  invalidateCatalogCache();
  return { added: inserted.upsertedCount, backfilled, total: await collection.countDocuments({}) };
}

const flat = (key) => String(key ?? '').toLowerCase().replace(/[^a-z]/g, '');
const HEADERS = new Map([
  ...COURSE_TEMPLATE_COLUMNS.map((name) => [flat(name), name]),
  ...resources.courses.fields.map((field) => [flat(field.label), field.name]),
]);
const splitList = (value) => (typeof value === 'string' ? value.split(value.includes(';') ? ';' : ',').map((part) => part.trim()).filter(Boolean) : value);

function parseCourseFile(content, format) {
  if (typeof content !== 'string' || !content.trim()) throw new HttpError(400, 'The file is empty.');
  if (Buffer.byteLength(content) > MAX_BYTES) throw new HttpError(413, 'Course files are limited to 2 MB.');
  if (format === 'json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new HttpError(400, 'The file is not valid JSON.'); }
    const list = Array.isArray(parsed) ? parsed : parsed?.items ?? parsed?.courses;
    if (!Array.isArray(list) || list.some((item) => !isPlainObject(item))) throw new HttpError(400, 'JSON must be an array of courses (or { "items": [...] }).');
    if (list.length > MAX_ROWS) throw new HttpError(400, `Import at most ${MAX_ROWS} courses at a time.`);
    return list;
  }
  let rows;
  try { rows = parseCsv(content, { maxRows: MAX_ROWS + 1 }); } catch (error) { throw new HttpError(400, error.message); }
  if (rows.length < 2 || !rows[0].some((name) => HEADERS.get(flat(name)) === 'name')) throw new HttpError(400, 'The CSV needs a header row with a "name" column and at least one course.');
  return rowsToObjects(rows, (name) => HEADERS.get(flat(name)) ?? '').map((row) => Object.fromEntries(Object.entries(row)
    .map(([key, value]) => [key, key === 'aliases' ? splitList(unguardCell(value)) : unguardCell(value)])));
}

/**
 * Admin bulk import: each row adds a course or updates the course with the same slug (generated
 * from the name when absent). Rows are validated against the same rules as the admin form; a
 * broken row is reported and skipped. Institutions are relinked afterwards so new courses fill up.
 */
export async function importCourses({ content, format, dryRun = false }) {
  const records = parseCourseFile(content, format);
  const fields = resources.courses.fields;
  const errors = [];
  const valid = [];
  for (const [index, raw] of records.entries()) {
    const input = { ...raw, slug: slugify(String(raw.slug ?? '') || String(raw.name ?? '')) };
    if (typeof input.popular === 'string') input.popular = ['true', '1', 'yes'].includes(input.popular.toLowerCase());
    if (typeof input.active === 'string') input.active = !['false', '0', 'no'].includes(input.active.toLowerCase());
    const { value, errors: rowErrors } = validate(fields, input);
    if (Object.keys(rowErrors).length || !value.slug) {
      if (errors.length < 100) errors.push({ row: index + 2, name: String(raw.name ?? '').slice(0, 80), errors: { ...rowErrors, ...(!value.slug ? { slug: 'Could not make a slug' } : {}) } });
      continue;
    }
    valid.push(value);
  }
  const db = await getDb();
  const existing = new Set((await db.collection(COLLECTIONS.courses).find({ slug: { $in: valid.map((row) => row.slug) } }, { projection: { slug: 1 } }).toArray()).map((row) => row.slug));
  const summary = { rows: records.length, added: valid.filter((row) => !existing.has(row.slug)).length, updated: valid.filter((row) => existing.has(row.slug)).length, failed: records.length - valid.length, errors, dryRun: Boolean(dryRun) };
  if (dryRun || !valid.length) return summary;
  const now = new Date();
  await db.collection(COLLECTIONS.courses).bulkWrite(valid.map(({ slug, ...rest }) => ({
    updateOne: { filter: { slug }, update: { $set: { ...rest, slug, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true },
  })), { ordered: false });
  invalidateCatalogCache();
  summary.relinked = await relinkInstitutions({ db });
  return summary;
}

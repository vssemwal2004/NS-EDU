import { COLLECTIONS, getDb, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { eventsCollection } from './events.js';

// Admin-only reporting. Every figure is produced by an aggregation that returns grouped rows:
// raw events are never pulled into memory except on the per-student drill-down, which is paginated.
const WINDOWS = [7, 30, 90];
const TIMEZONE = 'Asia/Kolkata';
const FACET_LIMIT = 20;

export const windowDays = (value) => (WINDOWS.includes(Number(value)) ? Number(value) : 7);
const since = (days) => new Date(Date.now() - days * 86_400_000);
const day = { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: TIMEZONE } };
const counted = (field, limit = FACET_LIMIT) => [
  { $match: { [field]: { $nin: [null, ''] } } },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: limit },
];
const rows = (list) => list.map((row) => ({ value: row._id, count: row.count }));

async function institutionNames(slugs) {
  if (!slugs.length) return new Map();
  const docs = await (await getDb()).collection(COLLECTIONS.institutions)
    .find({ slug: { $in: slugs } }, { projection: { slug: 1, name: 1, city: 1, state: 1 } }).toArray();
  return new Map(docs.map((doc) => [doc.slug, doc]));
}

const withNames = async (list) => {
  const names = await institutionNames(list.map((row) => row._id));
  return list.map((row) => ({
    slug: row._id, count: row.count,
    name: names.get(row._id)?.name ?? row._id,
    place: [names.get(row._id)?.city, names.get(row._id)?.state].filter(Boolean).join(', '),
  }));
};

/** Everything the /admin/insights landing screen needs, in one aggregation. */
export async function insightsOverview(query = {}) {
  const days = windowDays(query.days);
  const [result] = await (await eventsCollection()).aggregate([
    { $match: { at: { $gte: since(days) } } },
    { $facet: {
      total: [{ $count: 'value' }],
      byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
      topSearches: [{ $match: { type: 'search', query: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 }, lastAt: { $max: '$at' } } },
        { $sort: { count: -1, _id: 1 } }, { $limit: FACET_LIMIT }],
      noResults: [{ $match: { type: 'search', results: 0, query: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 }, lastAt: { $max: '$at' } } },
        { $sort: { count: -1, _id: 1 } }, { $limit: FACET_LIMIT }],
      topViewed: [{ $match: { type: 'view', institutionSlug: { $nin: [null, ''] } } },
        { $group: { _id: '$institutionSlug', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: FACET_LIMIT }],
      states: counted('state'),
      cities: counted('city'),
      streams: counted('stream'),
      courses: counted('courseSlug'),
      dailyStudents: [{ $match: { studentId: { $ne: null } } },
        { $group: { _id: { day, studentId: '$studentId' } } },
        { $group: { _id: '$_id.day', count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 90 }],
      dailyEvents: [{ $group: { _id: day, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 90 }],
      signedIn: [{ $group: { _id: { $ne: ['$studentId', null] }, count: { $sum: 1 } } }],
    } },
  ], { allowDiskUse: true }).toArray();

  const signedIn = Object.fromEntries((result.signedIn ?? []).map((row) => [row._id ? 'students' : 'visitors', row.count]));
  return {
    days,
    total: result.total[0]?.value ?? 0,
    byType: rows(result.byType),
    topSearches: result.topSearches.map((row) => ({ query: row._id, count: row.count, lastAt: row.lastAt })),
    noResults: result.noResults.map((row) => ({ query: row._id, count: row.count, lastAt: row.lastAt })),
    topViewed: await withNames(result.topViewed),
    states: rows(result.states),
    cities: rows(result.cities),
    streams: rows(result.streams),
    courses: rows(result.courses),
    dailyStudents: result.dailyStudents.map((row) => ({ day: row._id, count: row.count })),
    dailyEvents: result.dailyEvents.map((row) => ({ day: row._id, count: row.count })),
    fromSignedIn: signedIn.students ?? 0,
    fromVisitors: signedIn.visitors ?? 0,
  };
}

async function groupedPage({ match, field, page, limit, lower = false }) {
  const [result] = await (await eventsCollection()).aggregate([
    { $match: match },
    { $group: { _id: lower ? { $toLower: `$${field}` } : `$${field}`, count: { $sum: 1 }, lastAt: { $max: '$at' } } },
    { $sort: { count: -1, _id: 1 } },
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'value' }] } },
  ], { allowDiskUse: true }).toArray();
  return { items: result.items, total: result.total[0]?.value ?? 0 };
}

/** Top searches, or only the ones that returned nothing (`noResults=true`): the content-gap list. */
export async function searchReport(query = {}) {
  const days = windowDays(query.days);
  const { page, limit } = pagination(query, { defaultLimit: 25, maxLimit: 100 });
  const noResults = query.noResults === 'true' || query.noResults === true;
  const match = { at: { $gte: since(days) }, type: 'search', query: { $nin: [null, ''] }, ...(noResults && { results: 0 }) };
  const { items, total } = await groupedPage({ match, field: 'query', page, limit, lower: true });
  return { days, noResults, page, limit, total, items: items.map((row) => ({ query: row._id, count: row.count, lastAt: row.lastAt })) };
}

/** Most viewed institutions in the window. */
export async function viewedReport(query = {}) {
  const days = windowDays(query.days);
  const { page, limit } = pagination(query, { defaultLimit: 25, maxLimit: 100 });
  const match = { at: { $gte: since(days) }, type: 'view', institutionSlug: { $nin: [null, ''] } };
  const { items, total } = await groupedPage({ match, field: 'institutionSlug', page, limit });
  return { days, page, limit, total, items: await withNames(items) };
}

/** One student's own search and view history, newest first. Admin-only drill-down. */
export async function studentActivity(id, query = {}) {
  const studentId = toObjectId(id);
  if (!studentId) throw new HttpError(404, 'Student not found');
  const { page, limit } = pagination(query, { defaultLimit: 25, maxLimit: 100 });
  const type = queryString(query.type, 20);
  const db = await getDb();
  const filter = { studentId, ...(type && { type }) };
  const [student, items, total] = await Promise.all([
    db.collection(COLLECTIONS.students).findOne({ _id: studentId }, { projection: { email: 1, phone: 1, name: 1, createdAt: 1, lastLoginAt: 1 } }),
    (await eventsCollection()).find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    (await eventsCollection()).countDocuments(filter),
  ]);
  if (!student) throw new HttpError(404, 'Student not found');
  const names = await institutionNames([...new Set(items.map((row) => row.institutionSlug).filter(Boolean))]);
  return {
    student: { id: studentId.toString(), email: student.email ?? '', phone: student.phone ?? '', name: student.name ?? '', createdAt: student.createdAt ?? null, lastLoginAt: student.lastLoginAt ?? null },
    page, limit, total,
    items: items.map((row) => ({
      id: row._id.toString(), type: row.type, query: row.query, state: row.state, city: row.city, stream: row.stream,
      courseSlug: row.courseSlug, results: row.results, path: row.path, at: row.at,
      institutionSlug: row.institutionSlug, institutionName: names.get(row.institutionSlug)?.name ?? '',
    })),
  };
}

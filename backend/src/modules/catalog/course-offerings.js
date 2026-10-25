// Where a course is taught and what it costs, from the programme rows institutions publish on their
// own sites (each row linked to a catalogue course by course-catalogue.js). The figures are the
// published ones, quoted per period: an annual fee is never mixed with a semester or a total fee.
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { slugify } from '../../lib/validation.js';
import { PUBLIC_FILTER } from '../universities/university-service.js';

const cache = createTtlCache({ ttlMs: 5 * 60_000, maxEntries: 500 });
export const invalidateOfferingsCache = () => cache.clear();

const SORTS = ['popular', 'fee', '-fee', 'name'];
const ROW_FIELDS = ['name', 'level', 'durationYears', 'annualFeeInr', 'semesterFeeInr', 'totalFeeInr', 'feeYear', 'feeNote', 'sourcePage'];

// Priced rows first. A bare "B.Tech" or "B.Tech Programmes" — a menu heading the crawl also read as
// a programme — adds nothing once the institution's named B.Tech programmes are listed: with the
// course's own names and filler words taken out, nothing is left of it.
const words = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const FILLER = /\b(programs?|programmes?|courses?|degrees?|\d+|years?|yrs?|full time|regular|of|in|and|the|hons?|honours)\b/g;
const priced = (row) => ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'].some((key) => typeof row[key] === 'number');
function usefulRows(rows, course) {
  const names = [course.name, course.fullName, ...(course.aliases ?? [])].map(words).filter(Boolean).sort((a, b) => b.length - a.length);
  const generic = (row) => {
    let rest = ` ${words(row.name)} `;
    for (const name of names) rest = rest.replace(` ${name} `, ' ');
    return !rest.replace(FILLER, ' ').trim();
  };
  const specific = rows.filter((row) => priced(row) || !generic(row));
  return (specific.length ? specific : rows.slice(0, 1)).toSorted((a, b) => Number(priced(b)) - Number(priced(a)));
}

const rowsFor = (slug) => ({ $filter: { input: { $ifNull: ['$programmesOffered', []] }, cond: { $eq: ['$$this.courseSlug', slug] } } });

function percentile(sorted, share) {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * share;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (at - low));
}
const spread = (values) => {
  const sorted = values.filter((value) => typeof value === 'number' && value > 0).toSorted((a, b) => a - b);
  return sorted.length ? { count: sorted.length, min: sorted[0], p25: percentile(sorted, 0.25), median: percentile(sorted, 0.5), p75: percentile(sorted, 0.75), max: sorted.at(-1) } : null;
};

// Counts and fee spread over every public institution offering the course; safe to show anyone.
const offeringStats = (slug) => cache.wrap(`stats:${slug}`, async () => {
  const rows = await (await getDb()).collection(COLLECTIONS.institutions).aggregate([
    { $match: { ...PUBLIC_FILTER, courseSlugs: slug } },
    { $project: { state: 1, ownership: 1, rows: rowsFor(slug) } },
    { $project: { state: 1, ownership: 1, annual: { $min: '$rows.annualFeeInr' }, semester: { $min: '$rows.semesterFeeInr' }, total: { $min: '$rows.totalFeeInr' } } },
  ]).toArray();
  const byState = new Map();
  for (const row of rows) if (row.state) byState.set(row.state, (byState.get(row.state) ?? 0) + 1);
  const feeOf = (ownership) => spread(rows.filter((row) => !ownership || row.ownership === ownership).map((row) => row.annual));
  return {
    institutions: rows.length,
    withFee: rows.filter((row) => row.annual ?? row.semester ?? row.total).length,
    annualFee: feeOf(''),
    annualFeePublic: feeOf('public'),
    annualFeePrivate: feeOf('private'),
    semesterFee: spread(rows.map((row) => row.semester)),
    totalFee: spread(rows.map((row) => row.total)),
    states: [...byState].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
});

/**
 * One course's offerings. Everyone gets the counts and the fee spread; the named institutions,
 * with each one's programme rows for this course, are returned only to signed-in viewers, as the
 * university directory itself is.
 */
export async function courseOfferings(rawSlug, query = {}, { withInstitutions = false } = {}) {
  const slug = slugify(queryString(rawSlug, 60));
  const db = await getDb();
  const course = slug && await db.collection(COLLECTIONS.courses).findOne({ slug, active: { $ne: false } }, { projection: { _id: 0, slug: 1, name: 1, fullName: 1, aliases: 1 } });
  if (!course) throw new HttpError(404, 'Course not found');
  const stats = await offeringStats(slug);
  const state = queryString(query.state, 60);
  const sort = SORTS.includes(query.sort) ? query.sort : 'popular';
  const { page, limit, skip } = pagination(query, { defaultLimit: 20, maxLimit: 50 });
  const base = { course: slug, stats, state, sort, page, limit };
  if (!withInstitutions) return { ...base, items: [], total: state ? stats.states.find((row) => row.name === state)?.count ?? 0 : stats.institutions, pages: 0, requiresLogin: true };

  return cache.wrap(`list:${slug}:${state}:${sort}:${page}:${limit}`, async () => {
    const order = {
      popular: { popularity: -1, nameKey: 1, _id: 1 },
      name: { nameKey: 1, _id: 1 },
      fee: { hasFee: -1, feeFrom: 1, nameKey: 1, _id: 1 },
      '-fee': { hasFee: -1, feeFrom: -1, nameKey: 1, _id: 1 },
    }[sort];
    const [result] = await db.collection(COLLECTIONS.institutions).aggregate([
      { $match: { ...PUBLIC_FILTER, courseSlugs: slug, ...(state ? { state } : {}) } },
      { $addFields: { rows: rowsFor(slug) } },
      { $addFields: { feeFrom: { $min: '$rows.annualFeeInr' } } },
      { $addFields: { hasFee: { $cond: [{ $eq: [{ $type: '$feeFrom' }, 'missing'] }, 0, { $cond: [{ $eq: ['$feeFrom', null] }, 0, 1] }] } } },
      { $sort: order },
      { $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: {
          _id: 0, slug: 1, name: 1, city: 1, state: 1, logoUrl: 1, coverUrl: 1, ownership: 1, type: 1, category: 1, naacGrade: 1, nirfRank: 1, nirfCategory: 1,
          rows: 1, feeFrom: 1,
        } }],
        total: [{ $count: 'count' }],
      } },
    ]).toArray();
    const total = result.total[0]?.count ?? 0;
    return {
      ...base,
      items: result.items.map(({ slug: id, rows, feeFrom, ...item }) => {
        const shown = usefulRows(rows, course);
        return {
          id, ...item, feeFromInr: feeFrom ?? null, rowCount: shown.length,
          programmes: shown.slice(0, 8).map((row) => Object.fromEntries(ROW_FIELDS.filter((key) => row[key] !== undefined && row[key] !== '').map((key) => [key, row[key]]))),
        };
      }),
      total, pages: Math.max(1, Math.ceil(total / limit)), requiresLogin: false,
    };
  });
}

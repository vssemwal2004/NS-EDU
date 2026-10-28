// Leads dashboard: KPI counts, a daily trend and breakdowns for one IST date range.
//
// Why not one $facet: $facet buffers every matched document and re-reads the buffer once per
// facet, which measured ~10x slower than separate queries on 60k leads/month. Instead:
// - fixed-vocabulary breakdowns (days, statuses, channels, states) are index-only counts on the
//   `<field>, createdAt` compound indexes (no documents are read);
// - open-ended ones (courses, school drives, career fields) are small $group passes that read
//   only their own channel's documents through the channel index;
// - admin workload is one $group over the range (createdAt index) by assignee list and status.
// Measured on 200k synthetic leads: see src/scripts/seed-synthetic-leads.js.
import { collection, COLLECTIONS } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { CLOSED_STATUSES, INDIAN_STATES, STATUSES } from './schema.js';
import { accessFilter, applications, CHANNEL_LABELS, CHANNELS, countLeads, DAY, filterKey, IST_OFFSET, istDayStart, istToday, leadFilter, staffEmails, statusLabel } from './service.js';

export const INSIGHT_RANGES = ['today', '7d', '30d', '90d', 'month'];
const PRESET_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
export const MAX_RANGE_DAYS = 400;
// Still being worked: everything before an outcome (admitted) or a dead end (closed statuses).
export const PIPELINE_STATUSES = STATUSES.filter((status) => status !== 'admitted' && !CLOSED_STATUSES.includes(status));
const TOP = { state: 12, course: 10, school: 10, careerField: 10 };
const CHANNEL_INDEX = { channel: 1, createdAt: -1, _id: -1 };
const ASSIGNEE_INDEX = { assignedEmployeeIds: 1, createdAt: -1, _id: -1 };
const QUERY_MS = 15_000;
const PARALLEL = 16;

const istDate = (instant) => new Date(instant.getTime() + IST_OFFSET).toISOString().slice(0, 10);
const shiftDay = (day, count) => istDate(new Date(istDayStart(day).getTime() + count * DAY));
// istDayStart rolls "2026-02-31" over into March; the dashboard rejects such days instead.
const realDay = (value) => { const start = istDayStart(value); return Boolean(start) && istDate(start) === value; };
const scopeOf = (staff) => (staff.role === 'admin' ? 'admin' : staff._id.toString());

function span(preset, from, to) {
  const start = istDayStart(from);
  const end = new Date(istDayStart(to).getTime() + DAY);
  const days = Math.round((end - start) / DAY);
  if (days < 1) throw new HttpError(400, 'The start date is after the end date', { fields: { from: 'Choose a start date on or before the end date' } });
  if (days > MAX_RANGE_DAYS) throw new HttpError(400, `Choose a range of at most ${MAX_RANGE_DAYS} days`, { fields: { from: `Choose at most ${MAX_RANGE_DAYS} days` } });
  return { preset, from, to, days, start, end };
}

/** ?range=today|7d|30d|90d|month (default 30d) or ?from&to (YYYY-MM-DD, India time, both inclusive). */
export function insightRange(query, now = new Date()) {
  const today = istToday(now);
  const preset = queryString(query.range, 10);
  let from = queryString(query.from, 10);
  let to = queryString(query.to, 10);
  if (preset || (!from && !to)) {
    const range = preset || '30d';
    if (!INSIGHT_RANGES.includes(range)) throw new HttpError(400, 'Unknown date range', { fields: { range: 'Choose today, 7, 30 or 90 days, or this month' } });
    return span(range, range === 'month' ? `${today.slice(0, 8)}01` : shiftDay(today, 1 - PRESET_DAYS[range]), today);
  }
  if (from && !realDay(from)) throw new HttpError(400, 'Invalid start date', { fields: { from: 'Use a real date as YYYY-MM-DD' } });
  if (to && !realDay(to)) throw new HttpError(400, 'Invalid end date', { fields: { to: 'Use a real date as YYYY-MM-DD' } });
  to ||= today;
  from ||= shiftDay(to, -29);
  return span('', from, to);
}

const ranked = (key, label, limit) => [
  { $group: { _id: key, count: { $sum: 1 }, label: { $max: label } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: limit },
];

/**
 * Every query behind one dashboard response (exported so tests and the benchmark can explain them):
 * `days[].filter` and `counts` are countDocuments filters, `groups` are aggregations with their options.
 *
 * Administrators: fixed breakdowns are index-only counts. Employees: no index holds both the assignee
 * and the status/state, so counts would read other people's leads; one `facts` pass over just their
 * own leads (assignee index) groups day × status × channel × state instead.
 */
export function insightQueries(range, staff) {
  const access = accessFilter(staff);
  const match = { ...access, createdAt: { $gte: range.start, $lt: range.end } };
  const admin = staff.role === 'admin';
  // Pin the index: without a scope filter the planner may walk a `<field>, createdAt` index across all time.
  const scan = { hint: admin ? CHANNEL_INDEX : ASSIGNEE_INDEX };
  return {
    days: Array.from({ length: range.days }, (_, index) => {
      const start = new Date(range.start.getTime() + index * DAY);
      return { date: istDate(start), filter: admin ? { createdAt: { $gte: start, $lt: new Date(start.getTime() + DAY) } } : null };
    }),
    counts: admin ? {
      ...Object.fromEntries(STATUSES.map((status) => [`status:${status}`, { ...match, status }])),
      ...Object.fromEntries(CHANNELS.filter((channel) => channel !== 'web-apply').map((channel) => [`channel:${channel}`, { ...match, channel }])),
      // "Not given" covers '' and leads stored without a state (null matches a missing field too).
      ...Object.fromEntries(['', ...INDIAN_STATES].map((state) => [`state:${state}`, { ...match, 'applicant.state': state || { $in: ['', null] } }])),
    } : {},
    groups: {
      ...(!admin && { facts: { pipeline: [{ $match: match }, { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$createdAt', IST_OFFSET] } } }, status: '$status', channel: { $ifNull: ['$channel', 'web-apply'] }, state: '$applicant.state' }, count: { $sum: 1 } } }], options: scan } }),
      // Leads stored before channels existed have no `channel` and are website applications.
      byCourse: { pipeline: [{ $match: { ...match, channel: { $in: ['web-apply', null] }, 'preference.courseSlug': { $gt: '' } } }, ...ranked('$preference.courseSlug', '$preference.courseName', TOP.course)], options: scan },
      bySchool: { pipeline: [{ $match: { ...match, channel: 'school-drive', formId: { $type: 'objectId' } } }, ...ranked('$formId', '$school.name', TOP.school)], options: scan },
      byCareerField: { pipeline: [{ $match: { ...match, channel: 'callback', 'careerField.slug': { $gt: '' } } }, ...ranked('$careerField.slug', '$careerField.name', TOP.careerField)], options: scan },
      // Grouped by the whole assignee list and status (a few dozen rows) and split per person in
      // JS: measured ~2x faster than $unwind + $cond accumulators, and it yields "unassigned" too.
      ...(admin && { workload: { pipeline: [{ $match: match }, { $group: { _id: { assigned: '$assignedEmployeeIds', status: '$status' }, count: { $sum: 1 } } }], options: {} } }),
    },
  };
}

async function mapLimit(items, limit, run) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await run(items[index]); }
  }));
  return results;
}

// A finished day's count only moves when a lead is deleted or (for an employee) reassigned,
// so past days are kept for 10 minutes; today is always counted fresh.
const dayCounts = createTtlCache({ ttlMs: 10 * 60_000, maxEntries: 20_000 });

// KPIs are fixed windows (not the chosen range) and share the list's count cache keys.
async function kpis(staff) {
  const scope = scopeOf(staff);
  const windowCount = (range) => countLeads(leadFilter({ range }, staff), filterKey({ range }, staff));
  const [today, yesterday, last7, last30, ...byStatus] = await Promise.all([
    windowCount('today'), windowCount('yesterday'), windowCount('7d'), windowCount('30d'),
    ...STATUSES.map((status) => countLeads({ ...accessFilter(staff), status }, `${scope}|status=${status}`)),
  ]);
  const statusTotal = (list) => list.reduce((sum, status) => {
    const { total } = byStatus[STATUSES.indexOf(status)];
    return sum === null || total === null ? null : sum + total;
  }, 0);
  return {
    today: today.total, yesterday: yesterday.total, last7: last7.total, last30: last30.total,
    open: statusTotal(PIPELINE_STATUSES), closed: statusTotal(CLOSED_STATUSES), admitted: statusTotal(['admitted']),
  };
}

async function schoolRows(rows) {
  if (!rows.length) return [];
  const forms = await (await collection(COLLECTIONS.leadForms)).find({ _id: { $in: rows.map((row) => row._id) } }, { projection: { title: 1, school: 1 } }).toArray();
  const byId = new Map(forms.map((form) => [form._id.toString(), form]));
  return rows.map((row) => {
    const form = byId.get(row._id.toString());
    return {
      value: row._id.toString(), label: form?.school?.name || row.label || form?.title || 'School drive', title: form?.title ?? '',
      district: form?.school?.district ?? '', state: form?.school?.state ?? '', count: row.count,
    };
  });
}

// {assigned: [ids], status} groups → per-person totals. Every current employee appears (idle ones
// too); people who left keep a row while leads still name them, so an admin can reassign those.
async function workload(rows) {
  const people = new Map();
  let unassigned = 0;
  for (const { _id: { assigned, status }, count } of rows) {
    const ids = [...new Set((Array.isArray(assigned) ? assigned : []).map(String))];
    if (!ids.length) unassigned += count;
    for (const id of ids) {
      const row = people.get(id) ?? { assigned: 0, open: 0, contacted: 0, admitted: 0 };
      row.assigned += count;
      if (PIPELINE_STATUSES.includes(status)) row.open += count;
      if (status !== 'new') row.contacted += count;
      if (status === 'admitted') row.admitted += count;
      people.set(id, row);
    }
  }
  const employees = await (await collection(COLLECTIONS.admins)).find({ role: 'employee' }, { projection: { email: 1 } }).toArray();
  const current = new Set(employees.map((doc) => doc._id.toString()));
  const former = await staffEmails([...people.keys()].filter((id) => !current.has(id)));
  const listed = [...employees.map((doc) => [doc._id.toString(), doc.email]), ...[...people.keys()].filter((id) => !current.has(id)).map((id) => [id, former.get(id) ?? 'Former staff'])];
  return {
    unassigned,
    employees: listed.map(([id, email]) => ({ id, email, assigned: 0, open: 0, contacted: 0, admitted: 0, ...people.get(id) }))
      .sort((a, b) => b.assigned - a.assigned || a.email.localeCompare(b.email)),
  };
}

function tally(rows) {
  const counted = {};
  for (const { _id, count } of rows) {
    for (const kind of ['date', 'status', 'channel', 'state']) {
      const key = `${kind}:${_id[kind] ?? ''}`;
      counted[key] = (counted[key] ?? 0) + count;
    }
  }
  return counted;
}

const timedOut = (error) => {
  if (error?.code === 50) throw new HttpError(503, 'The dashboard took too long for this range. Choose a shorter range and try again.');
  throw error;
};

const insightsCache = createTtlCache({ ttlMs: 60_000, maxEntries: 200 });
export const clearLeadInsights = () => { insightsCache.clear(); dayCounts.clear(); };

/** GET /api/admin/leads/insights. Employees see only their assigned leads and no workload table. */
export async function leadInsights(query, staff) {
  const range = insightRange(query);
  const scope = scopeOf(staff);
  return insightsCache.wrap(`${scope}|${range.from}|${range.to}|${range.preset}`, async () => {
    const leads = await applications();
    const queries = insightQueries(range, staff);
    const today = istToday();
    const count = (filter) => leads.countDocuments(filter, { maxTimeMS: QUERY_MS });
    const countNames = Object.keys(queries.counts);
    const groupNames = Object.keys(queries.groups);
    const [dayTotals, counts, groups, kpiCounts] = await Promise.all([
      mapLimit(queries.days.filter((day) => day.filter), PARALLEL, ({ date, filter }) => (date < today ? dayCounts.wrap(`${scope}|${date}`, () => count(filter)) : count(filter))),
      mapLimit(countNames, PARALLEL, (name) => count(queries.counts[name])),
      Promise.all(groupNames.map((name) => leads.aggregate(queries.groups[name].pipeline, { ...queries.groups[name].options, maxTimeMS: QUERY_MS }).toArray())),
      kpis(staff),
    ]).catch(timedOut);
    const grouped = Object.fromEntries(groupNames.map((name, index) => [name, groups[index]]));
    // Both paths end in the same shape: per-day totals and `kind:value` counts.
    const counted = grouped.facts ? tally(grouped.facts) : Object.fromEntries(countNames.map((name, index) => [name, counts[index]]));
    const trendCounts = grouped.facts ? queries.days.map(({ date }) => counted[`date:${date}`] ?? 0) : dayTotals;
    const total = trendCounts.reduce((sum, value) => sum + value, 0);
    const counter = (key) => counted[key] ?? 0;
    const byOtherChannels = CHANNELS.filter((channel) => channel !== 'web-apply').reduce((sum, channel) => sum + counter(`channel:${channel}`), 0);
    const [bySchool, team] = await Promise.all([schoolRows(grouped.bySchool), grouped.workload ? workload(grouped.workload) : null]);
    return {
      range: { preset: range.preset, from: range.from, to: range.to, days: range.days },
      kpis: kpiCounts,
      total,
      trend: queries.days.map(({ date }, index) => ({ date, count: trendCounts[index] })),
      byChannel: CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value], count: value === 'web-apply' ? total - byOtherChannels : counter(`channel:${value}`) })),
      byStatus: STATUSES.map((value) => ({ value, label: statusLabel(value), count: counter(`status:${value}`) })),
      byState: ['', ...INDIAN_STATES].map((value) => ({ value, label: value || 'Not given', count: counter(`state:${value}`) }))
        .filter((row) => row.count > 0).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, TOP.state),
      byCourse: grouped.byCourse.map((row) => ({ value: row._id, label: row.label || row._id, count: row.count })),
      bySchool,
      byCareerField: grouped.byCareerField.map((row) => ({ value: row._id, label: row.label || row._id, count: row.count })),
      unassigned: team?.unassigned ?? null,
      employees: team?.employees ?? null,
      generatedAt: new Date().toISOString(),
    };
  });
}

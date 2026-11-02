// The CRM dashboard: one scoped payload for the charts, KPIs and action lists.
// Scope follows the analytics ladder (own → team → all), optionally narrowed to one person.
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { CLOSED_STATUSES, STATUSES } from '../applications/schema.js';
import { applicationNotes, applications, CHANNEL_LABELS, CHANNELS, DAY, IST_OFFSET, istDayStart, istToday, staffEmails } from '../applications/service.js';

const cache = createTtlCache({ ttlMs: 60_000, maxEntries: 200 });
const OPEN = STATUSES.filter((status) => !CLOSED_STATUSES.includes(status) && status !== 'admitted');
const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };
const pct = (part, whole) => (whole ? Math.round((1000 * part) / whole) / 10 : 0);
const delta = (now, before) => (before ? Math.round((1000 * (now - before)) / before) / 10 : now ? 100 : 0);
const istDate = (date) => new Date(date.getTime() + IST_OFFSET).toISOString().slice(0, 10);

function period(query) {
  const todayStart = istDayStart(istToday());
  const tomorrow = new Date(todayStart.getTime() + DAY);
  // `?from&to` without `range` is a custom range (the dashboards' links carry only the dates).
  const key = queryString(query.range, 8) || (queryString(query.from, 10) && queryString(query.to, 10) ? 'custom' : '30d');
  if (key === 'month') {
    const [year, month] = istToday().split('-');
    const start = istDayStart(`${year}-${month}-01`);
    return { key, start, end: tomorrow, days: Math.round((tomorrow - start) / DAY) };
  }
  if (key === 'custom') {
    const start = istDayStart(queryString(query.from, 10));
    const to = istDayStart(queryString(query.to, 10));
    if (!start || !to || to < start) throw new HttpError(400, 'Choose a valid date range', { fields: { from: 'Check the dates.' } });
    const end = new Date(to.getTime() + DAY);
    if ((end - start) / DAY > 366) throw new HttpError(400, 'Choose a range of up to one year');
    return { key, start, end, days: Math.round((end - start) / DAY) };
  }
  const days = RANGES[key];
  if (!days) throw new HttpError(400, 'Unknown range', { fields: { range: 'Choose today, 7d, 30d, 90d, month or custom' } });
  return { key, start: new Date(tomorrow.getTime() - days * DAY), end: tomorrow, days };
}

function scopeIds(staff, employee) {
  const level = staff.analyticsScope;
  if (level === 'none') throw new HttpError(403, 'Your role does not include analytics');
  let ids = level === 'own' ? [staff._id] : level === 'team' ? [staff._id, ...(staff.teamIds ?? [])] : null;
  if (employee) {
    const id = toObjectId(employee);
    if (!id) throw new HttpError(400, 'Choose a valid employee', { fields: { employee: 'Unknown person.' } });
    if (ids && !ids.some((member) => member.equals(id))) throw new HttpError(403, 'That person is outside your team');
    ids = [id];
  }
  return ids;
}

export async function crmDashboard(staff, query = {}) {
  const range = period(query);
  const ids = scopeIds(staff, queryString(query.employee, 30));
  const key = `${staff._id}|${range.key}|${range.start.getTime()}|${range.end.getTime()}|${ids ? ids.map(String).join(',') : 'all'}`;
  return cache.wrap(key, () => build(staff, range, ids));
}

async function build(staff, range, ids) {
  const leads = await applications();
  const notes = await applicationNotes();
  const tasks = await collection(COLLECTIONS.leadTasks);
  const now = new Date();
  const scope = ids ? { assignedEmployeeIds: { $in: ids } } : {};
  const inRange = { ...scope, createdAt: { $gte: range.start, $lt: range.end } };
  const span = range.end - range.start;
  const before = { ...scope, createdAt: { $gte: new Date(range.start - span), $lt: range.start } };
  const todayStart = istDayStart(istToday());
  const authors = ids ? { authorId: { $in: ids } } : {};
  const openClause = { status: { $in: OPEN } };
  const followUpClause = { status: { $nin: CLOSED_STATUSES } };

  const [created, createdBefore, byStatus, heatRows, overdue, dueToday, untouched, cohort, response, daily, activitiesDaily, firstContactsDaily, channels,
    people, taskRows, activityRows, aging, heatmap, states, schools, overdueList, hotWaiting] = await Promise.all([
    leads.countDocuments(inRange),
    leads.countDocuments(before),
    leads.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    leads.aggregate([{ $match: { ...scope, ...openClause } }, { $group: { _id: { $ifNull: ['$crm.heat', 'unscored'] }, count: { $sum: 1 } } }]).toArray(),
    // Same rule as the leads list's follow-up filter (any lead not closed), so the linked list shows the same count.
    leads.countDocuments({ ...scope, ...followUpClause, 'crm.nextFollowUpAt': { $lt: now } }),
    leads.countDocuments({ ...scope, ...followUpClause, 'crm.nextFollowUpAt': { $gte: now, $lt: new Date(todayStart.getTime() + DAY) } }), // still to come today; past = overdue
    leads.countDocuments({ ...scope, status: 'new', createdAt: { $lt: new Date(now - 3 * DAY) } }),
    leads.aggregate([{ $match: inRange }, { $group: {
      _id: null, total: { $sum: 1 }, contacted: { $sum: { $cond: [{ $or: [{ $ne: ['$status', 'new'] }, { $ne: [{ $ifNull: ['$crm.firstContactedAt', null] }, null] }] }, 1, 0] } },
      admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } }, applied: { $sum: { $cond: [{ $in: ['$status', ['applied-to-university', 'admitted']] }, 1, 0] } },
      inProgress: { $sum: { $cond: [{ $in: ['$status', ['in-progress', 'applied-to-university', 'admitted']] }, 1, 0] } },
      lost: { $sum: { $cond: [{ $in: ['$status', CLOSED_STATUSES] }, 1, 0] } },
    } }]).toArray(),
    leads.aggregate([{ $match: { ...inRange, 'crm.firstContactedAt': { $type: 'date' } } }, { $project: { hours: { $divide: [{ $subtract: ['$crm.firstContactedAt', '$createdAt'] }, 3_600_000] } } },
      { $group: { _id: null, avg: { $avg: '$hours' }, within24: { $sum: { $cond: [{ $lte: ['$hours', 24] }, 1, 0] } }, n: { $sum: 1 } } }]).toArray(),
    leads.aggregate([{ $match: inRange }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } }]).toArray(),
    notes.aggregate([{ $match: { ...authors, createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } }]).toArray(),
    leads.aggregate([{ $match: { ...scope, 'crm.firstContactedAt': { $gte: range.start, $lt: range.end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$crm.firstContactedAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } }]).toArray(),
    leads.aggregate([{ $match: inRange }, { $group: { _id: { $ifNull: ['$channel', 'web-apply'] }, leads: { $sum: 1 },
      contacted: { $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] } }, admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } }, hot: { $sum: { $cond: [{ $eq: ['$crm.heat', 'hot'] }, 1, 0] } } } }]).toArray(),
    leads.aggregate([{ $match: inRange }, { $unwind: '$assignedEmployeeIds' }, ...(ids ? [{ $match: { assignedEmployeeIds: { $in: ids } } }] : []),
      { $group: { _id: '$assignedEmployeeIds', leads: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ['$status', OPEN] }, 1, 0] } }, contacted: { $sum: { $cond: [{ $ne: ['$status', 'new'] }, 1, 0] } },
        admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } }, hot: { $sum: { $cond: [{ $eq: ['$crm.heat', 'hot'] }, 1, 0] } },
        responseHours: { $avg: { $cond: [{ $ne: [{ $type: '$crm.firstContactedAt' }, 'date'] }, null, { $divide: [{ $subtract: ['$crm.firstContactedAt', '$createdAt'] }, 3_600_000] }] } } } }]).toArray(),
    tasks.aggregate([{ $match: ids ? { assigneeId: { $in: ids } } : {} }, { $group: { _id: '$assigneeId',
      done: { $sum: { $cond: [{ $and: [{ $ne: ['$doneAt', null] }, { $gte: ['$doneAt', range.start] }, { $lt: ['$doneAt', range.end] }] }, 1, 0] } },
      overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$doneAt', null] }, { $lt: ['$dueAt', now] }] }, 1, 0] } },
      open: { $sum: { $cond: [{ $eq: ['$doneAt', null] }, 1, 0] } } } }]).toArray(),
    notes.aggregate([{ $match: { ...authors, createdAt: { $gte: range.start, $lt: range.end } } }, { $group: { _id: '$authorId', activities: { $sum: 1 }, calls: { $sum: { $cond: [{ $eq: ['$kind', 'call'] }, 1, 0] } } } }]).toArray(),
    leads.aggregate([{ $match: { ...scope, ...openClause, 'crm.lastActivityAt': { $type: 'date' } } }, { $project: { days: { $divide: [{ $subtract: [now, '$crm.lastActivityAt'] }, DAY] } } },
      { $bucket: { groupBy: '$days', boundaries: [0, 1, 3, 7, 14, 30, 100000], default: 'other', output: { count: { $sum: 1 } } } }]).toArray(),
    notes.aggregate([{ $match: { ...authors, createdAt: { $gte: new Date(now - 30 * DAY) } } }, { $project: { p: { $dateToParts: { date: '$createdAt', timezone: 'Asia/Kolkata', iso8601: true } } } },
      { $group: { _id: { day: '$p.isoDayOfWeek', hour: '$p.hour' }, count: { $sum: 1 } } }]).toArray(),
    leads.aggregate([{ $match: { ...inRange, 'applicant.state': { $nin: ['', null] } } }, { $group: { _id: '$applicant.state', count: { $sum: 1 }, admitted: { $sum: { $cond: [{ $eq: ['$status', 'admitted'] }, 1, 0] } } } }, { $sort: { count: -1 } }, { $limit: 8 }]).toArray(),
    leads.aggregate([{ $match: { ...inRange, 'school.name': { $nin: ['', null] } } }, { $group: { _id: '$school.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]).toArray(),
    leads.find({ ...scope, ...openClause, 'crm.nextFollowUpAt': { $lt: now } }, { projection: { ref: 1, applicant: 1, status: 1, crm: 1, assignedEmployeeIds: 1 } }).sort({ 'crm.nextFollowUpAt': 1 }).limit(8).toArray(),
    leads.find({ ...scope, status: 'new', 'crm.heat': 'hot' }, { projection: { ref: 1, applicant: 1, status: 1, crm: 1, createdAt: 1, assignedEmployeeIds: 1 } }).sort({ createdAt: -1 }).limit(8).toArray(),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  const totalLeads = byStatus.reduce((sum, row) => sum + row.count, 0);
  const coh = cohort[0] ?? { total: 0, contacted: 0, admitted: 0, applied: 0, inProgress: 0, lost: 0 };
  const heat = Object.fromEntries(heatRows.map((row) => [row._id, row.count]));
  const resp = response[0] ?? { avg: null, within24: 0, n: 0 };
  const dayList = Array.from({ length: range.days }, (_, index) => istDate(new Date(range.start.getTime() + index * DAY)));
  const series = (rows) => { const map = new Map(rows.map((row) => [row._id, row.count])); return dayList.map((day) => map.get(day) ?? 0); };

  const nameOf = await staffEmails([...people.map((row) => row._id), ...taskRows.map((row) => row._id), ...activityRows.map((row) => row._id), ...overdueList.flatMap((lead) => lead.assignedEmployeeIds ?? []), ...hotWaiting.flatMap((lead) => lead.assignedEmployeeIds ?? [])]);
  const byPerson = new Map();
  const row = (id) => { const k = String(id); if (!byPerson.has(k)) byPerson.set(k, { id: k, email: nameOf.get(k) ?? 'Former staff', leads: 0, open: 0, contacted: 0, admitted: 0, hot: 0, responseHours: null, activities: 0, calls: 0, tasksDone: 0, tasksOverdue: 0, tasksOpen: 0 }); return byPerson.get(k); };
  for (const p of people) Object.assign(row(p._id), { leads: p.leads, open: p.open, contacted: p.contacted, admitted: p.admitted, hot: p.hot, responseHours: p.responseHours === null ? null : Math.round(p.responseHours * 10) / 10 });
  for (const t of taskRows) Object.assign(row(t._id), { tasksDone: t.done, tasksOverdue: t.overdue, tasksOpen: t.open });
  for (const a of activityRows) Object.assign(row(a._id), { activities: a.activities, calls: a.calls });
  const leaderboard = [...byPerson.values()].map((person) => ({ ...person, contactRate: pct(person.contacted, person.leads), admitRate: pct(person.admitted, person.leads) }))
    .sort((a, b) => b.admitted - a.admitted || b.activities - a.activities || b.leads - a.leads);

  const agingLabels = { 0: 'Today', 1: '1–3 days', 3: '3–7 days', 7: '1–2 weeks', 14: '2–4 weeks', 30: 'Over a month' };
  const heatGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const cell of heatmap) heatGrid[cell._id.day - 1][cell._id.hour] = cell.count;
  const leadCard = (lead) => ({ id: lead._id.toString(), ref: lead.ref, name: lead.applicant?.fullName ?? '', phone: lead.applicant?.phone ?? '', status: lead.status, heat: lead.crm?.heat ?? '', priority: lead.crm?.priority ?? 'normal', nextFollowUpAt: lead.crm?.nextFollowUpAt ?? null, createdAt: lead.createdAt ?? null, assignee: nameOf.get(String(lead.assignedEmployeeIds?.[0])) ?? '' });

  return {
    scope: staff.analyticsScope, range: { key: range.key, from: istDate(range.start), to: istDate(new Date(range.end - DAY)), days: range.days },
    kpis: {
      leads: { value: created, previous: createdBefore, delta: delta(created, createdBefore) },
      totalLeads, open: OPEN.reduce((sum, status) => sum + (statusCount[status] ?? 0), 0),
      hot: heat.hot ?? 0, warm: heat.warm ?? 0, cold: heat.cold ?? 0,
      overdueFollowUps: overdue, dueToday, untouched,
      contactRate: pct(coh.contacted, coh.total), admitRate: pct(coh.admitted, coh.total), admitted: coh.admitted,
      avgResponseHours: resp.avg === null ? null : Math.round(resp.avg * 10) / 10, within24Rate: pct(resp.within24, resp.n),
    },
    heat: ['hot', 'warm', 'cold', 'unscored'].map((name) => ({ key: name, count: heat[name] ?? 0 })),
    funnel: [
      { key: 'leads', label: 'New leads', count: coh.total }, { key: 'contacted', label: 'Contacted', count: coh.contacted },
      { key: 'in-progress', label: 'In progress', count: coh.inProgress }, { key: 'applied', label: 'Applied to university', count: coh.applied }, { key: 'admitted', label: 'Admitted', count: coh.admitted },
    ],
    lost: coh.lost,
    byStatus: STATUSES.map((status) => ({ status, count: statusCount[status] ?? 0 })),
    trend: { days: dayList, leads: series(daily), activities: series(activitiesDaily), firstContacts: series(firstContactsDaily) },
    channels: CHANNELS.map((channel) => { const found = channels.find((r) => r._id === channel); return { key: channel, label: CHANNEL_LABELS[channel], leads: found?.leads ?? 0, contacted: found?.contacted ?? 0, admitted: found?.admitted ?? 0, hot: found?.hot ?? 0 }; }),
    leaderboard: staff.analyticsScope === 'own' ? leaderboard.filter((person) => person.id === String(staff._id)) : leaderboard,
    aging: aging.filter((bucket) => bucket._id !== 'other').map((bucket) => ({ key: String(bucket._id), label: agingLabels[bucket._id], count: bucket.count })),
    heatmap: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours: 24, grid: heatGrid },
    states: states.map((state) => ({ name: state._id, leads: state.count, admitted: state.admitted })),
    schools: schools.map((school) => ({ name: school._id, leads: school.count })),
    actions: { overdue: overdueList.map(leadCard), hotWaiting: hotWaiting.map(leadCard) },
    generatedAt: now,
  };
}

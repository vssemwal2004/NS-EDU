// The console home (/admin/dashboard): today's numbers that matter to the person signed in.
// Each section is present only when the role allows it; every number is a count or a short
// sorted list (no collection is loaded into memory), cached briefly per person.
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { can, staffDirectory } from '../access/access-service.js';
import { leadScopeOf } from '../applications/scope.js';
import { CLOSED_STATUSES, STATUSES } from '../applications/schema.js';
import { accessFilter, applicationNotes, applications, countLeads, DAY, filterKey, istDayStart, istToday, leadFilter, leadScopeKey } from '../applications/service.js';
import { myTaskSnapshot } from '../crm/crm-service.js';

const cache = createTtlCache({ ttlMs: 30_000, maxEntries: 500 });
export const OPEN_STATUSES = STATUSES.filter((status) => status !== 'admitted' && !CLOSED_STATUSES.includes(status));
const LIST = 5;

// Lead counts use the leads list's own filters and count cache, so each number equals the list it links to.
async function leadCounts(staff) {
  const count = async (query) => (await countLeads(leadFilter(query, staff), filterKey(query, staff))).total;
  const [week, newToday, open, hotWaiting, overdue, dueToday, ...stageCounts] = await Promise.all([
    lastSevenDays(staff),
    count({ range: 'today' }),
    count({ status: OPEN_STATUSES.join(',') }),
    count({ heat: 'hot', status: 'new' }),
    count({ followUp: 'overdue' }),
    count({ followUp: 'today' }),
    ...PIPELINE.map((status) => count({ status })),
  ]);
  const byStage = PIPELINE.map((status, index) => ({ status, count: stageCounts[index] }));
  return { scope: leadScopeOf(staff), newToday, open, hotWaiting, overdue, dueToday, byStage, week };
}

// The pipeline stages in order (the dashboard's stage bar and donut).
const PIPELINE = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted'];

// New leads per IST day for the last 7 days (today last), one grouped query on createdAt.
async function lastSevenDays(staff) {
  const today = istToday();
  const start = new Date(istDayStart(today).getTime() - 6 * DAY);
  const rows = await (await applications()).aggregate([
    { $match: { ...accessFilter(staff), createdAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
  ], { maxTimeMS: 5000 }).toArray();
  const byDay = new Map(rows.map((row) => [row._id, row.count]));
  return Array.from({ length: 7 }, (_, index) => {
    const day = istToday(new Date(start.getTime() + index * DAY + DAY / 2));
    return { day, count: byDay.get(day) ?? 0 };
  });
}

async function attention(staff, people) {
  const leads = await applications();
  const access = accessFilter(staff);
  const now = new Date();
  const projection = { 'applicant.fullName': 1, status: 1, 'crm.nextFollowUpAt': 1, createdAt: 1, assignedEmployeeIds: 1 };
  const [overdue, hot, names] = await Promise.all([
    leads.find({ ...access, status: { $nin: CLOSED_STATUSES }, 'crm.nextFollowUpAt': { $lt: now } }, { projection }).sort({ 'crm.nextFollowUpAt': 1 }).limit(LIST).maxTimeMS(5000).toArray(),
    leads.find({ ...access, status: 'new', 'crm.heat': 'hot' }, { projection }).sort({ createdAt: -1 }).limit(LIST).maxTimeMS(5000).toArray(),
    people,
  ]);
  const card = (kind) => (lead) => ({
    kind, id: lead._id.toString(), name: lead.applicant?.fullName ?? '', status: lead.status,
    at: kind === 'overdue' ? lead.crm?.nextFollowUpAt ?? null : lead.createdAt ?? null,
    assignee: names.get(String(lead.assignedEmployeeIds?.[0])) ?? '',
  });
  return [...overdue.map(card('overdue')), ...hot.map(card('hot'))];
}

// Their own follow-ups (the "My day" list): counts plus the next few, overdue first.
async function myTasks(staff) {
  const { items, ...counts } = await myTaskSnapshot(staff, LIST);
  return {
    ...counts,
    items: items.map((task) => ({ id: task._id.toString(), title: task.title, kind: task.kind, dueAt: task.dueAt, leadId: task.leadId?.toString() ?? '', leadName: task.leadName ?? '' })),
  };
}

// Latest calls, messages and notes: everyone's for company-wide roles, else the person's team (or own).
async function recentActivity(staff, directory) {
  const scope = leadScopeOf(staff);
  const authors = scope === 'all' ? {} : { authorId: { $in: scope === 'team' ? [staff._id, ...(staff.teamIds ?? [])] : [staff._id] } };
  const coll = await applicationNotes();
  const [notes, people] = await Promise.all([
    coll.aggregate([
      { $match: authors }, { $sort: { createdAt: -1 } }, { $limit: 8 },
      { $lookup: {
        from: COLLECTIONS.applications, localField: 'applicationId', foreignField: '_id', as: 'lead',
        pipeline: [{ $match: accessFilter(staff) }, { $project: { 'applicant.fullName': 1 } }],
      } },
      { $unwind: '$lead' },
      { $project: { applicationId: 1, kind: 1, outcome: 1, authorId: 1, authorEmail: 1, createdAt: 1, lead: 1 } },
    ]).toArray(),
    directory,
  ]);
  return notes.map((note) => ({
    id: note._id.toString(), kind: note.kind ?? 'note', outcome: note.outcome ?? '', by: people.get(String(note.authorId)) ?? note.authorEmail ?? '', at: note.createdAt,
    leadId: String(note.applicationId), leadName: note.lead.applicant?.fullName || 'Unnamed lead',
  }));
}

// Directory records waiting for a decision (the data review queue's two views).
async function backlog() {
  const institutions = (await getDb()).collection(COLLECTIONS.institutions);
  const [held, visible] = await Promise.all([
    institutions.countDocuments({ verification: 'unverified', active: false }),
    institutions.countDocuments({ verification: 'unverified', active: { $ne: false } }),
  ]);
  return { held, visible };
}

async function students(now = new Date()) {
  const coll = (await getDb()).collection(COLLECTIONS.students);
  const [total, new7d] = await Promise.all([coll.estimatedDocumentCount(), coll.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY) } })]);
  return { total, new7d };
}

/** GET /api/admin/home: open to every signed-in staff member; sections follow their permissions. */
export function homeSummary(staff) {
  const seesLeads = leadScopeOf(staff) !== 'none';
  const seesTasks = can(staff, 'leads.notes');
  const seesCatalogue = can(staff, 'data.manage');
  const seesStudents = can(staff, 'dashboard.view') || can(staff, 'students.manage');
  const key = JSON.stringify([String(staff._id), leadScopeKey(staff), seesTasks, seesCatalogue, seesStudents]);
  return cache.wrap(key, async () => {
    const people = seesLeads ? staffDirectory().then((rows) => new Map(rows.map((row) => [String(row._id), row.email]))) : null;
    const [leads, needs, tasks, activity, catalogue, studentCounts] = await Promise.all([
      seesLeads ? leadCounts(staff) : null,
      seesLeads ? attention(staff, people) : null,
      seesTasks ? myTasks(staff) : null,
      seesLeads ? recentActivity(staff, people) : null,
      seesCatalogue ? backlog() : null,
      seesStudents ? students() : null,
    ]);
    return { leads, attention: needs, tasks, activity, catalogue, students: studentCounts, generatedAt: new Date().toISOString() };
  });
}
export const clearHomeSummary = () => cache.clear();

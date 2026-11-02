// The console home (/admin/dashboard): today's numbers that matter to the person signed in.
// Each section is present only when the role allows it; every number is a count or a short
// sorted list (no collection is loaded into memory), cached briefly per person.
import { collection, COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { can } from '../access/access-service.js';
import { leadScopeOf } from '../applications/scope.js';
import { CLOSED_STATUSES, STATUSES } from '../applications/schema.js';
import { accessFilter, applicationNotes, applications, countLeads, DAY, filterKey, istDayStart, istToday, leadFilter, staffEmails } from '../applications/service.js';

const cache = createTtlCache({ ttlMs: 30_000, maxEntries: 500 });
export const OPEN_STATUSES = STATUSES.filter((status) => status !== 'admitted' && !CLOSED_STATUSES.includes(status));
const LIST = 5;

// Lead counts use the leads list's own filters and count cache, so each number equals the list it links to.
async function leadCounts(staff) {
  const count = async (query) => (await countLeads(leadFilter(query, staff), filterKey(query, staff))).total;
  const [newToday, open, hotWaiting, overdue, dueToday] = await Promise.all([
    count({ range: 'today' }),
    count({ status: OPEN_STATUSES.join(',') }),
    count({ heat: 'hot', status: 'new' }),
    count({ followUp: 'overdue' }),
    count({ followUp: 'today' }),
  ]);
  return { scope: leadScopeOf(staff), newToday, open, hotWaiting, overdue, dueToday };
}

async function attention(staff) {
  const leads = await applications();
  const access = accessFilter(staff);
  const now = new Date();
  const projection = { applicant: 1, status: 1, crm: 1, createdAt: 1, assignedEmployeeIds: 1 };
  const [overdue, hot] = await Promise.all([
    leads.find({ ...access, status: { $nin: CLOSED_STATUSES }, 'crm.nextFollowUpAt': { $lt: now } }, { projection }).sort({ 'crm.nextFollowUpAt': 1 }).limit(LIST).maxTimeMS(5000).toArray(),
    leads.find({ ...access, status: 'new', 'crm.heat': 'hot' }, { projection }).sort({ createdAt: -1 }).limit(LIST).maxTimeMS(5000).toArray(),
  ]);
  const names = await staffEmails([...overdue, ...hot].flatMap((lead) => lead.assignedEmployeeIds ?? []));
  const card = (kind) => (lead) => ({
    kind, id: lead._id.toString(), name: lead.applicant?.fullName ?? '', status: lead.status,
    at: kind === 'overdue' ? lead.crm?.nextFollowUpAt ?? null : lead.createdAt ?? null,
    assignee: names.get(String(lead.assignedEmployeeIds?.[0])) ?? '',
  });
  return [...overdue.map(card('overdue')), ...hot.map(card('hot'))];
}

// Their own follow-ups (the "My day" list): counts plus the next few, overdue first.
async function myTasks(staff) {
  const tasks = await collection(COLLECTIONS.leadTasks);
  const now = new Date();
  const today = istDayStart(istToday());
  const tomorrow = new Date(today.getTime() + DAY);
  const mine = { assigneeId: staff._id, doneAt: null };
  const [overdue, dueToday, upcoming, next] = await Promise.all([
    tasks.countDocuments({ ...mine, dueAt: { $lt: now } }),
    tasks.countDocuments({ ...mine, dueAt: { $gte: today, $lt: tomorrow } }),
    tasks.countDocuments({ ...mine, dueAt: { $gte: tomorrow } }),
    tasks.find(mine, { projection: { title: 1, kind: 1, dueAt: 1, leadId: 1, leadName: 1 } }).sort({ dueAt: 1 }).limit(LIST).toArray(),
  ]);
  return {
    overdue, today: dueToday, upcoming,
    items: next.map((task) => ({ id: task._id.toString(), title: task.title, kind: task.kind, dueAt: task.dueAt, leadId: task.leadId?.toString() ?? '', leadName: task.leadName ?? '' })),
  };
}

// Latest calls, messages and notes: everyone's for company-wide roles, else the person's team (or own).
async function recentActivity(staff) {
  const scope = leadScopeOf(staff);
  const authors = scope === 'all' ? {} : { authorId: { $in: scope === 'team' ? [staff._id, ...(staff.teamIds ?? [])] : [staff._id] } };
  const notes = await (await applicationNotes()).find(authors, { projection: { applicationId: 1, kind: 1, outcome: 1, authorId: 1, authorEmail: 1, createdAt: 1 } })
    .sort({ createdAt: -1 }).limit(8).toArray();
  const [leads, people] = notes.length ? await Promise.all([
    (await applications()).find({ _id: { $in: notes.map((note) => note.applicationId) }, ...accessFilter(staff) }, { projection: { applicant: 1 } }).toArray(),
    staffEmails(notes.map((note) => note.authorId)),
  ]) : [[], new Map()];
  const nameOf = new Map(leads.map((lead) => [lead._id.toString(), lead.applicant?.fullName ?? '']));
  return notes.filter((note) => nameOf.has(String(note.applicationId))).map((note) => ({
    id: note._id.toString(), kind: note.kind ?? 'note', outcome: note.outcome ?? '', by: people.get(String(note.authorId)) ?? note.authorEmail ?? '', at: note.createdAt,
    leadId: String(note.applicationId), leadName: nameOf.get(String(note.applicationId)) || 'Unnamed lead',
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
  return cache.wrap(String(staff._id), async () => {
    const seesLeads = leadScopeOf(staff) !== 'none';
    const [leads, needs, tasks, activity, catalogue, studentCounts] = await Promise.all([
      seesLeads ? leadCounts(staff) : null,
      seesLeads ? attention(staff) : null,
      can(staff, 'leads.notes') ? myTasks(staff) : null,
      seesLeads ? recentActivity(staff) : null,
      can(staff, 'data.manage') ? backlog() : null,
      can(staff, 'dashboard.view') || can(staff, 'students.manage') ? students() : null,
    ]);
    return { leads, attention: needs, tasks, activity, catalogue, students: studentCounts, generatedAt: new Date().toISOString() };
  });
}
export const clearHomeSummary = () => cache.clear();

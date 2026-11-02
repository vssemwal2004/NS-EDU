import { Router } from 'express';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { requireOwnerAdmin, requirePermission } from '../../middleware/auth.js';
import { assignableIds, can } from '../access/access-service.js';
import { CLOSED_STATUSES, STATUS_LABELS, STATUSES } from '../applications/schema.js';
import {
  applications, countLeads, filterKey, resolveLeadFilter, serializeLeadDetail, serializeLeadSummary, staffEmails, statusLabel, visibleLead,
} from '../applications/service.js';
import { crmDashboard } from './crm-analytics.js';
import { ACTIVITY_KINDS, CALL_OUTCOMES, HEAT_LABELS, HEATS, PRIORITIES, PRIORITY_LABELS, TASK_KINDS } from './crm-model.js';
import {
  bulkAct, createLead, createTask, deleteLead, deleteTask, editLead, listTasks, listTrash, logActivity, purgeLead, restoreLead, setCrm, timeline, updateTask,
} from './crm-service.js';

// Mounted at /api/admin/crm. Visibility of leads always follows the viewer's lead scope; each action has its own permission.
export const crmRouter = Router();

const full = async (doc, staff) => serializeLeadDetail(doc, { staff, people: await staffEmails([...(doc.assignedEmployeeIds ?? []), ...(doc.statusHistory ?? []).map((entry) => entry.byAdminId)]) });
const BOARD_PAGE = 20;
const MAX_BOARD_SKIP = 2000;

crmRouter.get('/meta', async (request, response) => {
  const allowed = assignableIds(request.admin);
  const staff = await (await collection(COLLECTIONS.admins)).find({ role: { $in: ['admin', 'employee'] }, status: { $ne: 'suspended' }, ...(allowed ? { _id: { $in: allowed } } : {}) }, { projection: { email: 1, name: 1, roleId: 1, role: 1 } }).sort({ name: 1, email: 1 }).toArray();
  response.json({
    statuses: STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status], closed: CLOSED_STATUSES.includes(status) })),
    heats: HEATS.map((value) => ({ value, label: HEAT_LABELS[value] })), priorities: PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
    activityKinds: ACTIVITY_KINDS, callOutcomes: CALL_OUTCOMES, taskKinds: TASK_KINDS,
    // Who this person may hand work to (the whole team for owners; mentors: themselves and their reports).
    assignees: can(request.admin, 'leads.assign') || can(request.admin, 'tasks.manage_team') ? staff.map((doc) => ({ id: doc._id.toString(), email: doc.email, name: doc.name ?? '' })) : [],
  });
});

crmRouter.get('/dashboard', async (request, response) => response.json(await crmDashboard(request.admin, request.query)));

// Pipeline board: one column per status with its best leads first, and the real count behind each column.
crmRouter.get('/board', requirePermission('leads.view_own', 'leads.view_team', 'leads.view_all'), async (request, response) => {
  const { status: _ignored, ...query } = request.query;
  const base = await resolveLeadFilter(query, request.admin);
  const leads = await applications();
  const key = filterKey(query, request.admin);
  const columns = await Promise.all(STATUSES.map(async (status) => {
    const filter = Object.keys(base).length ? { $and: [base, { status }] } : { status };
    const [count, docs] = await Promise.all([
      countLeads(filter, `${key}|board=${status}`),
      leads.find(filter).sort({ 'crm.score': -1, createdAt: -1, _id: -1 }).limit(BOARD_PAGE).maxTimeMS(8000).toArray(),
    ]);
    return { status, label: statusLabel(status), closed: CLOSED_STATUSES.includes(status), total: count.total, items: docs.map(serializeLeadSummary) };
  }));
  response.json({ columns, pageSize: BOARD_PAGE });
});

crmRouter.get('/board/:status', requirePermission('leads.view_own', 'leads.view_team', 'leads.view_all'), async (request, response) => {
  if (!STATUSES.includes(request.params.status)) throw new HttpError(404, 'Unknown stage');
  const { page, skip } = pagination(request.query, { defaultLimit: BOARD_PAGE, maxLimit: BOARD_PAGE, allowedLimits: [BOARD_PAGE] });
  if (skip > MAX_BOARD_SKIP) throw new HttpError(400, 'Use the filters to narrow this stage; the board shows the best leads first.');
  const { status: _ignored, ...query } = request.query;
  const base = await resolveLeadFilter(query, request.admin);
  const filter = Object.keys(base).length ? { $and: [base, { status: request.params.status }] } : { status: request.params.status };
  const docs = await (await applications()).find(filter).sort({ 'crm.score': -1, createdAt: -1, _id: -1 }).skip(skip).limit(BOARD_PAGE + 1).maxTimeMS(8000).toArray();
  response.json({ items: docs.slice(0, BOARD_PAGE).map(serializeLeadSummary), page, hasNext: docs.length > BOARD_PAGE });
});

// Follow-ups ("My day").
crmRouter.get('/tasks', async (request, response) => response.json(await listTasks(request.admin, request.query)));
crmRouter.patch('/tasks/:id', requirePermission('leads.notes'), async (request, response) => response.json({ item: await updateTask(request.admin, request.params.id, request.body) }));
crmRouter.delete('/tasks/:id', requirePermission('leads.notes'), async (request, response) => {
  await deleteTask(request.admin, request.params.id);
  response.status(204).end();
});

// Lead actions.
crmRouter.post('/leads', requirePermission('leads.create'), async (request, response) => {
  const lead = await createLead(request.admin, request.body);
  response.status(201).json({ item: await full(lead, request.admin) });
});
crmRouter.post('/leads/bulk', requirePermission('leads.bulk'), async (request, response) => response.json(await bulkAct(request.admin, request.body)));

crmRouter.get('/leads/:id/timeline', async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  response.json({ items: await timeline(lead) });
});
crmRouter.post('/leads/:id/activities', requirePermission('leads.notes'), async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  const { activity, lead: updated } = await logActivity(request.admin, lead, request.body);
  response.status(201).json({ item: activity, lead: await full(updated, request.admin) });
});
crmRouter.post('/leads/:id/tasks', requirePermission('leads.notes'), async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  const task = await createTask(request.admin, lead, request.body);
  response.status(201).json({ item: task, lead: await full(await (await applications()).findOne({ _id: lead._id }), request.admin) });
});
crmRouter.patch('/leads/:id', requirePermission('crm.heat'), async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  response.json({ item: await full(await setCrm(request.admin, lead, request.body), request.admin) });
});
crmRouter.patch('/leads/:id/details', requirePermission('leads.edit'), async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  response.json({ item: await full(await editLead(request.admin, lead, request.body), request.admin) });
});
crmRouter.delete('/leads/:id', requirePermission('leads.delete'), async (request, response) => {
  await deleteLead(request.admin, await visibleLead(request.params.id, request.admin));
  response.status(204).end();
});

// The bin: leads deleted by staff can be restored by anyone who may delete; only owners purge for good.
crmRouter.get('/trash', requirePermission('leads.delete'), async (request, response) => {
  if (request.admin.leadScope !== 'all') throw new HttpError(403, 'Only roles that see every lead can open the bin');
  response.json(await listTrash(request.query));
});
crmRouter.post('/trash/:id/restore', requirePermission('leads.delete'), async (request, response) => {
  if (request.admin.leadScope !== 'all') throw new HttpError(403, 'Only roles that see every lead can restore leads');
  await restoreLead(request.admin, request.params.id);
  response.status(204).end();
});
crmRouter.delete('/trash/:id', requireOwnerAdmin, async (request, response) => {
  await purgeLead(request.admin, request.params.id);
  response.status(204).end();
});

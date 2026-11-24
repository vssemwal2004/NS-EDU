import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { requireOwnerAdmin, requirePermission } from '../../middleware/auth.js';
import { assignableIds, can, staffDirectory } from '../access/access-service.js';
import { projectionFor } from '../applications/lead-columns.js';
import { CLOSED_STATUSES, STATUS_LABELS, STATUSES } from '../applications/schema.js';
import {
  applications, filterKey, LEAD_SUMMARY_FIELDS, leadTotalsByStatus, resolveLeadFilter, serializeLeadDetail, serializeLeadSummary, staffEmails, statusLabel, visibleLead,
} from '../applications/service.js';
import { activityFeed } from './crm-activity.js';
import { crmDashboard, crmHotWaiting } from './crm-analytics.js';
import { ACTIVITY_KINDS, CALL_OUTCOMES, HEAT_LABELS, HEATS, PRIORITIES, PRIORITY_LABELS, TASK_KINDS } from './crm-model.js';
import {
  bulkAct, createLead, createTask, deleteLead, deleteTask, editLead, listTasks, listTaskSections, listTrash, logActivity, purgeLead, restoreLead, setCrm,
  taskPreview, taskSectionCounts, timeline, updateTask,
} from './crm-service.js';

// Mounted at /api/admin/crm. Visibility of leads always follows the viewer's lead scope; each action has its own permission.
export const crmRouter = Router();

const full = async (doc, staff) => serializeLeadDetail(doc, { staff, people: await staffEmails([...(doc.assignedEmployeeIds ?? []), ...(doc.statusHistory ?? []).map((entry) => entry.byAdminId)]) });
const BOARD_PAGE = 20;
const MAX_BOARD_SKIP = 2000;
const BOARD_SORT = { 'crm.score': -1, createdAt: -1, _id: -1 };
const BOARD_PROJECTION = projectionFor([], LEAD_SUMMARY_FIELDS);

crmRouter.get('/meta', async (request, response) => {
  const canAssign = can(request.admin, 'leads.assign') || can(request.admin, 'tasks.manage_team');
  const allowed = assignableIds(request.admin);
  const allowedIds = allowed && new Set(allowed.map(String));
  const staff = canAssign ? await staffDirectory() : [];
  response.json({
    statuses: STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status], closed: CLOSED_STATUSES.includes(status) })),
    heats: HEATS.map((value) => ({ value, label: HEAT_LABELS[value] })), priorities: PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
    activityKinds: ACTIVITY_KINDS, callOutcomes: CALL_OUTCOMES, taskKinds: TASK_KINDS,
    // Who this person may hand work to (the whole team for owners; mentors: themselves and their reports).
    assignees: staff.filter((doc) => (doc.role === 'admin' || doc.role === 'employee') && doc.status !== 'suspended' && (!allowedIds || allowedIds.has(String(doc._id))))
      .map((doc) => ({ id: doc._id.toString(), email: doc.email, name: doc.name ?? '' })),
  });
});

crmRouter.get('/dashboard', async (request, response) => response.json(await crmDashboard(request.admin, request.query)));

// Activity log: calls, messages, notes and stage changes, newest first (scoped like the leads list).
crmRouter.get('/activity', requirePermission('leads.view_own', 'leads.view_team', 'leads.view_all'), async (request, response) => response.json(await activityFeed(request.admin, request.query)));
crmRouter.get('/dashboard/hot-waiting', async (request, response) => response.json(await crmHotWaiting(request.admin)));

// Pipeline board: one column per status with its best leads first, and the real count behind each column.
crmRouter.get('/board', requirePermission('leads.view_own', 'leads.view_team', 'leads.view_all'), async (request, response) => {
  const { status: _ignored, ...query } = request.query;
  const base = await resolveLeadFilter(query, request.admin);
  const leads = await applications();
  // Keep each stage's indexed top page and send them in one command. The final sort sees only the capped result.
  const [first, ...rest] = STATUSES.map((status) => [
    { $match: { ...base, status } }, { $sort: BOARD_SORT }, { $limit: BOARD_PAGE }, { $project: BOARD_PROJECTION },
  ]);
  const [docs, totals] = await Promise.all([
    leads.aggregate([
      ...first,
      ...rest.map((pipeline) => ({ $unionWith: { coll: leads.collectionName, pipeline } })),
      { $sort: BOARD_SORT },
    ], { batchSize: STATUSES.length * BOARD_PAGE + 1, maxTimeMS: 8000 }).toArray(),
    leadTotalsByStatus(base, filterKey(query, request.admin)),
  ]);
  const columns = STATUSES.map((status) => ({
    status, label: statusLabel(status), closed: CLOSED_STATUSES.includes(status),
    total: totals ? totals.get(status) ?? 0 : null,
    items: docs.filter((doc) => doc.status === status).map(serializeLeadSummary),
  }));
  response.json({ columns, pageSize: BOARD_PAGE });
});

crmRouter.get('/board/:status', requirePermission('leads.view_own', 'leads.view_team', 'leads.view_all'), async (request, response) => {
  if (!STATUSES.includes(request.params.status)) throw new HttpError(404, 'Unknown stage');
  const { page, skip } = pagination(request.query, { defaultLimit: BOARD_PAGE, maxLimit: BOARD_PAGE, allowedLimits: [BOARD_PAGE] });
  if (skip > MAX_BOARD_SKIP) throw new HttpError(400, 'Use the filters to narrow this stage; the board shows the best leads first.');
  const { status: _ignored, ...query } = request.query;
  const base = await resolveLeadFilter(query, request.admin);
  const filter = { ...base, status: request.params.status };
  const docs = await (await applications()).find(filter, { projection: BOARD_PROJECTION })
    .sort(BOARD_SORT).skip(skip).limit(BOARD_PAGE + 1).maxTimeMS(8000).toArray();
  response.json({ items: docs.slice(0, BOARD_PAGE).map(serializeLeadSummary), page, hasNext: docs.length > BOARD_PAGE });
});

// Follow-ups ("My day").
crmRouter.get('/tasks', async (request, response) => response.json(await listTasks(request.admin, request.query)));
crmRouter.get('/tasks/counts', async (request, response) => response.json(await taskSectionCounts(request.admin, request.query)));
crmRouter.get('/tasks/preview', async (request, response) => response.json(await taskPreview(request.admin)));
crmRouter.get('/tasks/sections', async (request, response) => response.json(await listTaskSections(request.admin, request.query)));
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
crmRouter.post('/leads/import', requirePermission('leads.create'), async (request, response) => {
  const rows = request.body?.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new HttpError(400, 'Upload 1 to 100 leads at a time');
  const results = [];
  for (const [index, row] of rows.entries()) {
    try {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new HttpError(400, 'Invalid row');
      const lead = await createLead(request.admin, { ...row, force: false, source: row.source || 'CSV upload' });
      results.push({ row: index + 2, ok: true, id: lead._id.toString(), ref: lead.ref });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      results.push({ row: index + 2, ok: false, error: error.message });
    }
  }
  response.json({ created: results.filter((row) => row.ok).length, failed: results.filter((row) => !row.ok).length, results });
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

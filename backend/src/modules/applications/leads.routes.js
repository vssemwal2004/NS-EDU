import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { encodeCursor, pagination, queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { assertValid } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';
import { assignableIds } from '../access/access-service.js';
import { crmUpdate } from '../crm/crm-model.js';
import { leadScopeOf } from './scope.js';
import { employeeAssignmentIds } from '../admin/employee-assignments.js';
import { answerColumns, DEFAULT_COLUMN_KEYS, describeColumn, LEAD_COLUMNS, LEGACY_CSV_KEYS, projectionFor, resolveColumns } from './lead-columns.js';
import { EXPORT_FORMATS, withExportSlot, writeCsv, writePdf, writeXlsx } from './lead-export.js';
import { leadInsights } from './lead-insights.js';
import { CLASS_LEVELS, INDIAN_STATES, SCHOOL_STREAMS, STATUSES } from './schema.js';
import {
  accessFilter, applicationNotes, applications, CHANNEL_LABELS, CHANNELS, clearLeadCounts, countLeads, cursorClause, DATE_RANGES, DAY,
  filterKey, IST_OFFSET, istDayStart, istToday, LIST_SORTS, resolveLeadFilter,
  serializeLeadDetail, serializeLeadSummary, serializeNote, staffEmails, statusLabel, visibleLead,
} from './service.js';

// Mounted at /api/admin/leads before the owner-only guard: employees see and act on
// leads assigned to them; assignment and export are administrator-only.
export const leadsRouter = Router();

async function detail(doc, staff) {
  const people = await staffEmails([...(doc.assignedEmployeeIds ?? []), ...(doc.statusHistory ?? []).map((entry) => entry.byAdminId)]);
  return serializeLeadDetail(doc, { staff, people });
}

// Numbered pages use skip up to this many rows; past it the list pages by cursor (index seek), so
// "next" stays fast at any depth while a jump to an arbitrary deep page asks for narrower filters.
export const MAX_SKIP = 50_000;
const PAGE_SIZES = [25, 50, 100];
const SUMMARY_FIELDS = ['applicant', 'preference', 'ref', 'channel', 'mode', 'status', 'school', 'academics.classLevel', 'academics.schoolStream', 'careerField', 'assignedEmployeeIds', 'crm', 'updatedAt'];

async function employeeEmails() {
  const employees = await (await collection(COLLECTIONS.admins)).find({ role: 'employee' }, { projection: { email: 1 } }).toArray();
  return new Map(employees.map((doc) => [doc._id.toString(), doc.email]));
}
async function formFor(query) {
  const id = toObjectId(queryString(query.form, 30));
  return id ? (await collection(COLLECTIONS.leadForms)).findOne({ _id: id }, { projection: { fields: 1, title: 1, school: 1 } }) : null;
}
const columnKeys = (value) => queryString(value, 4000).split(',').map((key) => key.trim()).filter(Boolean);

leadsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 25, maxLimit: 100, allowedLimits: PAGE_SIZES });
  const order = LIST_SORTS[queryString(request.query.sort, 10)] ?? LIST_SORTS.newest;
  const filter = await resolveLeadFilter(request.query, request.admin);
  const cursor = queryString(request.query.cursor, 80);
  const direction = queryString(request.query.dir, 10) === 'before' ? 'before' : 'after';
  if (!cursor && skip > MAX_SKIP) throw new HttpError(400, `Pages past ${MAX_SKIP.toLocaleString('en-IN')} rows open with Next/Previous only. Narrow the filters or the date range to jump.`, { fields: { page: 'Narrow the filters to jump this far' } });
  const keys = columnKeys(request.query.columns);
  const columns = keys.length ? resolveColumns(keys, { staff: request.admin, form: await formFor(request.query) }) : [];
  const leads = await applications();
  const query = cursor ? { $and: [filter, cursorClause(cursor, direction, order)] } : filter;
  // Reading backwards from a cursor flips the sort; the page is reversed again below.
  const sortOrder = cursor && direction === 'before' ? -order : order;
  const [docs, count, people] = await Promise.all([
    leads.find(query, { projection: projectionFor(columns, SUMMARY_FIELDS) }).sort({ createdAt: sortOrder, _id: sortOrder })
      .skip(cursor ? 0 : skip).limit(limit + 1).maxTimeMS(10_000).toArray(),
    countLeads(filter, filterKey(request.query, request.admin)),
    columns.some((column) => column.key === 'assigned') ? employeeEmails() : new Map(),
  ]).catch((error) => {
    if (error?.code === 50) throw new HttpError(503, 'These filters took too long to search. Add a date range or a narrower filter and try again.');
    throw error;
  });
  const hasMore = docs.length > limit;
  const rows = docs.slice(0, limit);
  if (cursor && direction === 'before') rows.reverse();
  response.json({
    items: rows.map((doc) => ({ ...serializeLeadSummary(doc), ...(columns.length && { values: Object.fromEntries(columns.map((column) => [column.key, column.read(doc, { people }) ?? ''])) }) })),
    total: count.total, totalExact: count.exact, page, limit,
    hasNext: cursor && direction === 'before' ? true : hasMore,
    hasPrevious: cursor ? (direction === 'before' ? hasMore : true) : page > 1,
    cursors: rows.length ? { first: encodeCursor(rows[0]), last: encodeCursor(rows.at(-1)) } : null,
    maxSkip: MAX_SKIP,
  });
});

// Status chip counts: one indexed count per status (cached), instead of grouping every lead.
// `form` scopes the counts to one school drive (the leads table embedded on a drive's page).
leadsRouter.get('/stats', async (request, response) => {
  const now = new Date();
  const today = istDayStart(istToday(now));
  const since = new Date(today.getTime() - 13 * DAY);
  const formParam = queryString(request.query.form, 30);
  const formId = formParam ? toObjectId(formParam) : null;
  if (formParam && !formId) throw new HttpError(400, 'Invalid school drive filter', { fields: { form: 'Choose a valid school drive' } });
  const match = { ...accessFilter(request.admin), ...(formId && { formId }) };
  const scope = `${leadScopeOf(request.admin) === 'all' ? 'all' : request.admin._id.toString()}${formId ? `|form=${formId}` : ''}`;
  const [byStatus, byDay] = await Promise.all([
    Promise.all(STATUSES.map((status) => countLeads({ ...match, status }, `${scope}|status=${status}`))),
    (await applications()).aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const perDay = new Map(byDay.map((row) => [row._id, row.count]));
  response.json({
    total: byStatus.reduce((sum, row) => sum + (row.total ?? 0), 0),
    byStatus: STATUSES.map((status, index) => ({ status, label: statusLabel(status), count: byStatus[index].total ?? 0 })),
    last14Days: Array.from({ length: 14 }, (_, index) => {
      const date = new Date(since.getTime() + index * DAY + IST_OFFSET).toISOString().slice(0, 10);
      return { date, count: perDay.get(date) ?? 0 };
    }),
  });
});

// Quick-view counts for the leads list (the clickable strip above the table), in one request. Each is
// an indexed, cached count over the viewer's scope (no documents are read). "Unassigned" and "Mine"
// only exist for people who see more than their own leads.
export const QUICK_VIEW_PARAMS = {
  hot: { heat: 'hot' },
  today: { followUp: 'today' },
  overdue: { followUp: 'overdue' },
  untouched: { status: 'new', idle: '2' },
  unassigned: { assignee: 'unassigned' },
  mine: { assignee: 'me' },
};
leadsRouter.get('/view-counts', async (request, response) => {
  const wide = leadScopeOf(request.admin) !== 'own';
  const keys = Object.keys(QUICK_VIEW_PARAMS).filter((key) => wide || (key !== 'unassigned' && key !== 'mine'));
  const counts = await Promise.all(keys.map(async (key) => {
    const params = QUICK_VIEW_PARAMS[key];
    return countLeads(await resolveLeadFilter(params, request.admin), filterKey(params, request.admin));
  }));
  response.json({ counts: Object.fromEntries(keys.map((key, index) => [key, counts[index].total])), exact: counts.every((count) => count.exact) });
});

// Leads dashboard (KPIs, trend, breakdowns); scoped to the viewer like the list.
leadsRouter.get('/insights', async (request, response) => {
  response.json(await leadInsights(request.query, request.admin));
});

leadsRouter.get('/columns', async (request, response) => {
  const form = await formFor(request.query);
  const visible = (column) => leadScopeOf(request.admin) === 'all' || !column.adminOnly;
  response.json({
    items: [...LEAD_COLUMNS, ...answerColumns(form)].filter(visible).map(describeColumn),
    defaults: DEFAULT_COLUMN_KEYS.filter((key) => visible(LEAD_COLUMNS.find((column) => column.key === key))),
    formats: Object.entries(EXPORT_FORMATS).map(([value, format]) => ({ value, label: format.label, maxRows: Number.isFinite(format.maxRows) ? format.maxRows : null, maxColumns: format.maxColumns ?? null })),
  });
});

// Choices for the filter drawer. Everything here is small and cached for a minute.
const filterOptionsCache = createTtlCache({ ttlMs: 60_000, maxEntries: 20 });
leadsRouter.get('/filter-options', async (_request, response) => {
  response.json(await filterOptionsCache.wrap('options', async () => {
    const [forms, careerFields, courses] = await Promise.all([
      (await collection(COLLECTIONS.leadForms)).find({ status: { $ne: 'deleted' } }, { projection: { title: 1, school: 1, status: 1, submissionCount: 1 } }).sort({ createdAt: -1 }).limit(2000).toArray(),
      (await collection(COLLECTIONS.careerFields)).find({}, { projection: { slug: 1, name: 1 } }).sort({ order: 1, name: 1 }).toArray(),
      (await collection(COLLECTIONS.courses)).find({ active: { $ne: false } }, { projection: { slug: 1, name: 1 } }).sort({ order: 1, name: 1 }).toArray(),
    ]);
    // Same-named districts in different states stay separate: the value carries the state.
    const districts = [...new Map(forms.filter((form) => form.school?.district).map((form) => [
      `${form.school.state ?? ''}|${form.school.districtKey}`,
      { value: form.school.state ? `${form.school.district}|${form.school.state}` : form.school.district, label: form.school.district, state: form.school.state ?? '' },
    ])).values()].sort((a, b) => a.label.localeCompare(b.label) || a.state.localeCompare(b.state));
    return {
      statuses: STATUSES.map((value) => ({ value, label: statusLabel(value) })),
      channels: CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] })),
      states: INDIAN_STATES,
      classes: CLASS_LEVELS,
      streams: SCHOOL_STREAMS,
      ranges: DATE_RANGES,
      forms: forms.map((form) => ({ id: form._id.toString(), title: form.title, school: form.school?.name ?? '', district: form.school?.district ?? '', state: form.school?.state ?? '', status: form.status, submissions: form.submissionCount ?? 0 })),
      districts,
      careerFields: careerFields.map((field) => ({ value: field.slug, label: field.name })),
      courses: courses.map((course) => ({ value: course.slug, label: course.name })),
    };
  }));
});

async function exportRequest(request) {
  const format = queryString(request.query.format, 10) || 'csv';
  const spec = EXPORT_FORMATS[format];
  if (!spec) throw new HttpError(400, 'Choose CSV, Excel or PDF', { fields: { format: 'Choose CSV, Excel or PDF' } });
  return { format, spec, filter: await resolveLeadFilter(request.query, request.admin) };
}

// What the download dialog shows before the file is generated: row count and format limits.
leadsRouter.get('/export/check', requirePermission('leads.export'), async (request, response) => {
  const { spec, filter } = await exportRequest(request);
  const count = await countLeads(filter, filterKey(request.query, request.admin));
  const keys = columnKeys(request.query.columns);
  // CSV has no row cap and never counts, so a count that timed out must not block it.
  const tooMany = Number.isFinite(spec.maxRows) && (count.total === null || count.total > spec.maxRows);
  response.json({
    total: count.total, totalExact: count.exact, maxRows: Number.isFinite(spec.maxRows) ? spec.maxRows : null, maxColumns: spec.maxColumns ?? null,
    ok: !tooMany && !(spec.maxColumns && keys.length > spec.maxColumns),
  });
});

async function sendExport(request, response, { format, spec, filter }, columns) {
  if (!columns.length) throw new HttpError(400, 'Choose at least one column', { fields: { columns: 'Choose at least one column' } });
  if (spec.maxColumns && columns.length > spec.maxColumns) throw new HttpError(400, `PDF fits at most ${spec.maxColumns} columns. Use Excel or CSV for more.`, { fields: { columns: `Choose up to ${spec.maxColumns} columns` } });
  if (Number.isFinite(spec.maxRows)) {
    const { total } = await countLeads(filter, filterKey(request.query, request.admin));
    if (total === null || total > spec.maxRows) throw new HttpError(413, `${spec.label} export is limited to ${spec.maxRows.toLocaleString('en-IN')} rows. Narrow the filters or use CSV.`);
  }
  await withExportSlot(async () => {
    const people = await employeeEmails();
    const cursor = (await applications()).find(filter, { projection: projectionFor(columns) }).sort({ createdAt: -1, _id: -1 }).batchSize(500);
    response.set({
      'Content-Type': spec.type,
      'Content-Disposition': `attachment; filename="gyaan-vidhya-leads-${istToday()}.${format}"`,
    });
    try {
      if (format === 'csv') await writeCsv(response, columns, cursor, { people });
      else if (format === 'xlsx') await writeXlsx(response, columns, cursor, { people });
      else await writePdf(response, columns, cursor, { people }, { title: 'Leads', subtitle: `Exported ${istToday()} (IST)` });
    } catch (error) {
      // Headers are already sent, so the client sees a truncated download rather than a JSON error.
      console.error(`Lead ${format} export failed:`, error.message);
      response.destroy();
    } finally {
      await cursor.close().catch(() => {});
    }
  });
}

leadsRouter.get('/export', requirePermission('leads.export'), async (request, response) => {
  const job = await exportRequest(request);
  const keys = columnKeys(request.query.columns);
  await sendExport(request, response, job, resolveColumns(keys.length ? keys : DEFAULT_COLUMN_KEYS, { staff: request.admin, form: await formFor(request.query) }));
});

// The original fixed-column CSV link; kept so bookmarked downloads keep working.
leadsRouter.get('/export.csv', requirePermission('leads.export'), async (request, response) => {
  await sendExport(request, response, { format: 'csv', spec: EXPORT_FORMATS.csv, filter: await resolveLeadFilter(request.query, request.admin) }, resolveColumns(LEGACY_CSV_KEYS, { staff: request.admin }));
});

// Mentors may only hand leads to themselves and their team; owners and `view_all` roles may pick anyone.
function assertAssignable(staff, employeeIds) {
  const allowed = assignableIds(staff);
  if (allowed && employeeIds.some((id) => !allowed.some((member) => member.equals(id)))) throw new HttpError(403, 'You can only assign leads to yourself and the people who report to you');
}

leadsRouter.post('/assignments/bulk', requirePermission('leads.assign'), async (request, response) => {
  const values = request.body?.applicationIds;
  if (!Array.isArray(values) || values.length < 1 || values.length > 100 || values.some((id) => !toObjectId(id)) || new Set(values.map((id) => id.toLowerCase())).size !== values.length) {
    throw new HttpError(400, 'Choose 1 to 100 distinct leads');
  }
  const ids = values.map(toObjectId);
  const employeeIds = await employeeAssignmentIds(request.body?.employeeIds, { includeOwners: true });
  if (!employeeIds.length) throw new HttpError(400, 'Choose at least one employee');
  assertAssignable(request.admin, employeeIds);
  const leads = await applications();
  const inScope = { _id: { $in: ids }, ...accessFilter(request.admin) };
  if (await leads.countDocuments(inScope) !== ids.length) throw new HttpError(404, 'One or more leads were not found');
  const result = await leads.updateMany(inScope, { $addToSet: { assignedEmployeeIds: { $each: employeeIds } }, $set: { updatedAt: new Date() } });
  clearLeadCounts();
  response.json({ count: result.matchedCount });
});

leadsRouter.get('/:id', async (request, response) => {
  response.json({ item: await detail(await visibleLead(request.params.id, request.admin), request.admin) });
});

leadsRouter.patch('/:id/status', requirePermission('leads.change_status'), async (request, response) => {
  const { status } = assertValid([{ name: 'status', type: 'select', options: STATUSES, required: true }], request.body);
  const lead = await visibleLead(request.params.id, request.admin);
  if (lead.status === status) return response.json({ item: await detail(lead, request.admin) });
  const now = new Date();
  const updated = await (await applications()).findOneAndUpdate(
    { _id: lead._id, ...accessFilter(request.admin) },
    { $set: { status, updatedAt: now, ...crmUpdate({ ...lead, status }, now, { lastActivityAt: now }) }, $push: { statusHistory: { status, at: now, byAdminId: request.admin._id } } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'Lead not found');
  clearLeadCounts();
  response.json({ item: await detail(updated, request.admin) });
});

leadsRouter.patch('/:id/assignments', requirePermission('leads.assign'), async (request, response) => {
  const employeeIds = await employeeAssignmentIds(request.body?.employeeIds, { includeOwners: true });
  assertAssignable(request.admin, employeeIds);
  const _id = toObjectId(request.params.id);
  const lead = _id && await (await applications()).findOneAndUpdate(
    { _id, ...accessFilter(request.admin) }, { $set: { assignedEmployeeIds: employeeIds, updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  if (!lead) throw new HttpError(404, 'Lead not found');
  clearLeadCounts();
  response.json({ item: await detail(lead, request.admin) });
});

leadsRouter.get('/:id/notes', async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 50, maxLimit: 100 });
  const notes = await applicationNotes();
  const filter = { applicationId: lead._id };
  const [docs, total] = await Promise.all([
    notes.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    notes.countDocuments(filter),
  ]);
  response.json({ items: docs.map(serializeNote), total, page, limit });
});

leadsRouter.post('/:id/notes', requirePermission('leads.notes'), async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  const { text } = assertValid([{ name: 'text', type: 'text', required: true, maxLength: 2000 }], request.body);
  const note = { applicationId: lead._id, text, authorId: request.admin._id, authorEmail: request.admin.email, authorRole: request.admin.role, createdAt: new Date() };
  await (await applicationNotes()).insertOne(note);
  await (await applications()).updateOne({ _id: lead._id }, { $set: { updatedAt: note.createdAt, ...crmUpdate(lead, note.createdAt, { lastActivityAt: note.createdAt }) } });
  response.status(201).json({ item: serializeNote(note) });
});

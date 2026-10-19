import { once } from 'node:events';
import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination } from '../../lib/query.js';
import { assertValid } from '../../lib/validation.js';
import { requireOwnerAdmin } from '../../middleware/auth.js';
import { employeeAssignmentIds } from '../admin/employee-assignments.js';
import { STATUSES } from './schema.js';
import {
  accessFilter, applicationNotes, applications, DAY, IST_OFFSET, istDayStart, istToday, leadFilter,
  serializeLeadDetail, serializeLeadSummary, serializeNote, staffEmails, statusLabel, visibleLead,
} from './service.js';

// Mounted at /api/admin/leads before the owner-only guard: employees see and act on
// leads assigned to them; assignment and export are administrator-only.
export const leadsRouter = Router();

async function detail(doc, staff) {
  const people = await staffEmails([...(doc.assignedEmployeeIds ?? []), ...doc.statusHistory.map((entry) => entry.byAdminId)]);
  return serializeLeadDetail(doc, { staff, people });
}

leadsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = leadFilter(request.query, request.admin);
  const leads = await applications();
  const [docs, total] = await Promise.all([
    leads.find(filter, { projection: { applicant: 1, preference: 1, ref: 1, mode: 1, status: 1, assignedEmployeeIds: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    leads.countDocuments(filter),
  ]);
  response.json({ items: docs.map(serializeLeadSummary), total, page, limit });
});

leadsRouter.get('/stats', async (request, response) => {
  const now = new Date();
  const today = istDayStart(istToday(now));
  const since = new Date(today.getTime() - 13 * DAY);
  const match = accessFilter(request.admin);
  const [byStatus, byDay] = await Promise.all([
    (await applications()).aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    (await applications()).aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const counts = new Map(byStatus.map((row) => [row._id, row.count]));
  const perDay = new Map(byDay.map((row) => [row._id, row.count]));
  response.json({
    total: byStatus.reduce((sum, row) => sum + row.count, 0),
    byStatus: STATUSES.map((status) => ({ status, label: statusLabel(status), count: counts.get(status) ?? 0 })),
    last14Days: Array.from({ length: 14 }, (_, index) => {
      const date = new Date(since.getTime() + index * DAY + IST_OFFSET).toISOString().slice(0, 10);
      return { date, count: perDay.get(date) ?? 0 };
    }),
  });
});

const CSV_COLUMNS = [
  ['Reference', (doc) => doc.ref],
  ['Submitted (IST)', (doc) => new Date(doc.createdAt.getTime() + IST_OFFSET).toISOString().slice(0, 16).replace('T', ' ')],
  ['Status', (doc) => statusLabel(doc.status)],
  ['Form', (doc) => (doc.mode === 'quick' ? 'Quick apply' : 'Detailed')],
  ['Full name', (doc) => doc.applicant?.fullName],
  ['Email', (doc) => doc.applicant?.email],
  ['Mobile', (doc) => doc.applicant?.phone],
  ['Date of birth', (doc) => doc.applicant?.dateOfBirth],
  ['Gender', (doc) => doc.applicant?.gender],
  ['City', (doc) => doc.applicant?.city],
  ['State', (doc) => doc.applicant?.state],
  ['PIN code', (doc) => doc.applicant?.pincode],
  ['Guardian', (doc) => [doc.applicant?.guardianName, doc.applicant?.guardianPhone].filter(Boolean).join(' ')],
  ['Highest qualification', (doc) => doc.academics?.highestQualification],
  ['Board / university', (doc) => doc.academics?.board],
  ['Passing year', (doc) => doc.academics?.passingYear],
  ['Score', (doc) => (typeof doc.academics?.score === 'number' ? `${doc.academics.score}${doc.academics.scoreType === 'cgpa' ? ' CGPA' : '%'}` : '')],
  ['Stream / subjects', (doc) => (doc.academics?.stream ?? []).join('; ')],
  ['Class 12', (doc) => (doc.academics?.class12 ? `${doc.academics.class12.board} ${doc.academics.class12.year} ${doc.academics.class12.percentage}%` : '')],
  ['Exams', (doc) => (doc.exams ?? []).map((exam) => [exam.name, exam.year, exam.scoreOrRank].filter(Boolean).join(' ')).join('; ')],
  ['University', (doc) => doc.preference.institutionName],
  ['University slug', (doc) => doc.preference.institutionSlug],
  ['Course', (doc) => doc.preference.courseName],
  ['Programme (free text)', (doc) => doc.preference.programmeName],
  ['Intake year', (doc) => doc.preference.intakeYear],
  ['Study mode', (doc) => doc.preference.studyMode],
  ['Hostel', (doc) => (typeof doc.preference.hostelRequired === 'boolean' ? (doc.preference.hostelRequired ? 'Yes' : 'No') : '')],
  ['Budget per year (INR)', (doc) => doc.preference.budgetPerYearInr ?? ''],
  ['Message', (doc) => doc.preference.message],
  ['Assigned to', (doc, people) => (doc.assignedEmployeeIds ?? []).map((id) => people.get(id.toString()) ?? '').filter(Boolean).join('; ')],
  ['Source path', (doc) => doc.source?.path],
  ['UTM source', (doc) => doc.source?.utmSource],
  ['UTM medium', (doc) => doc.source?.utmMedium],
  ['UTM campaign', (doc) => doc.source?.utmCampaign],
];
// Quotes every cell and neutralises spreadsheet formulas (CSV injection).
const csvCell = (value) => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${(/^[=+\-@\t]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

leadsRouter.get('/export.csv', requireOwnerAdmin, async (request, response) => {
  const filter = leadFilter(request.query, request.admin);
  const employees = await (await collection(COLLECTIONS.admins)).find({ role: 'employee' }, { projection: { email: 1 } }).toArray();
  const people = new Map(employees.map((doc) => [doc._id.toString(), doc.email]));
  response.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="gyaan-vidhya-leads-${istToday()}.csv"`,
  });
  response.write(`﻿${CSV_COLUMNS.map(([label]) => csvCell(label)).join(',')}\r\n`);
  const cursor = (await applications()).find(filter, { projection: { 'consent.ip': 0, 'consent.text': 0 } }).sort({ createdAt: -1, _id: -1 }).batchSize(500);
  try {
    for await (const doc of cursor) {
      if (response.destroyed) break;
      if (!response.write(`${CSV_COLUMNS.map(([, read]) => csvCell(read(doc, people))).join(',')}\r\n`)) await Promise.race([once(response, 'drain'), once(response, 'close')]);
    }
    response.end();
  } catch (error) {
    // Headers are already sent, so the client sees a truncated download rather than a JSON error.
    console.error('Lead export failed:', error.message);
    response.destroy();
  } finally {
    await cursor.close().catch(() => {});
  }
});

leadsRouter.post('/assignments/bulk', requireOwnerAdmin, async (request, response) => {
  const values = request.body?.applicationIds;
  if (!Array.isArray(values) || values.length < 1 || values.length > 100 || values.some((id) => !toObjectId(id)) || new Set(values.map((id) => id.toLowerCase())).size !== values.length) {
    throw new HttpError(400, 'Choose 1 to 100 distinct leads');
  }
  const ids = values.map(toObjectId);
  const employeeIds = await employeeAssignmentIds(request.body?.employeeIds);
  if (!employeeIds.length) throw new HttpError(400, 'Choose at least one employee');
  const leads = await applications();
  if (await leads.countDocuments({ _id: { $in: ids } }) !== ids.length) throw new HttpError(404, 'One or more leads were not found');
  const result = await leads.updateMany({ _id: { $in: ids } }, { $addToSet: { assignedEmployeeIds: { $each: employeeIds } }, $set: { updatedAt: new Date() } });
  response.json({ count: result.matchedCount });
});

leadsRouter.get('/:id', async (request, response) => {
  response.json({ item: await detail(await visibleLead(request.params.id, request.admin), request.admin) });
});

leadsRouter.patch('/:id/status', async (request, response) => {
  const { status } = assertValid([{ name: 'status', type: 'select', options: STATUSES, required: true }], request.body);
  const lead = await visibleLead(request.params.id, request.admin);
  if (lead.status === status) return response.json({ item: await detail(lead, request.admin) });
  const now = new Date();
  const updated = await (await applications()).findOneAndUpdate(
    { _id: lead._id, ...accessFilter(request.admin) },
    { $set: { status, updatedAt: now }, $push: { statusHistory: { status, at: now, byAdminId: request.admin._id } } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'Lead not found');
  response.json({ item: await detail(updated, request.admin) });
});

leadsRouter.patch('/:id/assignments', requireOwnerAdmin, async (request, response) => {
  const employeeIds = await employeeAssignmentIds(request.body?.employeeIds);
  const _id = toObjectId(request.params.id);
  const lead = _id && await (await applications()).findOneAndUpdate(
    { _id }, { $set: { assignedEmployeeIds: employeeIds, updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  if (!lead) throw new HttpError(404, 'Lead not found');
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

leadsRouter.post('/:id/notes', async (request, response) => {
  const lead = await visibleLead(request.params.id, request.admin);
  const { text } = assertValid([{ name: 'text', type: 'text', required: true, maxLength: 2000 }], request.body);
  const note = { applicationId: lead._id, text, authorId: request.admin._id, authorEmail: request.admin.email, authorRole: request.admin.role, createdAt: new Date() };
  await (await applicationNotes()).insertOne(note);
  await (await applications()).updateOne({ _id: lead._id }, { $set: { updatedAt: note.createdAt } });
  response.status(201).json({ item: serializeNote(note) });
});

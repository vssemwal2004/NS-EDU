import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';
import { staffDirectory } from '../access/access-service.js';
import { bulkAssignStudents, employeeAssignmentIds } from './employee-assignments.js';

export const referenceStudentsRouter = Router();

const studentFields = [
  { name: 'name', type: 'string', required: true, maxLength: 100 },
  { name: 'email', type: 'email' },
  { name: 'phone', type: 'string', maxLength: 20 },
];

const serialize = (student) => ({
  id: student._id.toString(),
  name: student.name,
  email: student.email || '',
  phone: student.phone || '',
  assignedEmployeeIds: (student.assignedEmployeeIds ?? []).map(String),
  createdById: student.createdById.toString(),
  createdByEmail: student.createdByEmail,
  source: student.source,
  createdAt: student.createdAt,
  updatedAt: student.updatedAt,
});

function cleanStudent(input) {
  const value = assertValid(studentFields, input);
  if (value.phone && !/^\+?[0-9]{10,15}$/.test(value.phone)) {
    throw new HttpError(400, 'Enter a valid mobile number', { fields: { phone: 'Use 10 to 15 digits, optionally starting with +.' } });
  }
  if (!value.email && !value.phone) throw new HttpError(400, 'Enter an email or mobile number');
  return value;
}

const holds = (staff, key) => Boolean(staff.isOwner || staff.permissions?.includes(key));
const seesAllStudents = (staff) => holds(staff, 'students.view_all');
const accessFilter = (staff) => seesAllStudents(staff) ? {} : { $or: [
  { assignedEmployeeIds: staff._id },
  { createdById: staff._id },
] };

async function visibleStudent(id, staff) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, 'Reference student not found');
  const student = await (await collection(COLLECTIONS.referenceStudents)).findOne({ _id, ...accessFilter(staff) });
  if (!student) throw new HttpError(404, 'Reference student not found');
  return student;
}

function newStudent(data, staff, source) {
  const now = new Date();
  return {
    ...data,
    assignedEmployeeIds: staff.isOwner ? [] : [staff._id],
    createdById: staff._id,
    createdByEmail: staff.email,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

const LIST_PROJECTION = { name: 1, email: 1, phone: 1, assignedEmployeeIds: 1, createdById: 1, createdByEmail: 1, source: 1, createdAt: 1, updatedAt: 1 };
const withAssignees = (item, names) => ({ ...item, assignees: item.assignedEmployeeIds.map((id) => ({ id, name: names.get(id) ?? 'Removed staff' })) });

// The person who added a reference student may edit or delete it; anyone else needs students.edit / students.delete.
const mayChange = (staff, student, key) => holds(staff, key) || student.createdById?.toString() === staff._id.toString();

referenceStudentsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 25, maxLimit: 100 });
  const q = queryString(request.query.q);
  const searchFilter = q ? { $or: ['name', 'email', 'phone'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {};
  // `assignee`: "none" (nobody assigned) or a staff id.
  const assignee = queryString(request.query.assignee, 24);
  const assigneeFilter = assignee === 'none' ? { 'assignedEmployeeIds.0': { $exists: false } } : toObjectId(assignee) ? { assignedEmployeeIds: toObjectId(assignee) } : {};
  const parts = [accessFilter(request.admin), searchFilter, assigneeFilter].filter((part) => Object.keys(part).length);
  const filter = parts.length ? { $and: parts } : {};
  const students = await collection(COLLECTIONS.referenceStudents);
  const [docs, total] = await Promise.all([
    students.find(filter, { projection: LIST_PROJECTION }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    students.countDocuments(filter),
  ]);
  const staff = docs.some((doc) => doc.assignedEmployeeIds?.length) ? await staffDirectory() : [];
  const names = new Map(staff.map((person) => [String(person._id), person.name || person.email]));
  response.json({ items: docs.map((doc) => withAssignees(serialize(doc), names)), total, page, limit });
});

// Staff who can be given students (the assign drawers on both student screens, so either assign key opens it).
// Same rule as employeeAssignmentIds: employee accounts.
referenceStudentsRouter.get('/assignees', requirePermission('students.assign', 'accounts.assign'), async (_request, response) => {
  const docs = (await staffDirectory()).filter((doc) => doc.role === 'employee' && doc.status !== 'suspended').slice(0, 500);
  response.json({ items: docs.map((doc) => ({ id: doc._id.toString(), name: doc.name || '', email: doc.email })) });
});

referenceStudentsRouter.post('/', requirePermission('students.create'), async (request, response) => {
  const doc = newStudent(cleanStudent(request.body), request.admin, 'manual');
  await (await collection(COLLECTIONS.referenceStudents)).insertOne(doc);
  response.status(201).json({ item: serialize(doc) });
});

referenceStudentsRouter.post('/import', requirePermission('students.create'), async (request, response) => {
  const rows = request.body?.students;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) {
    throw new HttpError(400, 'Upload 1 to 200 students at a time');
  }
  const docs = rows.map((row, index) => {
    try { return newStudent(cleanStudent(row), request.admin, 'upload'); }
    catch (error) {
      if (error instanceof HttpError) throw new HttpError(400, `Row ${index + 1}: ${error.message}`, error.details);
      throw error;
    }
  });
  await (await collection(COLLECTIONS.referenceStudents)).insertMany(docs);
  response.status(201).json({ count: docs.length });
});

referenceStudentsRouter.post('/assignments/bulk', requirePermission('students.assign'), async (request, response) => {
  response.json(await bulkAssignStudents(COLLECTIONS.referenceStudents, request.body, { touchUpdatedAt: true }));
});

// Bulk version of DELETE /:id with the same rule per student: students the caller cannot see, or did not add
// and may not delete, are skipped (counted), not an error for the whole batch.
referenceStudentsRouter.post('/bulk-delete', async (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? [...new Set(request.body.ids.map(String))].map(toObjectId) : [];
  if (!ids.length || ids.length > 100 || ids.some((id) => !id)) throw new HttpError(400, 'Select between 1 and 100 students', { fields: { ids: 'Invalid selection' } });
  const students = await collection(COLLECTIONS.referenceStudents);
  const found = await students.find({ $and: [{ _id: { $in: ids } }, accessFilter(request.admin)] }, { projection: { createdById: 1 } }).toArray();
  const allowed = found.filter((student) => mayChange(request.admin, student, 'students.delete')).map((student) => student._id);
  if (!allowed.length) {
    response.json({ requested: ids.length, deleted: 0, skipped: ids.length, followupsDeleted: 0 });
    return;
  }
  const { deletedCount } = await students.deleteMany({ _id: { $in: allowed } });
  const followups = await (await collection(COLLECTIONS.studentFollowups)).deleteMany({ studentId: { $in: allowed }, studentKind: { $ne: 'account' } });
  response.json({ requested: ids.length, deleted: deletedCount, skipped: ids.length - deletedCount, followupsDeleted: followups.deletedCount });
});

referenceStudentsRouter.get('/:id', async (request, response) => {
  response.json({ item: serialize(await visibleStudent(request.params.id, request.admin)) });
});

referenceStudentsRouter.patch('/:id', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  if (!mayChange(request.admin, student, 'students.edit')) throw new HttpError(403, 'Only the person who added this student, or staff allowed to edit students, can edit it');
  const value = cleanStudent({ name: student.name, email: student.email ?? '', phone: student.phone ?? '', ...request.body });
  const updated = await (await collection(COLLECTIONS.referenceStudents)).findOneAndUpdate(
    { _id: student._id }, { $set: { name: value.name, email: value.email ?? '', phone: value.phone ?? '', updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  response.json({ item: serialize(updated) });
});

// Removes the student and their follow-up notes for good (the screen asks to type DELETE first).
referenceStudentsRouter.delete('/:id', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  if (!mayChange(request.admin, student, 'students.delete')) throw new HttpError(403, 'Only the person who added this student, or staff allowed to delete students, can delete it');
  await (await collection(COLLECTIONS.referenceStudents)).deleteOne({ _id: student._id });
  const { deletedCount } = await (await collection(COLLECTIONS.studentFollowups)).deleteMany({ studentId: student._id, studentKind: { $ne: 'account' } });
  response.json({ deleted: true, followupsDeleted: deletedCount });
});

referenceStudentsRouter.patch('/:id/assignments', requirePermission('students.assign'), async (request, response) => {
  const employeeIds = await employeeAssignmentIds(request.body?.employeeIds);
  const _id = toObjectId(request.params.id);
  const student = _id && await (await collection(COLLECTIONS.referenceStudents)).findOneAndUpdate(
    { _id }, { $set: { assignedEmployeeIds: employeeIds, updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  if (!student) throw new HttpError(404, 'Reference student not found');
  response.json({ item: serialize(student) });
});

referenceStudentsRouter.get('/:id/followups', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 50, maxLimit: 100 });
  const followups = await collection(COLLECTIONS.studentFollowups);
  const filter = { studentId: student._id, studentKind: { $ne: 'account' } };
  const [docs, total] = await Promise.all([
    followups.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    followups.countDocuments(filter),
  ]);
  response.json({ items: docs.map((doc) => ({ id: doc._id.toString(), comment: doc.comment, authorEmail: doc.authorEmail, authorRole: doc.authorRole, createdAt: doc.createdAt })), total, page, limit });
});

referenceStudentsRouter.post('/:id/followups', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  const { comment } = assertValid([{ name: 'comment', type: 'text', required: true, maxLength: 2000 }], request.body);
  const followup = { studentId: student._id, studentKind: 'reference', comment, authorId: request.admin._id, authorEmail: request.admin.email, authorRole: request.admin.role, createdAt: new Date() };
  await (await collection(COLLECTIONS.studentFollowups)).insertOne(followup);
  response.status(201).json({ item: { id: followup._id.toString(), comment, authorEmail: followup.authorEmail, authorRole: followup.authorRole, createdAt: followup.createdAt } });
});

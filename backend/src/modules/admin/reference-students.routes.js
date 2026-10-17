import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';
import { requireOwnerAdmin } from '../../middleware/auth.js';
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

const accessFilter = (staff) => staff.role === 'admin' ? {} : { $or: [
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
    assignedEmployeeIds: staff.role === 'employee' ? [staff._id] : [],
    createdById: staff._id,
    createdByEmail: staff.email,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

referenceStudentsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query);
  const q = queryString(request.query.q);
  const searchFilter = q ? { $or: ['name', 'email', 'phone'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {};
  const filter = request.admin.role === 'employee' && q
    ? { $and: [accessFilter(request.admin), searchFilter] }
    : { ...accessFilter(request.admin), ...searchFilter };
  const students = await collection(COLLECTIONS.referenceStudents);
  const [docs, total] = await Promise.all([
    students.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    students.countDocuments(filter),
  ]);
  response.json({ items: docs.map(serialize), total, page, limit });
});

referenceStudentsRouter.post('/', async (request, response) => {
  const doc = newStudent(cleanStudent(request.body), request.admin, 'manual');
  await (await collection(COLLECTIONS.referenceStudents)).insertOne(doc);
  response.status(201).json({ item: serialize(doc) });
});

referenceStudentsRouter.post('/import', async (request, response) => {
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

referenceStudentsRouter.post('/assignments/bulk', requireOwnerAdmin, async (request, response) => {
  response.json(await bulkAssignStudents(COLLECTIONS.referenceStudents, request.body, { touchUpdatedAt: true }));
});

referenceStudentsRouter.get('/:id', async (request, response) => {
  response.json({ item: serialize(await visibleStudent(request.params.id, request.admin)) });
});

referenceStudentsRouter.patch('/:id/assignments', requireOwnerAdmin, async (request, response) => {
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

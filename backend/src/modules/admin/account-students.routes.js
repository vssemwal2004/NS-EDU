import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';
import { serializeStudentForAdmin } from './students.js';

export const accountStudentsRouter = Router();

const accessFilter = (staff) => staff.role === 'admin' ? {} : { assignedEmployeeIds: staff._id };

async function visibleStudent(id, staff) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, 'Student account not found');
  const student = await (await collection(COLLECTIONS.students)).findOne({ _id, ...accessFilter(staff) });
  if (!student) throw new HttpError(404, 'Student account not found');
  return student;
}

accountStudentsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query);
  const q = queryString(request.query.q);
  const filter = {
    ...accessFilter(request.admin),
    ...(q ? { $or: ['name', 'email', 'phone'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {}),
  };
  const students = await collection(COLLECTIONS.students);
  const [docs, total] = await Promise.all([
    students.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    students.countDocuments(filter),
  ]);
  response.json({ items: docs.map(serializeStudentForAdmin), total, page, limit });
});

accountStudentsRouter.get('/:id/followups', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 50, maxLimit: 100 });
  const followups = await collection(COLLECTIONS.studentFollowups);
  const filter = { studentId: student._id, studentKind: 'account' };
  const [docs, total] = await Promise.all([
    followups.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    followups.countDocuments(filter),
  ]);
  response.json({ items: docs.map((doc) => ({ id: doc._id.toString(), comment: doc.comment, authorEmail: doc.authorEmail, authorRole: doc.authorRole, createdAt: doc.createdAt })), total, page, limit });
});

accountStudentsRouter.post('/:id/followups', async (request, response) => {
  const student = await visibleStudent(request.params.id, request.admin);
  const { comment } = assertValid([{ name: 'comment', type: 'text', required: true, maxLength: 2000 }], request.body);
  const followup = { studentId: student._id, studentKind: 'account', comment, authorId: request.admin._id, authorEmail: request.admin.email, authorRole: request.admin.role, createdAt: new Date() };
  await (await collection(COLLECTIONS.studentFollowups)).insertOne(followup);
  response.status(201).json({ item: { id: followup._id.toString(), comment, authorEmail: followup.authorEmail, authorRole: followup.authorRole, createdAt: followup.createdAt } });
});

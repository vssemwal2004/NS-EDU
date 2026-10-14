import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';

const STATUSES = ['active', 'blocked'];
const updateFields = [
  { name: 'status', type: 'select', options: STATUSES, required: true },
  { name: 'name', type: 'string', maxLength: 80 },
];

export const serializeStudentForAdmin = (student) => ({
  id: student._id.toString(),
  email: student.email ?? null,
  phone: student.phone ?? null,
  name: student.name ?? '',
  status: student.status ?? 'active',
  createdAt: student.createdAt ?? null,
  lastLoginAt: student.lastLoginAt ?? null,
  loginCount: student.loginCount ?? 0,
});

export async function listStudents(query) {
  const { page, limit, skip } = pagination(query);
  const q = queryString(query.q);
  const status = queryString(query.status, 20);
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Status must be active or blocked', { fields: { status: 'Choose active or blocked' } });
  const filter = {
    ...(status === 'active' ? { status: { $ne: 'blocked' } } : status ? { status } : {}),
    ...(q ? { $or: ['email', 'phone', 'name'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {}),
  };
  const students = await collection(COLLECTIONS.students);
  const [docs, total] = await Promise.all([
    students.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    students.countDocuments(filter),
  ]);
  return { items: docs.map(serializeStudentForAdmin), total, page, limit };
}

export async function updateStudent(id, body) {
  const data = assertValid(updateFields, body, { partial: true });
  const _id = toObjectId(id);
  const students = await collection(COLLECTIONS.students);
  const student = _id && (Object.keys(data).length
    ? await students.findOneAndUpdate({ _id }, { $set: data }, { returnDocument: 'after' })
    : await students.findOne({ _id }));
  if (!student) throw new HttpError(404, 'Student not found');
  return serializeStudentForAdmin(student);
}

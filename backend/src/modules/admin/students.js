import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';
import { audit } from '../access/access-service.js';
import { employeeAssignmentIds, staffNames } from './employee-assignments.js';

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
  assignedEmployeeIds: (student.assignedEmployeeIds ?? []).map(String),
});

const LIST_PROJECTION = { email: 1, phone: 1, name: 1, status: 1, createdAt: 1, lastLoginAt: 1, loginCount: 1, assignedEmployeeIds: 1 };
export async function listStudents(query) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 25, maxLimit: 100 });
  const q = queryString(query.q);
  const status = queryString(query.status, 20);
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Status must be active or blocked', { fields: { status: 'Choose active or blocked' } });
  const filter = {
    ...(status === 'active' ? { status: { $ne: 'blocked' } } : status ? { status } : {}),
    ...(q ? { $or: ['email', 'phone', 'name'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {}),
  };
  const students = await collection(COLLECTIONS.students);
  const [docs, total] = await Promise.all([
    students.find(filter, { projection: LIST_PROJECTION }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    students.countDocuments(filter),
  ]);
  const items = docs.map(serializeStudentForAdmin);
  const names = await staffNames(items.flatMap((item) => item.assignedEmployeeIds));
  return { items: items.map((item) => ({ ...item, assignees: item.assignedEmployeeIds.map((id) => ({ id, name: names.get(id) ?? 'Removed staff' })) })), total, page, limit };
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

const MAX_BULK = 100;
function bulkIds(body) {
  const values = Array.isArray(body?.ids) ? [...new Set(body.ids.map(String))] : [];
  const ids = values.map(toObjectId);
  if (!ids.length || ids.length > MAX_BULK || ids.some((id) => !id)) throw new HttpError(400, `Select between 1 and ${MAX_BULK} students`, { fields: { ids: 'Invalid selection' } });
  return ids;
}

/** Block or restore sign-in for up to 100 accounts at once. */
export async function bulkUpdateStudents(body) {
  const { status } = assertValid([{ name: 'status', type: 'select', options: STATUSES, required: true }], { status: body?.status });
  const ids = bulkIds(body);
  const result = await (await collection(COLLECTIONS.students)).updateMany({ _id: { $in: ids } }, { $set: { status } });
  return { status, matched: result.matchedCount, modified: result.modifiedCount };
}

/**
 * Deletes a student's sign-in account for good: the account, its review, its staff follow-up notes and its
 * one-time codes. Leads it submitted stay (an institution may already be acting on them) but lose the link,
 * and analytics events keep no student id. Shared with the privacy erasure flow.
 */
export async function eraseStudentAccount(studentId, now = new Date()) {
  const students = await collection(COLLECTIONS.students);
  const account = await students.findOne({ _id: studentId }, { projection: { email: 1, phone: 1, name: 1 } });
  if (!account) return null;
  await (await collection(COLLECTIONS.applications)).updateMany({ studentId }, { $set: { studentId: null, updatedAt: now } });
  await (await collection(COLLECTIONS.reviews)).deleteMany({ studentId });
  await (await collection(COLLECTIONS.studentEvents)).updateMany({ studentId }, { $unset: { studentId: '' } });
  await (await collection(COLLECTIONS.studentFollowups)).deleteMany({ studentId, studentKind: 'account' });
  const codes = await collection(COLLECTIONS.otpCodes);
  for (const [channel, identifier] of [['email', account.email], ['phone', account.phone]]) if (identifier) await codes.deleteMany({ channel, identifier });
  await students.deleteOne({ _id: studentId });
  return account;
}

const accountLabel = (account) => account.name || account.email || account.phone || 'Student account';

export async function deleteStudentAccount(staff, id) {
  const _id = toObjectId(id);
  const account = _id && await eraseStudentAccount(_id);
  if (!account) throw new HttpError(404, 'Student not found');
  await audit(staff, 'student_account.delete', { type: 'student', id: _id, label: accountLabel(account) });
  return { deleted: 1 };
}

export async function bulkDeleteStudentAccounts(staff, body) {
  const ids = bulkIds(body);
  let deleted = 0;
  for (const _id of ids) {
    const account = await eraseStudentAccount(_id);
    if (!account) continue;
    deleted++;
    await audit(staff, 'student_account.delete', { type: 'student', id: _id, label: accountLabel(account) }, { bulk: true });
  }
  return { requested: ids.length, deleted };
}

export async function assignStudent(id, body) {
  const employeeIds = await employeeAssignmentIds(body?.employeeIds);
  const _id = toObjectId(id);
  const student = _id && await (await collection(COLLECTIONS.students)).findOneAndUpdate(
    { _id }, { $set: { assignedEmployeeIds: employeeIds } }, { returnDocument: 'after' },
  );
  if (!student) throw new HttpError(404, 'Student not found');
  return serializeStudentForAdmin(student);
}

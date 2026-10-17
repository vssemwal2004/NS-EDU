import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';

export async function employeeAssignmentIds(value) {
  if (!Array.isArray(value) || value.length > 50 || value.some((id) => !toObjectId(id)) || new Set(value.map((id) => id.toLowerCase())).size !== value.length) {
    throw new HttpError(400, 'Choose up to 50 distinct employees');
  }
  const ids = value.map(toObjectId);
  if (ids.length && await (await collection(COLLECTIONS.admins)).countDocuments({ _id: { $in: ids }, role: 'employee' }) !== ids.length) {
    throw new HttpError(400, 'Choose valid employees');
  }
  return ids;
}

export async function bulkAssignStudents(collectionName, body, { touchUpdatedAt = false } = {}) {
  const values = body?.studentIds;
  if (!Array.isArray(values) || values.length < 1 || values.length > 100 || values.some((id) => !toObjectId(id)) || new Set(values.map((id) => id.toLowerCase())).size !== values.length) {
    throw new HttpError(400, 'Choose 1 to 100 distinct students');
  }
  const studentIds = values.map(toObjectId);
  const employeeIds = await employeeAssignmentIds(body?.employeeIds);
  if (!employeeIds.length) throw new HttpError(400, 'Choose at least one employee');
  const students = await collection(collectionName);
  const filter = { _id: { $in: studentIds } };
  if (await students.countDocuments(filter) !== studentIds.length) throw new HttpError(404, 'One or more students were not found');
  const result = await students.updateMany(filter, {
    $addToSet: { assignedEmployeeIds: { $each: employeeIds } },
    ...(touchUpdatedAt ? { $set: { updatedAt: new Date() } } : {}),
  });
  return { count: result.matchedCount };
}

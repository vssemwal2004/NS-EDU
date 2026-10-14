import { collection, COLLECTIONS, toObjectId } from '../db/collections.js';
import { ADMIN_COOKIE, STUDENT_COOKIE, clearStudentCookie } from '../lib/cookies.js';
import { HttpError } from '../lib/http-error.js';
import { verifySession } from '../lib/jwt.js';

const bearer = (request) => /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(request.get('authorization') ?? '')?.[1];

async function loadAdmin(request) {
  const payload = verifySession(request.cookies?.[ADMIN_COOKIE] ?? bearer(request), 'admin');
  const id = toObjectId(payload?.sub);
  if (!id) return null;
  return (await collection(COLLECTIONS.admins)).findOne({ _id: id, role: 'admin' }, { projection: { passwordHash: 0 } });
}

async function loadStudent(request) {
  const payload = verifySession(request.cookies?.[STUDENT_COOKIE], 'student');
  const id = toObjectId(payload?.sub);
  if (!id) return null;
  const student = await (await collection(COLLECTIONS.students)).findOne({ _id: id });
  return student?.status === 'blocked' ? null : student;
}

export async function requireAdmin(request, _response, next) {
  const admin = await loadAdmin(request);
  if (!admin) throw new HttpError(401, 'Admin session required');
  request.admin = admin;
  next();
}

export async function requireStudent(request, response, next) {
  const student = await loadStudent(request);
  if (!student) {
    if (request.cookies?.[STUDENT_COOKIE]) clearStudentCookie(response);
    throw new HttpError(401, 'Not signed in');
  }
  request.student = student;
  next();
}

export async function optionalStudent(request, _response, next) {
  request.student = await loadStudent(request);
  next();
}

import { collection, COLLECTIONS, toObjectId } from '../db/collections.js';
import { ADMIN_COOKIE, STUDENT_COOKIE, clearStudentCookie } from '../lib/cookies.js';
import { HttpError } from '../lib/http-error.js';
import { verifySession } from '../lib/jwt.js';
import { attachAccess, can } from '../modules/access/access-service.js';
import { CONFIDENTIALITY_CODE, CONFIDENTIALITY_VERSION, confidentialityEnforced } from '../modules/access/confidentiality.js';

const bearer = (request) => /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(request.get('authorization') ?? '')?.[1];

async function loadAdmin(request) {
  const payload = verifySession(request.cookies?.[ADMIN_COOKIE] ?? bearer(request), 'admin');
  const id = toObjectId(payload?.sub);
  if (!id) return null;
  const admin = await (await collection(COLLECTIONS.admins)).findOne({ _id: id, role: { $in: ['admin', 'employee'] } }, { projection: { passwordHash: 0 } });
  // A suspended account loses access at once, even with a valid session cookie.
  if (!admin || admin.status === 'suspended') return null;
  return attachAccess(admin);
}

async function loadStudent(request) {
  const payload = verifySession(request.cookies?.[STUDENT_COOKIE], 'student');
  const id = toObjectId(payload?.sub);
  if (!id) return null;
  const student = await (await collection(COLLECTIONS.students)).findOne({ _id: id });
  return student?.status === 'blocked' ? null : student;
}

export async function requireAdmin(request, response, next) {
  const started = performance.now();
  const admin = await loadAdmin(request).finally(() => {
    response.locals.adminAuthMs = performance.now() - started;
  });
  if (!admin) throw new HttpError(401, 'Admin session required');
  request.admin = admin;
  next();
}

export async function optionalAdmin(request, _response, next) {
  request.admin = await loadAdmin(request);
  next();
}

export function requireReadyStaff(request, _response, next) {
  if (request.admin.mustChangePassword) throw new HttpError(403, 'Change your password before accessing the console');
  next();
}

// Console routes a staff member may use before accepting the confidentiality undertaking: only their own
// profile. Sign-in, /me, the undertaking itself, password change and logout live on /api/admin/auth, which
// is mounted outside the console router and never passes through this guard.
const CONFIDENTIALITY_OPEN = [/^\/access\/me\/?$/];

/** Refuses every console route (leads, students, exports, ...) until the current undertaking is accepted. Owners are exempt. */
export function requireConfidentiality(request, _response, next) {
  if (confidentialityEnforced(request.admin) && !CONFIDENTIALITY_OPEN.some((pattern) => pattern.test(request.path))) {
    throw new HttpError(403, 'Read and accept the student data confidentiality undertaking before using the console.', { code: CONFIDENTIALITY_CODE, version: CONFIDENTIALITY_VERSION });
  }
  next();
}

export function requireOwnerAdmin(request, _response, next) {
  if (!request.admin.isOwner) throw new HttpError(403, 'Administrator access required');
  next();
}

/** Passes when the signed-in staff member holds any one of the listed permissions. */
export const requirePermission = (...keys) => (request, _response, next) => {
  if (!keys.some((key) => can(request.admin, key))) throw new HttpError(403, 'Your role does not include this action', { permission: keys[0] });
  next();
};

export async function requireStudent(request, response, next) {
  const student = await loadStudent(request);
  if (!student) {
    if (request.cookies?.[STUDENT_COOKIE]) clearStudentCookie(response);
    throw new HttpError(401, 'Not signed in');
  }
  request.student = student;
  next();
}

// Signed-in student or console staff. Used to gate the university directory.
export async function loadViewer(request) {
  const student = await loadStudent(request);
  if (student) return { student, admin: null };
  const admin = await loadAdmin(request);
  return admin ? { student: null, admin } : null;
}

export async function requireStudentOrAdmin(request, response, next) {
  const viewer = await loadViewer(request);
  if (!viewer) {
    if (request.cookies?.[STUDENT_COOKIE]) clearStudentCookie(response);
    throw new HttpError(401, 'Sign in to search and view universities.', { loginRequired: true });
  }
  request.student = viewer.student;
  request.admin = viewer.admin;
  next();
}

export async function optionalStudent(request, _response, next) {
  request.student = await loadStudent(request);
  next();
}

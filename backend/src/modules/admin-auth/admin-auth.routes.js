import { Router } from 'express';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminCookieOptions, clearAdminCookie } from '../../lib/cookies.js';
import { HttpError } from '../../lib/http-error.js';
import { signSession } from '../../lib/jwt.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { assertValid } from '../../lib/validation.js';
import { requireAdmin } from '../../middleware/auth.js';
import { assertEmployeePassword } from './password-policy.js';

const WINDOW_MS = 15 * 60 * 1000;
const byIp = createRateLimiter({ windowMs: WINDOW_MS, max: 10 });
const byEmail = createRateLimiter({ windowMs: WINDOW_MS, max: 10 });
const loginFields = [
  { name: 'email', type: 'email', required: true },
  { name: 'password', type: 'text', required: true, maxLength: 200 },
];

export const serializeAdmin = (admin) => ({ id: admin._id.toString(), email: admin.email, name: admin.name ?? '', role: admin.role, mustChangePassword: Boolean(admin.mustChangePassword), lastLoginAt: admin.lastLoginAt ?? null });

function limit(limiter, key) {
  const result = limiter.hit(key);
  if (!result.allowed) {
    throw new HttpError(429, 'Too many sign-in attempts. Please try again later.', { retryAfterSeconds: result.retryAfterSeconds });
  }
}

export const adminAuthRouter = Router();
adminAuthRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

adminAuthRouter.post('/login', async (request, response) => {
  limit(byIp, request.ip);
  const raw = request.body ?? {};
  // Passwords are compared verbatim (not trimmed).
  const { email } = assertValid(loginFields, raw);
  const password = raw.password;
  limit(byEmail, email);
  const admins = await collection(COLLECTIONS.admins);
  const admin = await admins.findOne({ email, role: { $in: ['admin', 'employee'] } });
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : await burnPasswordCheck(password);
  if (!valid) throw new HttpError(401, 'Invalid email or password');
  byEmail.delete(email);
  const lastLoginAt = new Date();
  await admins.updateOne({ _id: admin._id }, { $set: { lastLoginAt } });
  response.cookie(ADMIN_COOKIE, signSession(admin._id.toString(), 'admin', ADMIN_SESSION_SECONDS), adminCookieOptions());
  response.json({ admin: serializeAdmin({ ...admin, lastLoginAt }) });
});

adminAuthRouter.get('/me', requireAdmin, (request, response) => response.json({ admin: serializeAdmin(request.admin) }));

adminAuthRouter.post('/change-password', requireAdmin, async (request, response) => {
  const currentPassword = request.body?.currentPassword;
  const newPassword = request.body?.newPassword;
  if (typeof currentPassword !== 'string' || !currentPassword) throw new HttpError(400, 'Enter your current password', { fields: { currentPassword: 'Required' } });
  assertEmployeePassword(newPassword);
  const admins = await collection(COLLECTIONS.admins);
  const admin = await admins.findOne({ _id: request.admin._id });
  if (!admin) throw new HttpError(401, 'Admin session required');
  if (!await verifyPassword(currentPassword, admin.passwordHash)) throw new HttpError(401, 'Current password is incorrect');
  if (await verifyPassword(newPassword, admin.passwordHash)) throw new HttpError(400, 'Choose a different password', { fields: { newPassword: 'Choose a different password.' } });
  const result = await admins.updateOne({ _id: admin._id, passwordHash: admin.passwordHash }, { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: new Date() } });
  if (!result.modifiedCount) throw new HttpError(409, 'Password changed in another session. Please try again.');
  response.json({ admin: serializeAdmin({ ...admin, mustChangePassword: false }) });
});

adminAuthRouter.post('/logout', (_request, response) => {
  clearAdminCookie(response);
  response.status(204).end();
});

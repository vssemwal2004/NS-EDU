import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminCookieOptions, clearAdminCookie } from '../../lib/cookies.js';
import { HttpError } from '../../lib/http-error.js';
import { signSession } from '../../lib/jwt.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { assertValid } from '../../lib/validation.js';
import { describeMailError } from '../../lib/mailer.js';
import { optionalAdmin, requireAdmin } from '../../middleware/auth.js';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS, codeMatches, deliverOtp, exposesDevCode, generateCode, hashCode, maskIdentifier } from '../student-auth/otp.js';
import { attachAccess, audit } from '../access/access-service.js';
import {
  CONFIDENTIALITY_VERSION, confidentialityEnforced, confidentialityRecord, confidentialitySummary, confidentialityText, mustAcceptConfidentiality,
} from '../access/confidentiality.js';
import { assertEmployeePassword } from './password-policy.js';

const WINDOW_MS = 15 * 60 * 1000;
const byIp = createRateLimiter({ windowMs: WINDOW_MS, max: 10 });
const byEmail = createRateLimiter({ windowMs: WINDOW_MS, max: 10 });
const codeSendsByIp = createRateLimiter({ windowMs: WINDOW_MS, max: 20 });
const codeSendsByEmail = createRateLimiter({ windowMs: WINDOW_MS, max: 5 });
const loginFields = [
  { name: 'email', type: 'email', required: true },
  { name: 'password', type: 'text', required: true, maxLength: 200 },
];
const challengeFields = [{ name: 'challenge', type: 'string', required: true, maxLength: 64 }];
const verifyFields = [...challengeFields, { name: 'code', type: 'string', required: true, maxLength: 6 }];
const challengeId = (token) => createHash('sha256').update(token).digest('hex');
const passwordVersion = (hash) => createHash('sha256').update(hash).digest('hex');
const validToken = (token) => /^[a-f0-9]{64}$/.test(token);
const invalidChallenge = () => new HttpError(400, 'This sign-in code has expired. Sign in again.');

async function sendCode(request, admin, code) {
  const ipLimit = codeSendsByIp.peek(request.ip);
  const emailLimit = codeSendsByEmail.peek(admin.email);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const seconds = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    throw new HttpError(429, 'Too many sign-in codes requested. Please try again later.', { retryAfterSeconds: seconds });
  }
  try {
    await deliverOtp({ channel: 'email', identifier: admin.email, code });
  } catch (error) {
    console.error(`[ADMIN OTP] delivery failed (request ${request.id}): ${describeMailError(error)}`);
    throw new HttpError(503, "We couldn't send the sign-in code. Please try again shortly.");
  }
  codeSendsByIp.hit(request.ip);
  codeSendsByEmail.hit(admin.email);
}

function readChallenge(body, fields) {
  const data = assertValid(fields, body);
  if (!validToken(data.challenge)) throw invalidChallenge();
  return data;
}

// `role` stays 'admin' | 'employee' for older screens; the fields below are the real access model.
export const serializeAdmin = (admin) => ({
  id: admin._id.toString(), email: admin.email, name: admin.name ?? '', title: admin.title ?? '', phone: admin.phone ?? '', role: admin.role,
  roleId: admin.roleId, roleName: admin.roleName, roleColor: admin.roleColor, isOwner: Boolean(admin.isOwner),
  permissions: admin.permissions ?? [], leadScope: admin.leadScope ?? 'none', analyticsScope: admin.analyticsScope ?? 'none',
  managerId: admin.managerId ? String(admin.managerId) : null,
  mustChangePassword: Boolean(admin.mustChangePassword), lastLoginAt: admin.lastLoginAt ?? null,
  // The console shows the undertaking while this is true; `confidentialityEnforced` says the API also refuses data (never for owners).
  mustAcceptConfidentiality: mustAcceptConfidentiality(admin), confidentialityEnforced: confidentialityEnforced(admin),
  confidentiality: confidentialitySummary(admin), confidentialityVersion: CONFIDENTIALITY_VERSION,
});

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
  if (admin.status === 'suspended') throw new HttpError(403, 'This account is suspended. Ask an owner to restore access.');
  byEmail.delete(email);
  const token = randomBytes(32).toString('hex');
  const code = generateCode();
  const now = new Date();
  const challenges = await collection(COLLECTIONS.adminLoginChallenges);
  await challenges.insertOne({
    _id: challengeId(token), adminId: admin._id, email: admin.email, passwordVersion: passwordVersion(admin.passwordHash),
    codeHash: hashCode('admin-login', token, code), attempts: 0, sends: 1,
    expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000), resendAt: new Date(now.getTime() + OTP_RESEND_SECONDS * 1000),
  });
  try { await sendCode(request, admin, code); }
  catch (error) { await challenges.deleteOne({ _id: challengeId(token) }); throw error; }
  response.json({ challenge: token, email: maskIdentifier('email', admin.email), expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS,
    ...(exposesDevCode('email') ? { devCode: code } : {}) });
});

adminAuthRouter.post('/login/resend', async (request, response) => {
  const { challenge: token } = readChallenge(request.body, challengeFields);
  const challenges = await collection(COLLECTIONS.adminLoginChallenges);
  const id = challengeId(token);
  const current = await challenges.findOne({ _id: id });
  if (!current || current.expiresAt <= new Date()) throw invalidChallenge();
  const now = new Date();
  if (current.resendAt > now) {
    throw new HttpError(429, `Please wait ${Math.ceil((current.resendAt - now) / 1000)} seconds before requesting another code.`, { retryAfterSeconds: Math.ceil((current.resendAt - now) / 1000) });
  }
  if (current.sends >= 5) throw new HttpError(429, 'Too many sign-in codes requested. Sign in again later.');
  const admins = await collection(COLLECTIONS.admins);
  const admin = await admins.findOne({ _id: current.adminId, email: current.email, role: { $in: ['admin', 'employee'] }, status: { $ne: 'suspended' } });
  if (!admin || passwordVersion(admin.passwordHash) !== current.passwordVersion) throw invalidChallenge();
  let code = generateCode();
  while (hashCode('admin-login', token, code) === current.codeHash) code = generateCode();
  const updated = await challenges.findOneAndUpdate(
    { _id: id, expiresAt: { $gt: now }, resendAt: { $lte: now }, sends: { $lt: 5 } },
    { $set: { codeHash: hashCode('admin-login', token, code), resendAt: new Date(now.getTime() + OTP_RESEND_SECONDS * 1000) }, $inc: { sends: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw invalidChallenge();
  try { await sendCode(request, admin, code); }
  catch (error) { await challenges.deleteOne({ _id: id }); throw error; }
  response.json({ ok: true, expiresInSeconds: Math.max(1, Math.ceil((updated.expiresAt - now) / 1000)), resendInSeconds: OTP_RESEND_SECONDS,
    ...(exposesDevCode('email') ? { devCode: code } : {}) });
});

adminAuthRouter.post('/login/verify', async (request, response) => {
  const { challenge: token, code } = readChallenge(request.body, verifyFields);
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.', { fields: { code: 'Enter the 6-digit code' } });
  const challenges = await collection(COLLECTIONS.adminLoginChallenges);
  const record = await challenges.findOne({ _id: challengeId(token) });
  if (!record || record.expiresAt <= new Date()) throw invalidChallenge();
  if (!codeMatches(record.codeHash, 'admin-login', token, code)) {
    const updated = await challenges.findOneAndUpdate({ _id: record._id, codeHash: record.codeHash }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
    if (!updated) throw invalidChallenge();
    const left = OTP_MAX_ATTEMPTS - updated.attempts;
    if (left <= 0) {
      await challenges.deleteOne({ _id: record._id });
      throw new HttpError(429, 'Too many incorrect codes. Sign in again.');
    }
    throw new HttpError(400, `Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
  }
  const admins = await collection(COLLECTIONS.admins);
  const admin = await admins.findOne({ _id: record.adminId, email: record.email, role: { $in: ['admin', 'employee'] }, status: { $ne: 'suspended' } });
  if (!admin || passwordVersion(admin.passwordHash) !== record.passwordVersion) throw invalidChallenge();
  if (!await challenges.findOneAndDelete({ _id: record._id, codeHash: record.codeHash, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } })) throw invalidChallenge();
  const lastLoginAt = new Date();
  const [signedIn] = await Promise.all([
    attachAccess({ ...admin, passwordHash: undefined, lastLoginAt }),
    admins.updateOne({ _id: admin._id }, { $set: { lastLoginAt } }),
  ]);
  response.cookie(ADMIN_COOKIE, signSession(admin._id.toString(), 'admin', ADMIN_SESSION_SECONDS), adminCookieOptions());
  response.json({ admin: serializeAdmin(signedIn) });
});

// The login screen can ask whether a session is present before displaying its form.
adminAuthRouter.get('/session', optionalAdmin, (request, response) => response.json({
  admin: request.admin ? serializeAdmin(request.admin) : null,
}));

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
  response.json({ admin: serializeAdmin(await attachAccess({ ...admin, passwordHash: undefined, mustChangePassword: false })) });
});

// The staff confidentiality undertaking: its current text, and the acceptance of exactly that version.
adminAuthRouter.get('/confidentiality', requireAdmin, (request, response) => response.json({
  ...confidentialityText(), accepted: confidentialitySummary(request.admin),
}));

adminAuthRouter.post('/confidentiality', requireAdmin, async (request, response) => {
  if (request.body?.agree !== true) throw new HttpError(400, 'Tick “I have read and agree” to accept the undertaking', { fields: { agree: 'Required' } });
  if (request.body?.version !== CONFIDENTIALITY_VERSION) {
    throw new HttpError(409, 'The undertaking was updated while you were reading it. Read the new version and accept again.', { version: CONFIDENTIALITY_VERSION });
  }
  const record = confidentialityRecord({ ip: request.ip, userAgent: request.get('user-agent') });
  await (await collection(COLLECTIONS.admins)).updateOne({ _id: request.admin._id }, { $set: { confidentiality: record } });
  await audit(request.admin, 'staff.confidentiality_accept', { type: 'staff', id: request.admin._id, label: request.admin.email }, { version: record.version, ip: record.ip });
  request.admin.confidentiality = record;
  response.json({ admin: serializeAdmin(request.admin) });
});

adminAuthRouter.post('/logout', (_request, response) => {
  clearAdminCookie(response);
  response.status(204).end();
});

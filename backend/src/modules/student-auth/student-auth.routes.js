import { Router } from 'express';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { STUDENT_COOKIE, STUDENT_SESSION_SECONDS, clearStudentCookie, studentCookieOptions } from '../../lib/cookies.js';
import { HttpError } from '../../lib/http-error.js';
import { signSession } from '../../lib/jwt.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { assertValid } from '../../lib/validation.js';
import { requireStudent } from '../../middleware/auth.js';
import { describeMailError } from '../../lib/mailer.js';
import {
  CHANNELS, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS,
  codeMatches, deliverOtp, enabledChannels, exposesDevCode, generateCode, hashCode, normalizeIdentifier, phoneEnabled,
} from './otp.js';

const WINDOW_MS = 15 * 60 * 1000;
const resendCooldown = createRateLimiter({ windowMs: OTP_RESEND_SECONDS * 1000, max: 1 });
const sendsPerIdentifier = createRateLimiter({ windowMs: WINDOW_MS, max: 5 });
const sendsPerIp = createRateLimiter({ windowMs: WINDOW_MS, max: 20 });

const channelField = { name: 'channel', type: 'select', options: CHANNELS, required: true };
const requestFields = [channelField, { name: 'identifier', type: 'string', required: true, maxLength: 320 }];
const verifyFields = [...requestFields, { name: 'code', type: 'string', required: true, maxLength: 6 }];
const profileFields = [{ name: 'name', type: 'string', required: true, minLength: 1, maxLength: 80 }];

export const serializeStudent = (student) => ({
  id: student._id.toString(),
  email: student.email ?? null,
  phone: student.phone ?? null,
  name: student.name ?? '',
  createdAt: student.createdAt ?? null,
});

function limit(limiter, key, message) {
  const result = limiter.hit(key);
  if (!result.allowed) {
    const text = typeof message === 'function' ? message(result.retryAfterSeconds) : message;
    throw new HttpError(429, text, { retryAfterSeconds: result.retryAfterSeconds });
  }
}

const PHONE_DISABLED = 'Sign-in with a mobile number is not available yet. Please use your email address.';

function readIdentity(fields, body) {
  const data = assertValid(fields, body);
  if (data.channel === 'phone' && !phoneEnabled()) throw new HttpError(400, PHONE_DISABLED, { fields: { channel: PHONE_DISABLED } });
  const identifier = normalizeIdentifier(data.channel, data.identifier);
  if (identifier.error) throw new HttpError(400, identifier.error, { fields: { identifier: identifier.error } });
  return { ...data, identifier: identifier.value };
}

async function findOrCreateStudent(channel, identifier, now) {
  const students = await collection(COLLECTIONS.students);
  const upsert = () => students.findOneAndUpdate(
    { [channel]: identifier },
    { $setOnInsert: { [channel]: identifier, name: '', status: 'active', createdAt: now, loginCount: 0 } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true },
  );
  let result;
  try { result = await upsert(); } catch (error) {
    if (error?.code !== 11000) throw error;
    result = await upsert(); // A concurrent first sign-in created the record.
  }
  return { student: result.value, isNew: !result.lastErrorObject?.updatedExisting };
}

export const studentAuthRouter = Router();
studentAuthRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

studentAuthRouter.post('/otp/request', async (request, response) => {
  const { channel, identifier } = readIdentity(requestFields, request.body);
  limit(sendsPerIp, request.ip, 'Too many code requests from this network. Please try again later.');
  const key = `${channel}:${identifier}`;
  limit(resendCooldown, key, (seconds) => `Please wait ${seconds} seconds before requesting another code.`);
  limit(sendsPerIdentifier, key, 'Too many codes requested. Please try again later.');
  const code = generateCode();
  const now = new Date();
  const codes = await collection(COLLECTIONS.otpCodes);
  await codes.replaceOne(
    { channel, identifier },
    { channel, identifier, codeHash: hashCode(channel, identifier, code), attempts: 0, expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000), createdAt: now },
    { upsert: true },
  );
  try {
    await deliverOtp({ channel, identifier, code });
  } catch (error) {
    await codes.deleteOne({ channel, identifier });
    // A failed send must not cost the student their resend slot.
    resendCooldown.delete(key);
    console.error(`[OTP] ${channel} delivery failed (request ${request.id}): ${describeMailError(error)}`);
    throw new HttpError(503, "We couldn't send the code right now. Please try again in a minute.");
  }
  response.json({
    ok: true, channel, identifier, expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS,
    ...(exposesDevCode(channel) ? { devCode: code } : {}),
  });
});

studentAuthRouter.get('/config', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=300');
  response.json({ channels: enabledChannels(), otpTtlSeconds: OTP_TTL_SECONDS, resendSeconds: OTP_RESEND_SECONDS });
});

studentAuthRouter.post('/otp/verify', async (request, response) => {
  const { channel, identifier, code } = readIdentity(verifyFields, request.body);
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.', { fields: { code: 'Enter the 6-digit code' } });
  const codes = await collection(COLLECTIONS.otpCodes);
  const now = new Date();
  const expired = new HttpError(400, 'This code has expired. Request a new one.');
  const record = await codes.findOne({ channel, identifier });
  if (!record || record.expiresAt <= now) {
    if (record) await codes.deleteOne({ _id: record._id });
    throw expired;
  }
  if (!codeMatches(record.codeHash, channel, identifier, code)) {
    const updated = await codes.findOneAndUpdate({ _id: record._id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
    if (!updated) throw expired;
    const left = OTP_MAX_ATTEMPTS - updated.attempts;
    if (left <= 0) {
      await codes.deleteOne({ _id: record._id });
      throw new HttpError(429, 'Too many incorrect attempts. Request a new code.');
    }
    throw new HttpError(400, `Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
  }
  // Deleting by hash makes each code single-use even under concurrent requests.
  if (!await codes.findOneAndDelete({ _id: record._id, codeHash: record.codeHash })) throw expired;

  const { student, isNew } = await findOrCreateStudent(channel, identifier, now);
  if (student.status === 'blocked') throw new HttpError(403, 'This account is suspended. Please contact support.');
  const signedIn = await (await collection(COLLECTIONS.students)).findOneAndUpdate(
    { _id: student._id },
    { $set: { lastLoginAt: now }, $inc: { loginCount: 1 } },
    { returnDocument: 'after' },
  );
  response.cookie(STUDENT_COOKIE, signSession(student._id.toString(), 'student', STUDENT_SESSION_SECONDS), studentCookieOptions());
  response.json({ student: serializeStudent(signedIn ?? student), isNew });
});

studentAuthRouter.get('/me', requireStudent, (request, response) => response.json({ student: serializeStudent(request.student) }));

studentAuthRouter.patch('/me', requireStudent, async (request, response) => {
  const { name } = assertValid(profileFields, request.body);
  const student = await (await collection(COLLECTIONS.students)).findOneAndUpdate(
    { _id: request.student._id },
    { $set: { name } },
    { returnDocument: 'after' },
  );
  if (!student) throw new HttpError(401, 'Not signed in');
  response.json({ student: serializeStudent(student) });
});

studentAuthRouter.post('/logout', (_request, response) => {
  clearStudentCookie(response);
  response.status(204).end();
});

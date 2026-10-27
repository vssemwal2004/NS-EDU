import { Router } from 'express';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { env } from '../../config/env.js';
import { STUDENT_COOKIE, STUDENT_SESSION_SECONDS, clearStudentCookie, studentCookieOptions } from '../../lib/cookies.js';
import { HttpError } from '../../lib/http-error.js';
import { signSession } from '../../lib/jwt.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { assertValid } from '../../lib/validation.js';
import { optionalStudent, requireStudent } from '../../middleware/auth.js';
import { describeMailError } from '../../lib/mailer.js';
import {
  CHANNELS, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS,
  codeMatches, deliverOtp, enabledChannels, exposesDevCode, generateCode, hashCode, normalizeIdentifier, phoneEnabled,
  refundSmsSlot, takeSmsSlot,
} from './otp.js';
import {
  FLOW_COOKIE, FLOW_COOKIE_PATH, FLOW_SECONDS, GoogleError, beginGoogleFlow, completeGoogleFlow, googleEnabled, readGoogleFlow,
} from './google.js';

const WINDOW_MS = 15 * 60 * 1000;
const resendCooldown = createRateLimiter({ windowMs: OTP_RESEND_SECONDS * 1000, max: 1 });
const sendsPerIdentifier = createRateLimiter({ windowMs: WINDOW_MS, max: 5 });
const sendsPerIp = createRateLimiter({ windowMs: WINDOW_MS, max: 20 });
// Generous enough for a classroom behind one school network; each callback costs a call to Google.
const googleStartsPerIp = createRateLimiter({ windowMs: WINDOW_MS, max: 60 });
const googleCallbacksPerIp = createRateLimiter({ windowMs: WINDOW_MS, max: 60 });

// The students indexes on email, phone and googleSub are partial ({ $type: 'string' }), and the
// planner only uses a partial index when the query repeats that predicate: a bare equality scans
// the whole collection.
export const studentBy = (field, value) => ({ [field]: { $eq: value, $type: 'string' } });

const channelField = { name: 'channel', type: 'select', options: CHANNELS, required: true };
const requestFields = [channelField, { name: 'identifier', type: 'string', required: true, maxLength: 320 }];
const verifyFields = [...requestFields, { name: 'code', type: 'string', required: true, maxLength: 6 }];
const profileFields = [{ name: 'name', type: 'string', required: true, minLength: 1, maxLength: 80 }];

// Derived from what the record holds, so it stays right for accounts created before linking existed.
const methodsOf = (student) => [student.googleSub && 'google', student.email && 'email', student.phone && 'phone'].filter(Boolean);

export const serializeStudent = (student) => ({
  id: student._id.toString(),
  email: student.email ?? null,
  phone: student.phone ?? null,
  name: student.name ?? '',
  picture: student.picture || null,
  methods: methodsOf(student),
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
const SMS_BUSY = 'Mobile codes are paused for today because of unusually high demand. Please use your email address, or try again tomorrow.';
const CHANNEL_NAMES = { email: 'email address', phone: 'mobile number' };

function readIdentity(fields, body) {
  const data = assertValid(fields, body);
  if (data.channel === 'phone' && !phoneEnabled()) throw new HttpError(400, PHONE_DISABLED, { fields: { channel: PHONE_DISABLED } });
  const identifier = normalizeIdentifier(data.channel, data.identifier);
  if (identifier.error) throw new HttpError(400, identifier.error, { fields: { identifier: identifier.error } });
  return { ...data, identifier: identifier.value };
}

// Shared by sign-in and linking: rate limits, SMS budget, store the hash, deliver.
async function issueCode(request, channel, identifier) {
  limit(sendsPerIp, request.ip, 'Too many code requests from this network. Please try again later.');
  const key = `${channel}:${identifier}`;
  limit(resendCooldown, key, (seconds) => `Please wait ${seconds} seconds before requesting another code.`);
  limit(sendsPerIdentifier, key, 'Too many codes requested. Please try again later.');
  if (channel === 'phone' && !takeSmsSlot()) {
    resendCooldown.delete(key);
    throw new HttpError(503, SMS_BUSY, { smsPaused: true });
  }
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
    // A failed send must not cost the student their resend slot (or the day's SMS budget).
    resendCooldown.delete(key);
    if (channel === 'phone') refundSmsSlot();
    console.error(`[OTP] ${channel} delivery failed (request ${request.id}): ${describeMailError(error)}`);
    throw new HttpError(503, "We couldn't send the code right now. Please try again in a minute.");
  }
  return {
    ok: true, channel, identifier, expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS,
    ...(exposesDevCode(channel) ? { devCode: code } : {}),
  };
}

// Throws unless `code` is the live code for this identifier; on success the code is spent.
async function consumeCode(channel, identifier, code) {
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.', { fields: { code: 'Enter the 6-digit code' } });
  const codes = await collection(COLLECTIONS.otpCodes);
  const expired = new HttpError(400, 'This code has expired. Request a new one.');
  const record = await codes.findOne({ channel, identifier });
  if (!record || record.expiresAt <= new Date()) {
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
}

async function findOrCreateStudent(channel, identifier, now) {
  const students = await collection(COLLECTIONS.students);
  const upsert = () => students.findOneAndUpdate(
    studentBy(channel, identifier),
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

const recordLogin = async (student, method, now, set = {}) => (await collection(COLLECTIONS.students)).findOneAndUpdate(
  { _id: student._id },
  { $set: { lastLoginAt: now, lastLoginMethod: method, ...set }, $inc: { loginCount: 1 }, $addToSet: { authMethods: method } },
  { returnDocument: 'after' },
);

const setSessionCookie = (response, student) => response.cookie(
  STUDENT_COOKIE, signSession(student._id.toString(), 'student', STUDENT_SESSION_SECONDS), studentCookieOptions(),
);

export const studentAuthRouter = Router();
studentAuthRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

studentAuthRouter.post('/otp/request', async (request, response) => {
  const { channel, identifier } = readIdentity(requestFields, request.body);
  response.json(await issueCode(request, channel, identifier));
});

studentAuthRouter.get('/config', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=300');
  response.json({ channels: enabledChannels(), google: googleEnabled(), otpTtlSeconds: OTP_TTL_SECONDS, resendSeconds: OTP_RESEND_SECONDS });
});

studentAuthRouter.post('/otp/verify', async (request, response) => {
  const { channel, identifier, code } = readIdentity(verifyFields, request.body);
  await consumeCode(channel, identifier, code);
  const now = new Date();
  const { student, isNew } = await findOrCreateStudent(channel, identifier, now);
  if (student.status === 'blocked') throw new HttpError(403, 'This account is suspended. Please contact support.');
  const signedIn = await recordLogin(student, channel, now);
  setSessionCookie(response, student);
  response.json({ student: serializeStudent(signedIn ?? student), isNew });
});

// Adding a missing email or mobile number to the signed-in account. Ownership is proven with the
// same one-time code as sign-in; a number that already has its own account is never merged.
studentAuthRouter.post('/link/otp/request', requireStudent, async (request, response) => {
  const { channel, identifier } = readIdentity(requestFields, request.body);
  if (request.student[channel]) throw new HttpError(400, `Your account already has a ${CHANNEL_NAMES[channel]}.`);
  response.json(await issueCode(request, channel, identifier));
});

studentAuthRouter.post('/link/otp/verify', requireStudent, async (request, response) => {
  const { channel, identifier, code } = readIdentity(verifyFields, request.body);
  if (request.student[channel]) throw new HttpError(400, `Your account already has a ${CHANNEL_NAMES[channel]}.`);
  await consumeCode(channel, identifier, code);
  const students = await collection(COLLECTIONS.students);
  const inUse = new HttpError(409, `This ${CHANNEL_NAMES[channel]} already belongs to another Gyaan Vidhya account. Log in with it instead.`);
  if (await students.findOne({ ...studentBy(channel, identifier), _id: { $ne: request.student._id } }, { projection: { _id: 1 } })) throw inUse;
  let student;
  try {
    student = await students.findOneAndUpdate(
      { _id: request.student._id, [channel]: { $in: [null, ''] } },
      { $set: { [channel]: identifier }, $addToSet: { authMethods: channel } },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (error?.code === 11000) throw inUse;
    throw error;
  }
  if (!student) throw new HttpError(400, `Your account already has a ${CHANNEL_NAMES[channel]}.`);
  response.json({ student: serializeStudent(student) });
});

// --- Continue with Google -------------------------------------------------------------------

// Same-origin paths only: "/x?y" yes; "//evil", "/\\evil", "https://…", "/login…", "/api/…" no.
export function safeReturnTo(raw, fallback = '/account') {
  const value = typeof raw === 'string' ? raw.trim() : '';
  // eslint-disable-next-line no-control-regex
  if (!value.startsWith('/') || value.startsWith('//') || value.length > 512 || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://gv.local');
    if (url.origin !== 'http://gv.local' || /^\/(login|api)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function withParams(path, params) {
  const url = new URL(path, 'http://gv.local');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

// Per process, like the rate limits: with several API instances a replay can land on another one,
// where the per-IP callback limit still bounds it.
const usedFlows = createTtlCache({ ttlMs: FLOW_SECONDS * 1000, maxEntries: 50_000 });
const flowCookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: FLOW_COOKIE_PATH });
// Linking errors land back on the page that started it (the account page); sign-in errors on /login.
const failureTarget = ({ returnTo, linking }, code) => (linking
  ? withParams(returnTo, { error: code })
  : withParams('/login', { error: code, ...(returnTo && { next: returnTo }) }));

studentAuthRouter.get('/google/start', optionalStudent, async (request, response) => {
  const returnTo = safeReturnTo(request.query.returnTo);
  const linking = request.query.link === '1';
  if (!googleEnabled()) return response.redirect(302, failureTarget({ returnTo, linking }, 'google-unavailable'));
  if (!googleStartsPerIp.hit(request.ip).allowed) return response.redirect(302, failureTarget({ returnTo, linking }, 'busy'));
  if (linking && !request.student) return response.redirect(302, withParams('/login', { next: returnTo }));
  const { url, cookie } = await beginGoogleFlow({ returnTo, studentId: linking ? request.student._id.toString() : null });
  response.cookie(FLOW_COOKIE, cookie, { ...flowCookieOptions(), maxAge: FLOW_SECONDS * 1000 });
  response.redirect(302, url);
});

async function signInWithGoogle(identity, now, attempt = 0) {
  const students = await collection(COLLECTIONS.students);
  const known = await students.findOne(studentBy('googleSub', identity.sub));
  if (known) return known;
  // Google has verified this address, so an account created by email code is the same person.
  const byEmail = await students.findOne(studentBy('email', identity.email));
  if (byEmail?.googleSub) throw new GoogleError('google-in-use', 'email belongs to an account linked to a different Google account');
  try {
    if (byEmail) {
      const linked = await students.findOneAndUpdate(
        { _id: byEmail._id, googleSub: { $exists: false } },
        { $set: { googleSub: identity.sub } },
        { returnDocument: 'after' },
      );
      if (linked) return linked;
    } else {
      const student = { email: identity.email, name: identity.name, picture: identity.picture || null, googleSub: identity.sub, status: 'active', createdAt: now, loginCount: 0 };
      const { insertedId } = await students.insertOne(student);
      return { ...student, _id: insertedId };
    }
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  // Lost a race with a concurrent sign-in for the same person: the record exists now.
  if (attempt > 0) throw new GoogleError('google-in-use', 'concurrent Google sign-in did not settle');
  return signInWithGoogle(identity, now, attempt + 1);
}

async function linkGoogle(studentId, identity) {
  const students = await collection(COLLECTIONS.students);
  const student = await students.findOne({ _id: studentId });
  if (!student) throw new GoogleError('state', 'linking student no longer exists');
  if (student.status === 'blocked') throw new GoogleError('blocked');
  if (student.googleSub === identity.sub) return student;
  if (student.googleSub) throw new GoogleError('google-other', 'account already linked to another Google account');
  const owner = await students.findOne({ _id: { $ne: student._id }, $or: [studentBy('googleSub', identity.sub), studentBy('email', identity.email)] }, { projection: { _id: 1 } });
  if (owner) throw new GoogleError('google-in-use', 'Google account or its email belongs to another student');
  const set = {
    googleSub: identity.sub,
    ...(!student.email && { email: identity.email }),
    ...(!student.name && identity.name && { name: identity.name }),
    ...(identity.picture && { picture: identity.picture }),
  };
  try {
    const linked = await students.findOneAndUpdate({ _id: student._id, googleSub: { $exists: false } }, { $set: set, $addToSet: { authMethods: 'google' } }, { returnDocument: 'after' });
    if (!linked) throw new GoogleError('google-other', 'account was linked concurrently');
    return linked;
  } catch (error) {
    if (error?.code === 11000) throw new GoogleError('google-in-use', 'unique index rejected the link');
    throw error;
  }
}

studentAuthRouter.get('/google/callback', optionalStudent, async (request, response) => {
  const flow = await readGoogleFlow(request.cookies?.[FLOW_COOKIE]);
  response.clearCookie(FLOW_COOKIE, flowCookieOptions());
  const fail = (code) => response.redirect(302, failureTarget({ returnTo: flow?.returnTo, linking: Boolean(flow?.studentId) }, code));
  const { code, state, error } = request.query;
  if (!googleCallbacksPerIp.hit(request.ip).allowed) return fail('busy');
  if (!flow || typeof state !== 'string' || state !== flow.state || usedFlows.get(flow.state)) return fail('state');
  // The flow cookie stays valid for its 10 minutes, so a kept copy could otherwise be replayed.
  usedFlows.set(flow.state, true);
  // Google sends error=access_denied (with our state) when the student backs out.
  if (error || typeof code !== 'string' || !code || code.length > 2048) return fail('cancelled');
  // The session that asked to link must still be the one signed in.
  if (flow.studentId && request.student?._id.toString() !== flow.studentId) return fail('state');

  try {
    const identity = await completeGoogleFlow({ code, flow });
    if (flow.studentId) {
      await linkGoogle(request.student._id, identity);
      return response.redirect(302, withParams(flow.returnTo, { linked: 'google' }));
    }
    const now = new Date();
    const student = await signInWithGoogle(identity, now);
    if (student.status === 'blocked') return fail('blocked');
    const signedIn = await recordLogin(student, 'google', now, {
      ...(identity.picture && { picture: identity.picture }),
      ...(!student.name && identity.name && { name: identity.name }),
    });
    setSessionCookie(response, student);
    const returnTo = flow.returnTo || '/account';
    // Google profiles can lack a name; the site then asks once, as after a code sign-in.
    response.redirect(302, (signedIn ?? student).name ? returnTo : withParams(returnTo, { welcome: 'name' }));
  } catch (failure) {
    if (!(failure instanceof GoogleError)) throw failure;
    if (failure.code === 'google-unavailable') console.error(`[Google] sign-in failed (request ${request.id}): ${failure.message}`);
    fail(failure.code);
  }
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

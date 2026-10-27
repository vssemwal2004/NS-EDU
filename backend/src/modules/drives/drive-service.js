import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { env, requireJwtSecret } from '../../config/env.js';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { escapeRegex, isPlainObject, slugify, validate } from '../../lib/validation.js';
import { INDIAN_STATES } from '../applications/schema.js';
import { applications, clearLeadCounts, leadKeys, nameTokensOf, nextRef } from '../applications/service.js';
import { choicesOf, defaultFields, parseAnswers, parseFields, publicField } from './form-fields.js';

export const leadForms = () => collection(COLLECTIONS.leadForms);

// Short codes are printed on posters and typed by hand: lowercase, no 0/o, 1/i/l lookalikes.
export const SHORT_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SHORT_CODE_PATTERN = /^[a-hjkmnp-z2-9]{8}$/;
const newShortCode = () => Array.from({ length: 8 }, () => SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)]).join('');
export const publicUrl = (shortCode) => `${env.publicSiteUrl}/r/${shortCode}`;

export const DRIVE_STATUSES = ['active', 'closed', 'archived'];
// Consent wording stored verbatim with every registration. The guardian line exists because most
// school students are minors (DPDP Act 2023: verifiable parental consent); have it reviewed by counsel.
export const DRIVE_CONSENT_VERSION = 'drive-2026-10';
export const DEFAULT_CONSENT_TEXT = 'I agree that Gyaan Vidhya’s admissions team may contact me by phone, SMS, WhatsApp or email about courses, universities and admission guidance.';
export const PRIVACY_TEXT = 'I confirm these details are correct and I have read Gyaan Vidhya’s Privacy policy.';
export const GUARDIAN_TEXT = 'I am 18 or older, or my parent or guardian knows about this registration and agrees to Gyaan Vidhya contacting us.';

// Public form definitions are read on every QR scan; admin writes clear the cache. Submits read the database.
const publicForms = createTtlCache({ ttlMs: 30_000, maxEntries: 2000 });
export const clearPublicForms = () => publicForms.clear();

const schoolFields = [
  { name: 'name', type: 'string', required: true, minLength: 2, maxLength: 150 },
  { name: 'district', type: 'string', required: true, minLength: 2, maxLength: 80 },
  { name: 'state', type: 'select', options: INDIAN_STATES, required: true },
  { name: 'city', type: 'string', maxLength: 80 },
];
const detailFields = [
  { name: 'title', type: 'string', maxLength: 150 },
  { name: 'campaign', type: 'string', maxLength: 120 },
  { name: 'notes', type: 'text', maxLength: 2000 },
  { name: 'consentText', type: 'text', minLength: 20, maxLength: 600 },
  { name: 'guardianConsent', type: 'boolean' },
  { name: 'maxSubmissions', type: 'integer', min: 1, max: 1_000_000, nullable: true },
  { name: 'status', type: 'select', options: DRIVE_STATUSES },
];

function parseSchool(input, errors) {
  const { value, errors: schoolErrors } = validate(schoolFields, isPlainObject(input) ? input : {});
  for (const [key, message] of Object.entries(schoolErrors)) errors[`school.${key}`] = message;
  return { ...value, districtKey: slugify(value.district ?? '') };
}
const defaultTitle = (school) => `Student registration — ${school.name}`;
const assertNoErrors = (errors) => {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
};

export function serializeDrive(doc) {
  return {
    id: doc._id.toString(),
    shortCode: doc.shortCode,
    publicUrl: publicUrl(doc.shortCode),
    title: doc.title,
    school: { name: doc.school?.name ?? '', district: doc.school?.district ?? '', state: doc.school?.state ?? '', city: doc.school?.city ?? '' },
    campaign: doc.campaign ?? '',
    notes: doc.notes ?? '',
    // Built-in choices (class, stream) are fixed lists, shown read-only in the builder by label.
    fields: (doc.fields ?? []).map((field) => ({
      id: field.id, label: field.label, type: field.type, required: field.required === true, help: field.help ?? '',
      enabled: field.enabled !== false, builtIn: field.builtIn === true,
      options: field.builtIn ? choicesOf(field).map((choice) => choice.label) : field.options ?? [],
    })),
    guardianConsent: doc.guardianConsent !== false,
    consentText: doc.consentText || DEFAULT_CONSENT_TEXT,
    consent: { version: DRIVE_CONSENT_VERSION, privacy: PRIVACY_TEXT, guardian: GUARDIAN_TEXT },
    maxSubmissions: doc.maxSubmissions ?? null,
    status: doc.status,
    closedReason: doc.status === 'closed' ? doc.closedReason ?? null : null,
    submissionCount: doc.submissionCount ?? 0,
    lastSubmissionAt: doc.lastSubmissionAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const LIST_PROJECTION = { shortCode: 1, title: 1, school: 1, campaign: 1, status: 1, submissionCount: 1, lastSubmissionAt: 1, maxSubmissions: 1, createdAt: 1, updatedAt: 1 };
const summary = (doc) => ({
  id: doc._id.toString(), shortCode: doc.shortCode, publicUrl: publicUrl(doc.shortCode), title: doc.title,
  school: { name: doc.school?.name ?? '', district: doc.school?.district ?? '', state: doc.school?.state ?? '', city: doc.school?.city ?? '' },
  campaign: doc.campaign ?? '', status: doc.status, submissionCount: doc.submissionCount ?? 0, maxSubmissions: doc.maxSubmissions ?? null,
  lastSubmissionAt: doc.lastSubmissionAt ?? null, createdAt: doc.createdAt,
});

/**
 * Drive list for the admin folder view. `groups` is the State → District tree for the search and status
 * filters (not the folder filter), so the tree stays whole while one folder is open; `counts` are per status.
 */
export async function listDrives(query) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 60, maxLimit: 100 });
  const base = {};
  const q = queryString(query.q, 100);
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    base.$or = [{ 'school.name': pattern }, { title: pattern }, { campaign: pattern }, { 'school.district': pattern }, { shortCode: q.toLowerCase() }];
  }
  const status = queryString(query.status, 20) || 'current';
  if (![...DRIVE_STATUSES, 'current', 'all'].includes(status)) throw new HttpError(400, 'Unknown status filter', { fields: { status: 'Choose a valid status' } });
  const statusFilter = status === 'all' ? {} : status === 'current' ? { status: { $in: ['active', 'closed'] } } : { status };
  const folder = {};
  const state = queryString(query.state, 80);
  if (state) {
    if (!INDIAN_STATES.includes(state)) throw new HttpError(400, 'Unknown state', { fields: { state: 'Choose a valid state' } });
    folder['school.state'] = state;
  }
  const district = slugify(queryString(query.district, 80));
  if (district) folder['school.districtKey'] = district;
  const forms = await leadForms();
  const filter = { ...base, ...statusFilter, ...folder };
  const [docs, total, statusRows, tree] = await Promise.all([
    forms.find(filter, { projection: LIST_PROJECTION }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    forms.countDocuments(filter),
    forms.aggregate([{ $match: { ...base, ...folder } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    forms.aggregate([
      { $match: { ...base, ...statusFilter } },
      { $group: { _id: { state: '$school.state', district: '$school.districtKey' }, district: { $first: '$school.district' }, drives: { $sum: 1 }, submissions: { $sum: { $ifNull: ['$submissionCount', 0] } } } },
      { $sort: { '_id.state': 1, district: 1 } },
    ]).toArray(),
  ]);
  const groups = new Map();
  for (const row of tree) {
    const group = groups.get(row._id.state) ?? { state: row._id.state, drives: 0, submissions: 0, districts: [] };
    group.drives += row.drives; group.submissions += row.submissions;
    group.districts.push({ district: row.district, key: row._id.district, drives: row.drives, submissions: row.submissions });
    groups.set(row._id.state, group);
  }
  const counts = Object.fromEntries(DRIVE_STATUSES.map((name) => [name, statusRows.find((row) => row._id === name)?.count ?? 0]));
  return { items: docs.map(summary), total, page, limit, counts, groups: [...groups.values()] };
}

export async function findDrive(id) {
  const _id = toObjectId(id);
  const doc = _id && await (await leadForms()).findOne({ _id });
  if (!doc) throw new HttpError(404, 'School drive not found');
  return doc;
}

export async function createDrive(body, admin) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const school = parseSchool(body.school, errors);
  const { value, errors: detailErrors } = validate(detailFields.filter((field) => ['title', 'campaign', 'notes'].includes(field.name)), body);
  Object.assign(errors, detailErrors);
  assertNoErrors(errors);
  const now = new Date();
  const doc = {
    title: value.title || defaultTitle(school), school, campaign: value.campaign ?? '', notes: value.notes ?? '',
    fields: defaultFields(), guardianConsent: true, consentText: DEFAULT_CONSENT_TEXT, maxSubmissions: null,
    status: 'active', submissionCount: 0, lastSubmissionAt: null, createdById: admin._id, createdAt: now, updatedAt: now,
  };
  const forms = await leadForms();
  // A collision in 31^8 codes is very unlikely; retry a few times rather than check first.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const fresh = { ...doc, shortCode: newShortCode() };
      await forms.insertOne(fresh);
      return serializeDrive(fresh);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new HttpError(503, 'Could not create a unique link. Please try again.');
}

/** Partial update. The short code (and so the link and QR) never changes; field ids stay stable. */
export async function updateDrive(id, body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const doc = await findDrive(id);
  const errors = {};
  const { value, errors: detailErrors } = validate(detailFields, body, { partial: true });
  Object.assign(errors, detailErrors);
  const set = { ...value };
  if (Object.hasOwn(body, 'school')) set.school = parseSchool(body.school, errors);
  if (set.title === '') set.title = defaultTitle(set.school ?? doc.school);
  if (set.consentText === '') set.consentText = DEFAULT_CONSENT_TEXT;
  if (Object.hasOwn(body, 'fields')) {
    try {
      set.fields = parseFields(body.fields, { existing: doc.fields ?? [], hasSubmissions: (doc.submissionCount ?? 0) > 0 });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      Object.assign(errors, error.details.fields);
    }
  }
  const max = Object.hasOwn(set, 'maxSubmissions') ? set.maxSubmissions : doc.maxSubmissions;
  if (set.status === 'active' && max && (doc.submissionCount ?? 0) >= max) errors.status = 'This drive reached its registration limit. Raise or clear the limit to reopen it.';
  assertNoErrors(errors);
  const now = new Date();
  if (set.status && set.status !== doc.status) Object.assign(set, { statusChangedAt: now, closedReason: null });
  // A limit lowered to (or below) the count closes the drive now, not when the next student taps Register.
  if ((set.status ?? doc.status) === 'active' && max && (doc.submissionCount ?? 0) >= max) Object.assign(set, { status: 'closed', closedReason: 'limit', statusChangedAt: now });
  set.updatedAt = now;
  const updated = await (await leadForms()).findOneAndUpdate({ _id: doc._id }, { $set: set }, { returnDocument: 'after' });
  clearPublicForms();
  return serializeDrive(updated);
}

/** Archives a drive (its link then says "Registration closed"); `permanent` deletes one that never had a registration. */
export async function removeDrive(id, { permanent = false } = {}) {
  const doc = await findDrive(id);
  const forms = await leadForms();
  clearPublicForms();
  if (permanent) {
    if ((doc.submissionCount ?? 0) > 0 || await (await applications()).findOne({ formId: doc._id }, { projection: { _id: 1 } })) {
      throw new HttpError(409, 'This drive has registrations, so it can only be archived.');
    }
    await forms.deleteOne({ _id: doc._id });
    return { deleted: true };
  }
  const now = new Date();
  const updated = await forms.findOneAndUpdate({ _id: doc._id }, { $set: { status: 'archived', statusChangedAt: now, updatedAt: now } }, { returnDocument: 'after' });
  return { deleted: false, item: serializeDrive(updated) };
}

const qrOptions = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } };
export async function driveQr(id, format, query = {}) {
  const doc = await findDrive(id);
  const url = publicUrl(doc.shortCode);
  const filename = `${slugify(doc.school?.name) || 'school-drive'}-${doc.shortCode}-qr.${format}`;
  if (format === 'svg') return { body: await QRCode.toString(url, { ...qrOptions, type: 'svg' }), type: 'image/svg+xml', filename };
  const requested = Number(queryString(query.size, 5) || 512);
  const size = Number.isInteger(requested) ? Math.min(2048, Math.max(256, requested)) : 512;
  return { body: await QRCode.toBuffer(url, { ...qrOptions, type: 'png', width: size }), type: 'image/png', filename };
}

// Form token: proves the submit follows a real page load and lets the server reject instant bot posts.
// Stateless (HMAC of form id + issue time), so any API instance can check it.
export const TOKEN_MIN_AGE_MS = 3000;
export const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const sign = (formId, issuedAt) => createHmac('sha256', requireJwtSecret()).update(`lead-form:${formId}:${issuedAt}`).digest('base64url');
export const formToken = (formId, issuedAt = Date.now()) => `${issuedAt}.${sign(String(formId), issuedAt)}`;

/** 'ok' | 'too-fast' | 'expired' | 'invalid' */
export function checkFormToken(token, formId, now = Date.now()) {
  const match = /^(\d{13})\.([\w-]{43})$/.exec(typeof token === 'string' ? token : '');
  if (!match) return 'invalid';
  const expected = Buffer.from(sign(String(formId), Number(match[1])));
  const actual = Buffer.from(match[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid';
  const age = now - Number(match[1]);
  if (age < TOKEN_MIN_AGE_MS) return 'too-fast';
  return age > TOKEN_MAX_AGE_MS ? 'expired' : 'ok';
}

const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'];
const utmFields = UTM_KEYS.map((name) => ({ name, type: 'string', maxLength: 100 }));
const consentFields = [
  { name: 'contact', type: 'boolean', default: false },
  { name: 'privacy', type: 'boolean', default: false },
  { name: 'guardian', type: 'boolean', default: false },
];

/** Validates a public submission against the drive's current questions; every error comes back together. */
export function parseSubmission(doc, body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const answers = parseAnswers(doc.fields ?? [], body.answers, errors);
  const { value: consent } = validate(consentFields, isPlainObject(body.consent) ? body.consent : {});
  if (consent.contact !== true) errors['consent.contact'] = 'Agree to be contacted so our team can guide you';
  if (consent.privacy !== true) errors['consent.privacy'] = 'Confirm your details and the privacy policy to register';
  if (doc.guardianConsent !== false && consent.guardian !== true) errors['consent.guardian'] = 'Ask a parent or guardian before you register';
  assertNoErrors(errors);
  // UTM tags are best-effort attribution: bad ones are dropped, never a reason to refuse a registration.
  const utm = isPlainObject(body.source) ? validate(utmFields, body.source) : { value: {}, errors: {} };
  const source = { path: `/r/${doc.shortCode}`, ...Object.fromEntries(UTM_KEYS.map((key) => [key, utm.errors[key] ? '' : utm.value[key] ?? ''])) };
  return { answers, source };
}

const isDuplicatePhone = (error) => error?.code === 11000 && (error.keyPattern?.formId || /one_phone_per_form/.test(error.message ?? ''));
const EARLIER_PROJECTION = { ref: 1, nameTokens: 1, 'applicant.fullName': 1 };
// The link is public, so a phone number alone must not reveal another student's reference (often a
// minor's): the earlier ref comes back only when the name shares a word with the first registration.
function repeatOf(earlier, applicant) {
  const stored = new Set(earlier.nameTokens?.length ? earlier.nameTokens : nameTokensOf(earlier.applicant?.fullName));
  return { ref: nameTokensOf(applicant.fullName).some((token) => stored.has(token)) ? earlier.ref : null, created: false };
}

/**
 * Stores one registration as a school-drive lead (see the lead contract in applications/service.js).
 * The unique { formId, phone } index makes a repeat registration return the first reference (see
 * repeatOf), even when two taps race. Returns { ref, created }.
 */
export async function createDriveLead(doc, { answers, source }, { ip = '', userAgent = '', now = new Date() } = {}) {
  const school = { name: doc.school.name, district: doc.school.district, districtKey: doc.school.districtKey, state: doc.school.state, city: doc.school.city ?? '' };
  const applicant = { fullName: answers.fullName, email: answers.email || '', phone: answers.phone, city: school.city, state: school.state };
  const custom = (doc.fields ?? []).filter((field) => !field.builtIn && field.enabled !== false);
  const leads = await applications();
  const sameStudent = { formId: doc._id, 'applicant.phone': applicant.phone, channel: 'school-drive' };
  // Re-scans are common in a school hall; answer from the index before spending a reference number.
  const earlier = await leads.findOne(sameStudent, { projection: EARLIER_PROJECTION });
  if (earlier) return repeatOf(earlier, applicant);
  const lead = {
    ref: await nextRef(now),
    channel: 'school-drive',
    mode: null,
    studentId: null,
    formId: doc._id,
    school,
    applicant,
    academics: answers.classLevel || answers.schoolStream ? { classLevel: answers.classLevel || '', schoolStream: answers.schoolStream || '' } : null,
    exams: [],
    preference: { institutionSlug: '', institutionName: '', city: '', state: '', courseSlug: '', courseName: '', programmeName: '', intakeYear: null },
    answers: custom.map((field) => ({ id: field.id, label: field.label, type: field.type, value: answers[field.id] ?? null })),
    careerField: null,
    callback: null,
    contactVerified: { email: false, phone: false },
    consent: {
      contactConsent: true, privacyAccepted: true, version: DRIVE_CONSENT_VERSION, at: now,
      text: { contact: doc.consentText || DEFAULT_CONSENT_TEXT, privacy: PRIVACY_TEXT, ...(doc.guardianConsent !== false && { guardian: GUARDIAN_TEXT }) },
      ...(doc.guardianConsent !== false && { guardianConsent: true }),
      ip, userAgent,
    },
    source,
    status: 'new',
    statusHistory: [{ status: 'new', at: now, byAdminId: null }],
    assignedEmployeeIds: [],
    createdAt: now,
    updatedAt: now,
    ...leadKeys(applicant),
  };
  try {
    await leads.insertOne(lead);
  } catch (error) {
    if (!isDuplicatePhone(error)) throw error;
    const existing = await leads.findOne(sameStudent, { projection: EARLIER_PROJECTION });
    if (!existing) throw error;
    return repeatOf(existing, applicant);
  }
  clearLeadCounts();
  const forms = await leadForms();
  const updated = await forms.findOneAndUpdate({ _id: doc._id }, { $inc: { submissionCount: 1 }, $set: { lastSubmissionAt: now } }, { returnDocument: 'after', projection: { submissionCount: 1, maxSubmissions: 1 } });
  if (updated?.maxSubmissions && updated.submissionCount >= updated.maxSubmissions) await closeAtLimit(doc._id, now);
  return { ref: lead.ref, created: true };
}

export async function closeAtLimit(formId, now = new Date()) {
  await (await leadForms()).updateOne({ _id: formId, status: 'active' }, { $set: { status: 'closed', closedReason: 'limit', statusChangedAt: now, updatedAt: now } });
  clearPublicForms();
}

/** Public definition by short code: `{ form }`, `{ closed }` or null; cached briefly (submits re-read the database). */
export function publicForm(code) {
  return publicForms.wrap(code, async () => {
    const doc = await (await leadForms()).findOne({ shortCode: code });
    if (!doc) return null;
    const school = { name: doc.school?.name ?? '', district: doc.school?.district ?? '', state: doc.school?.state ?? '', city: doc.school?.city ?? '' };
    const full = doc.maxSubmissions && (doc.submissionCount ?? 0) >= doc.maxSubmissions;
    if (doc.status !== 'active' || full) return { id: doc._id.toString(), closed: { title: doc.title, school } };
    return {
      id: doc._id.toString(),
      form: {
        code: doc.shortCode, title: doc.title, school,
        fields: (doc.fields ?? []).filter((field) => field.enabled !== false).map(publicField),
        consent: { version: DRIVE_CONSENT_VERSION, contact: doc.consentText || DEFAULT_CONSENT_TEXT, privacy: PRIVACY_TEXT, guardian: doc.guardianConsent === false ? null : GUARDIAN_TEXT },
      },
    };
  });
}

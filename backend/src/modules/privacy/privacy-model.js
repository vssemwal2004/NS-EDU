// Privacy requests (DPDP Act 2023 ss. 11-14: access, correction/erasure, grievance, nomination, and
// withdrawal of consent under s. 6(4)). Pure helpers: vocabularies, request parsing, reference numbers,
// due dates and the anonymisation update. The database side is privacy-service.js.
import { HttpError } from '../../lib/http-error.js';
import { isPlainObject, validate } from '../../lib/validation.js';
import { indianMobile } from './guardian.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

// One constant for the promised response time. The DPDP Rules 2025 let a Data Fiduciary publish its own
// grievance period up to a statutory ceiling; ours is deliberately shorter. Change only here.
export const PRIVACY_SLA_DAYS = 30;
export const PRIVACY_TARGET_DAYS = 7;
export const RESPONSE_TIME_TEXT = `within ${PRIVACY_SLA_DAYS} days at most; we aim for ${PRIVACY_TARGET_DAYS}`;

export const REQUEST_TYPES = [
  { value: 'access', label: 'Copy of my data' },
  { value: 'correction', label: 'Correct my details' },
  { value: 'erasure', label: 'Erase my data / delete account' },
  { value: 'withdraw-consent', label: 'Withdraw consent (stop calls and messages)' },
  { value: 'nominate', label: 'Nominate a person' },
  { value: 'grievance', label: 'Complaint or grievance' },
];
export const REQUEST_TYPE_VALUES = REQUEST_TYPES.map((item) => item.value);
export const RELATIONSHIPS = [
  { value: 'self', label: 'Myself' },
  { value: 'parent-guardian', label: 'Parent or guardian of the student' },
  { value: 'nominee', label: 'Nominee of the person' },
];
export const REQUEST_STATUSES = ['new', 'in-progress', 'done', 'rejected'];
export const OPEN_STATUSES = ['new', 'in-progress'];
// What a signed-in student can file from /account/my-data (access is a self-service download there,
// and withdrawal applies at once, so neither needs a form).
export const ACCOUNT_REQUEST_TYPES = ['correction', 'erasure', 'nominate', 'grievance'];
// Types whose free-text details are needed to act on them.
const DETAILS_REQUIRED = ['correction', 'nominate', 'grievance'];

export const ERASED_NAME = 'Erased person';
export const ERASED_TEXT = '[erased]';

/** PR-<year>-<6 digits>. */
export const formatPrivacyRef = (year, seq) => `PR-${year}-${String(seq).padStart(6, '0')}`;
export const PRIVACY_REF_PATTERN = /^PR-\d{4}-\d{6,}$/;
/** The India-time year a request is filed in (the counter key). */
export const refYear = (now = new Date()) => new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear();

export const dueDateOf = (createdAt, days = PRIVACY_SLA_DAYS) => new Date(new Date(createdAt).getTime() + days * DAY_MS);
export const isOverdue = (request, now = new Date()) => OPEN_STATUSES.includes(request.status) && new Date(request.dueAt) < now;

const fail = (errors) => {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
};

const publicFields = [
  { name: 'name', type: 'string', required: true, minLength: 2, maxLength: 100 },
  { name: 'email', type: 'email' },
  { name: 'phone', type: 'string', maxLength: 20 },
  { name: 'relationship', type: 'select', options: RELATIONSHIPS.map((item) => item.value), required: true },
  { name: 'type', type: 'select', options: REQUEST_TYPE_VALUES, required: true },
  { name: 'studentName', type: 'string', maxLength: 100 },
  { name: 'details', type: 'text', maxLength: 2000 },
];

/** The public /privacy-request form: a name, an email or mobile to reply to, who they are, what they want. */
export function parsePublicRequest(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const { value, errors } = validate(publicFields, body);
  if (value.phone) {
    const phone = indianMobile(value.phone);
    if (phone) value.phone = phone; else errors.phone = 'Enter a valid 10-digit Indian mobile number';
  }
  if (!value.email && !value.phone && !errors.email && !errors.phone) errors.email = 'Give an email address or a mobile number so we can reply';
  if (value.relationship && value.relationship !== 'self' && !value.studentName) errors.studentName = 'Enter the name of the person the request is about';
  if (DETAILS_REQUIRED.includes(value.type) && (value.details ?? '').length < 10) errors.details = 'Tell us a little more (at least 10 characters)';
  fail(errors);
  return {
    type: value.type,
    requester: { name: value.name, email: value.email ?? '', phone: value.phone ?? '', relationship: value.relationship },
    subjectName: value.relationship === 'self' ? value.name : value.studentName,
    details: value.details ?? '',
  };
}

/** A request filed from /account/my-data. Erasure must be confirmed by typing DELETE. */
export function parseAccountRequest(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const type = typeof body.type === 'string' ? body.type : '';
  if (!ACCOUNT_REQUEST_TYPES.includes(type)) errors.type = 'Choose a valid request type';
  const { value, errors: textErrors } = validate([{ name: 'details', type: 'text', maxLength: 2000 }], body);
  Object.assign(errors, textErrors);
  const details = value.details ?? '';
  if (DETAILS_REQUIRED.includes(type) && details.length < 10 && !errors.details) {
    errors.details = type === 'correction' ? 'Tell us what is wrong and what it should say' : 'Tell us a little more (at least 10 characters)';
  }
  if (type === 'erasure' && (typeof body.confirm !== 'string' || body.confirm.trim() !== 'DELETE')) errors.confirm = 'Type DELETE to confirm';
  fail(errors);
  return { type, details };
}

/** Staff resolution: in progress, or done / rejected with a reason the requester can be told. */
export function parseResolution(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const status = typeof body.status === 'string' ? body.status : '';
  if (!REQUEST_STATUSES.includes(status) || status === 'new') errors.status = 'Choose in progress, done or rejected';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
  if ((status === 'done' || status === 'rejected') && reason.length < 3) errors.reason = 'Give the reason or what was done';
  fail(errors);
  return { status, reason };
}

/**
 * The update that anonymises one lead for an erasure request: personal fields become tombstones, the
 * non-personal facts (channel, status, dates, course, institution, city/state, class, CRM numbers) stay
 * so reports still add up. The phone tombstone is unique per lead because of the one-phone-per-drive index.
 */
export function anonymiseLeadUpdate(lead, { now = new Date(), requestRef = '' } = {}) {
  const id = String(lead._id);
  const answers = (lead.answers ?? []).map((answer) => ({ ...answer, value: null }));
  return {
    $set: {
      'applicant.fullName': ERASED_NAME,
      'applicant.email': '',
      'applicant.phone': `erased-${id}`,
      'applicant.dateOfBirth': '',
      'applicant.pincode': '',
      'applicant.guardianName': '',
      'applicant.guardianPhone': '',
      nameTokens: [],
      answers,
      ...(lead.guardian ? { guardian: { name: ERASED_TEXT, phone: '', consentAt: lead.guardian.consentAt ?? null, consentVersion: lead.guardian.consentVersion ?? '', consentText: ERASED_TEXT } } : {}),
      ...(lead.callback ? { 'callback.message': '' } : {}),
      ...(lead.preference ? { 'preference.message': '' } : {}),
      'consent.ip': '',
      'consent.userAgent': '',
      contactConsent: { withdrawnAt: lead.contactConsent?.withdrawnAt ?? now, via: lead.contactConsent?.via ?? 'erasure', requestRef: lead.contactConsent?.requestRef ?? requestRef },
      studentId: null,
      erasure: { at: now, requestRef },
      updatedAt: now,
    },
  };
}

// Stages that mean the team has taken the student's application to the institution. There is no separate
// sharing log yet, so the first time a lead entered one of these stages stands in for "shared on".
const SHARED_STAGES = ['applied-to-university', 'admitted'];

/**
 * Who a lead's data has gone to (DPDP s. 11 summary), for the student's My data page:
 * { state: 'shared' | 'may-share' | 'team', institution, since }.
 */
export function sharedWithOf(lead) {
  const institution = lead.preference?.institutionName || '';
  const entry = (lead.statusHistory ?? []).find((item) => SHARED_STAGES.includes(item.status));
  const reached = entry || SHARED_STAGES.includes(lead.status);
  if (institution && reached) return { state: 'shared', institution, since: entry?.at ?? null };
  if (institution) return { state: 'may-share', institution, since: null };
  return { state: 'team', institution: '', since: null };
}

/** The flag that stops calls, SMS and WhatsApp on a lead (shown as "Do not contact" to staff). */
export const withdrawUpdate = ({ now = new Date(), via, requestRef = '' }) => ({ $set: { contactConsent: { withdrawnAt: now, via, requestRef }, updatedAt: now } });

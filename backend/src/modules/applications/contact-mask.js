// Phone and email masking for the staff console.
//
// Staff see a lead's full phone numbers and email addresses only when the lead is assigned to them, or when they
// hold `leads.contact_reveal_all` (owners hold every permission). Everyone else who can see the lead (team or
// all scope) gets masked values ("+91 98XXXXXX10", "a***@gmail.com") and can reveal one lead at a time through
// POST /api/admin/leads/:id/reveal-contact, which is rate-limited and written to the activity log.
//
// Masking is by key name, so contact fields added later (guardian phone, parent email, ...) are covered without
// a change here. No database access: everything below is unit-tested without MongoDB.
import { isOwnerStaff } from './scope.js';

export const REVEAL_ALL_PERMISSION = 'leads.contact_reveal_all';
const PHONE_KEY = /phone|mobile|whatsapp/i;
const EMAIL_KEY = /e-?mail/i;
const CONTACT_ANSWER_TYPES = new Set(['phone', 'email', 'tel']);

/** "+919876543210" → "+91 98XXXXXX10"; "9876543210" → "98XXXXXX10". Short or odd values are fully hidden. */
export function maskPhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return 'XXXX';
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const country = digits.length > 10 ? digits.slice(0, -10) : '';
  const masked = `${local.slice(0, 2)}${'X'.repeat(local.length - 4)}${local.slice(-2)}`;
  return country ? `+${country} ${masked}` : masked;
}

/** "asha.rao@gmail.com" → "a***@gmail.com". Text without a usable "@" is fully hidden. */
export function maskEmail(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const at = raw.lastIndexOf('@');
  if (at < 1 || at === raw.length - 1) return '***';
  return `${raw[0]}***@${raw.slice(at + 1)}`;
}

/** True for a value produced by maskPhone or maskEmail (used to ignore masked values sent back in edits). */
export const isMaskedContact = (value) => typeof value === 'string' && (/\d{2}X{2,}\d{2}$|^XXXX$/.test(value) || value.includes('***'));

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(typeof value.toHexString === 'function');
const maskValue = (key, value) => {
  if (typeof value !== 'string' || !value) return value;
  if (PHONE_KEY.test(key)) return maskPhone(value);
  if (EMAIL_KEY.test(key)) return maskEmail(value);
  return value;
};

/** A copy of `object` with every phone/email-named string masked, one nested level deep (e.g. `guardian.phone`). */
export function maskContactObject(object, depth = 0) {
  if (!isPlainObject(object)) return object;
  return Object.fromEntries(Object.entries(object).map(([key, value]) => {
    if (isPlainObject(value) && depth < 1) return [key, maskContactObject(value, depth + 1)];
    return [key, maskValue(key, value)];
  }));
}

const isContactAnswer = (answer) => CONTACT_ANSWER_TYPES.has(answer?.type) || PHONE_KEY.test(answer?.id ?? '') || EMAIL_KEY.test(answer?.id ?? '');
const maskAnswerValue = (answer, value) => {
  const asPhone = answer.type === 'phone' || answer.type === 'tel' || PHONE_KEY.test(answer.id ?? '');
  const one = (item) => (typeof item === 'string' && item ? (asPhone ? maskPhone(item) : maskEmail(item)) : item);
  return Array.isArray(value) ? value.map(one) : one(value);
};

/** School-drive answers: phone and email questions are masked like the applicant's own fields. */
export function maskAnswers(answers) {
  if (!Array.isArray(answers)) return answers;
  return answers.map((answer) => (isContactAnswer(answer) ? { ...answer, value: maskAnswerValue(answer, answer.value) } : answer));
}

/** Whether `staff` may see this lead's contact details unmasked. Missing staff fails closed (masked). */
export function canSeeFullContact(staff, assignedEmployeeIds = []) {
  if (!staff) return false;
  if (isOwnerStaff(staff) || staff.permissions?.includes(REVEAL_ALL_PERMISSION)) return true;
  if (!staff._id) return false;
  const me = String(staff._id);
  return (assignedEmployeeIds ?? []).some((id) => String(id) === me);
}

/** Holds the permission that shows every lead's contact details (no per-lead check needed). */
export const canRevealAll = (staff) => Boolean(staff && (isOwnerStaff(staff) || staff.permissions?.includes(REVEAL_ALL_PERMISSION)));

/**
 * The lead as `staff` may see it: unchanged for their own leads (or with the permission), otherwise a copy
 * with the applicant's, guardian's and form answers' phone and email masked and `contactMasked: true`.
 */
export function maskLeadContact(doc, staff) {
  if (!doc || canSeeFullContact(staff, doc.assignedEmployeeIds)) return doc;
  const out = { ...doc, contactMasked: true };
  if (doc.applicant) out.applicant = maskContactObject(doc.applicant);
  if (doc.guardian) out.guardian = maskContactObject(doc.guardian);
  if (doc.callback) out.callback = maskContactObject(doc.callback);
  if (doc.answers) out.answers = maskAnswers(doc.answers);
  return out;
}

const pickContact = (object, depth = 0) => {
  if (!isPlainObject(object)) return undefined;
  const entries = Object.entries(object).flatMap(([key, value]) => {
    if (isPlainObject(value) && depth < 1) { const inner = pickContact(value, depth + 1); return inner && Object.keys(inner).length ? [[key, inner]] : []; }
    return typeof value === 'string' && value && (PHONE_KEY.test(key) || EMAIL_KEY.test(key)) ? [[key, value]] : [];
  });
  return Object.fromEntries(entries);
};

/** Only the contact fields of a lead, unmasked: the body of a successful reveal. */
export function revealedContact(doc) {
  return {
    applicant: pickContact(doc?.applicant) ?? {},
    ...(isPlainObject(doc?.guardian) && { guardian: pickContact(doc.guardian) }),
    answers: (doc?.answers ?? []).filter(isContactAnswer).map((answer) => ({ id: answer.id, value: answer.value })),
  };
}

/** Drops phone/email values that are still masked from an edit body, so saving a masked form never overwrites real data. */
export function stripMaskedContact(body) {
  if (!isPlainObject(body)) return body;
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => !((PHONE_KEY.test(key) || EMAIL_KEY.test(key)) && isMaskedContact(value))));
}

import { activeFilter, collection, COLLECTIONS } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { isPlainObject, validate } from '../../lib/validation.js';
import { normalizeIdentifier } from '../student-auth/otp.js';
import { applicationNotes, applications, clearLeadCounts, DAY, leadKeys, nextRef } from '../applications/service.js';

export const CALLBACK_TIMES = [
  { value: 'morning', label: 'Morning (9 am–12 pm)' },
  { value: 'afternoon', label: 'Afternoon (12–4 pm)' },
  { value: 'evening', label: 'Evening (4–8 pm)' },
  { value: 'any', label: 'Any time' },
];
// Stored verbatim with every callback lead. The page shows this text from GET /fields, so the
// wording a student agreed to and the wording on record are always the same string.
export const CALLBACK_CONSENT_VERSION = '2026-10';
export const CALLBACK_CONSENT_TEXT = 'I agree that Gyaan Vidhya’s counsellors may call, SMS or WhatsApp me on this number about career guidance, and I have read the Privacy policy.';

// Spam ceilings that answer "ok" without creating a lead, so the endpoint never reveals which numbers asked before.
const PER_PHONE_PER_DAY = 5;

// Fields and counsellors change rarely and every career-guidance view reads them: cache the whole
// directory (phones included) and strip contacts per request. Admin writes clear it.
const directoryCache = createTtlCache({ ttlMs: 60_000, maxEntries: 1 });
export const invalidateCareerCache = () => directoryCache.clear();

async function loadDirectory() {
  const fields = await (await collection(COLLECTIONS.careerFields)).find(activeFilter).sort({ order: 1, name: 1, _id: 1 }).toArray();
  const counsellors = fields.length
    ? await (await collection(COLLECTIONS.counsellors)).find({ ...activeFilter, fieldSlug: { $in: fields.map((field) => field.slug) } })
      .sort({ isMaster: -1, order: 1, name: 1, _id: 1 }).toArray()
    : [];
  return fields.map((field) => ({ field, counsellors: counsellors.filter((person) => person.fieldSlug === field.slug) }));
}
export const careerDirectory = () => directoryCache.wrap('all', loadDirectory);

// Built field by field so a phone number can only appear when `withContacts` asks for it.
function publicCounsellor(person, withContacts) {
  return {
    id: person._id.toString(),
    name: person.name,
    title: person.title ?? '',
    photoUrl: person.photoUrl ?? '',
    languages: person.languages ?? [],
    availability: person.availability ?? '',
    isMaster: person.isMaster === true,
    ...(withContacts ? { phone: person.phone ?? '', whatsapp: person.whatsapp ?? '' } : {}),
  };
}

export async function publicDirectory({ withContacts }) {
  const directory = await careerDirectory();
  return {
    items: directory.map(({ field, counsellors }) => ({
      slug: field.slug, name: field.name, description: field.description ?? '', icon: field.icon || 'compass',
      counsellors: counsellors.map((person) => publicCounsellor(person, withContacts)),
    })),
    contacts: withContacts,
    callback: { times: CALLBACK_TIMES, consent: { version: CALLBACK_CONSENT_VERSION, text: CALLBACK_CONSENT_TEXT } },
  };
}

const callbackFields = [
  { name: 'name', type: 'string', required: true, minLength: 2, maxLength: 100 },
  { name: 'phone', type: 'string', required: true, maxLength: 20 },
  { name: 'fieldSlug', type: 'slug', required: true, maxLength: 100 },
  { name: 'preferredTime', type: 'select', options: CALLBACK_TIMES.map((time) => time.value), default: 'any' },
  { name: 'message', type: 'text', maxLength: 500 },
  { name: 'consent', type: 'boolean', required: true },
  { name: 'consentVersion', type: 'string', maxLength: 20 },
];
const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'];
const utmFields = UTM_KEYS.map((name) => ({ name, type: 'string', maxLength: 100 }));

/** Validates a callback request; all field errors come back together. */
export async function parseCallback(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const { value, errors } = validate(callbackFields, body);
  if (value.phone) {
    const phone = normalizeIdentifier('phone', value.phone);
    if (phone.error) errors.phone = phone.error; else value.phone = phone.value;
  }
  if (value.consent !== true && !errors.consent) errors.consent = 'Agree to be contacted so a counsellor can call you';
  if (value.consentVersion && value.consentVersion !== CALLBACK_CONSENT_VERSION) errors.consent = 'The consent wording has changed. Reload the page and review it again.';
  const field = value.fieldSlug && !errors.fieldSlug ? (await careerDirectory()).find((entry) => entry.field.slug === value.fieldSlug)?.field : null;
  if (value.fieldSlug && !errors.fieldSlug && !field) errors.fieldSlug = 'Choose a career field from the list';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  // UTM tags are best-effort attribution: bad ones are dropped, never a reason to refuse a callback.
  const utm = isPlainObject(body.source) ? validate(utmFields, body.source) : { value: {}, errors: {} };
  const source = Object.fromEntries(UTM_KEYS.map((key) => [key, utm.errors[key] ? '' : utm.value[key] ?? '']));
  return { ...value, field, source };
}

// A repeat is folded into the earlier lead as an automatic note, so the counsellor still sees the newer question.
async function noteRepeat(lead, data, now) {
  const time = CALLBACK_TIMES.find((item) => item.value === data.preferredTime)?.label ?? data.preferredTime;
  const text = [`Asked again through the callback form: ${data.name}, ${time}.`, data.message && `Message: ${data.message}`].filter(Boolean).join('\n');
  await (await applicationNotes()).insertOne({ applicationId: lead._id, text, authorId: null, authorEmail: 'Callback form (automatic)', authorRole: 'system', createdAt: now });
  await (await applications()).updateOne({ _id: lead._id }, { $set: { updatedAt: now } });
  clearLeadCounts();
}

/**
 * Stores a callback request as a lead. A repeat on the same phone and field within 24 hours is added to the
 * earlier lead instead, and requests over the daily ceiling are dropped.
 *
 * Privacy: the reply must not reveal whether a phone number asked before. So a signed-in student is matched
 * only against their own requests and gets their own lead's reference; anonymous callers are matched only
 * against anonymous requests and never get a reference (sequential refs would date an earlier request).
 */
export async function createCallbackLead(data, { student = null, ip = '', userAgent = '', now = new Date() } = {}) {
  const leads = await applications();
  const owner = student?._id ?? null;
  const reply = (ref) => ({ ref: owner ? ref : null });
  const recent = await leads.find(
    { 'applicant.phone': data.phone, createdAt: { $gte: new Date(now.getTime() - DAY) }, channel: 'callback', studentId: owner },
    { projection: { ref: 1, careerField: 1 }, sort: { createdAt: -1 }, limit: PER_PHONE_PER_DAY },
  ).toArray();
  const same = recent.find((lead) => lead.careerField?.slug === data.field.slug);
  if (same) {
    await noteRepeat(same, data, now);
    return { ...reply(same.ref), created: false };
  }
  if (recent.length >= PER_PHONE_PER_DAY) return { ref: null, created: false };

  const applicant = { fullName: data.name, email: student?.email ?? '', phone: data.phone, city: '', state: '' };
  const doc = {
    ref: await nextRef(now),
    channel: 'callback',
    mode: null,
    studentId: student?._id ?? null,
    formId: null,
    school: null,
    applicant,
    academics: null,
    exams: [],
    preference: { institutionSlug: '', institutionName: '', city: '', state: '', courseSlug: '', courseName: '', programmeName: '', intakeYear: null },
    answers: [],
    careerField: { slug: data.field.slug, name: data.field.name },
    callback: { preferredTime: data.preferredTime, message: data.message },
    contactVerified: { email: Boolean(student?.email), phone: Boolean(student?.phone) && student.phone === data.phone },
    consent: {
      contactConsent: true, privacyAccepted: true, version: CALLBACK_CONSENT_VERSION, at: now,
      text: { contact: CALLBACK_CONSENT_TEXT }, ip, userAgent,
    },
    source: { path: '/career-guidance', ...data.source },
    status: 'new',
    statusHistory: [{ status: 'new', at: now, byAdminId: null }],
    assignedEmployeeIds: [],
    createdAt: now,
    updatedAt: now,
    ...leadKeys(applicant),
  };
  await leads.insertOne(doc);
  clearLeadCounts();
  return { ...reply(doc.ref), created: true };
}

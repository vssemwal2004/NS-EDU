// Privacy requests: storage, the student's own data (My data), and the staff queue's actions.
// Pure rules (parsing, refs, due dates, the anonymise update) live in privacy-model.js.
import { collection, COLLECTIONS, getDb, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { escapeRegex } from '../../lib/validation.js';
import { audit } from '../access/access-service.js';
import { applications, channelOf, clearLeadCounts, CHANNEL_LABELS, COUNTERS, statusLabel } from '../applications/service.js';
import {
  anonymiseLeadUpdate, dueDateOf, ERASED_NAME, ERASED_TEXT, formatPrivacyRef, isOverdue, OPEN_STATUSES, PRIVACY_REF_PATTERN, REQUEST_STATUSES,
  REQUEST_TYPE_VALUES, REQUEST_TYPES, RELATIONSHIPS, refYear, RESPONSE_TIME_TEXT, sharedWithOf, withdrawUpdate,
} from './privacy-model.js';

export const privacyRequests = () => collection(COLLECTIONS.privacyRequests);
const MAX_MATCHES = 50;
const typeLabel = (type) => REQUEST_TYPES.find((item) => item.value === type)?.label ?? type;
const relationshipLabel = (value) => RELATIONSHIPS.find((item) => item.value === value)?.label ?? value;

/** PR-<year>-<6 digits> from an atomic per-year counter (same pattern as lead references). */
export async function nextPrivacyRef(now = new Date()) {
  const year = refYear(now);
  const counter = await (await getDb()).collection(COUNTERS).findOneAndUpdate(
    { _id: `privacy-requests-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' },
  );
  return formatPrivacyRef(year, counter.seq);
}

/** Stores a request and returns it. `status` 'done' is used for things applied at once (withdrawal from an account). */
export async function createRequest({ type, source, requester, subjectName = '', details = '', studentId = null, ip = '', userAgent = '', status = 'new', note = '', now = new Date() }) {
  const doc = {
    ref: await nextPrivacyRef(now),
    type, source, status, requester, subjectName, details, studentId,
    ip, userAgent: String(userAgent ?? '').slice(0, 300),
    dueAt: dueDateOf(now),
    notes: note ? [{ text: note, at: now, byEmail: 'system' }] : [],
    history: [{ status, at: now, byEmail: source === 'account' ? 'student' : 'requester', reason: '' }],
    resolution: status === 'done' ? { status, reason: note, at: now, byEmail: 'system' } : null,
    actions: [],
    createdAt: now, updatedAt: now,
  };
  await (await privacyRequests()).insertOne(doc);
  return doc;
}

/** What the requester is told: the reference, when to expect an answer. */
export const receiptOf = (doc) => ({ ref: doc.ref, type: doc.type, typeLabel: typeLabel(doc.type), status: doc.status, createdAt: doc.createdAt, dueAt: doc.dueAt, responseTime: RESPONSE_TIME_TEXT });

// -----------------------------------------------------------------------------------------------
// The student's own data. Leads belong to an account through `studentId` only, the same rule as
// "My applications": leads that merely share a phone or email are never shown.

const LEAD_FIELDS = { ref: 1, channel: 1, mode: 1, status: 1, statusHistory: 1, createdAt: 1, updatedAt: 1, applicant: 1, guardian: 1, preference: 1, school: 1, careerField: 1, academics: 1, exams: 1, callback: 1, answers: 1, consent: 1, contactConsent: 1, source: 1 };

const studentLeads = async (studentId) => (await applications()).find({ studentId }, { projection: LEAD_FIELDS }).sort({ createdAt: -1 }).limit(200).toArray();

function serializeOwnLead(doc, { full = false } = {}) {
  const shared = sharedWithOf(doc);
  return {
    ref: doc.ref,
    channel: channelOf(doc),
    channelLabel: CHANNEL_LABELS[channelOf(doc)] ?? channelOf(doc),
    status: doc.status, statusLabel: statusLabel(doc.status),
    createdAt: doc.createdAt,
    about: doc.preference?.institutionName || doc.careerField?.name || doc.school?.name || '',
    course: doc.preference?.courseName || doc.preference?.programmeName || '',
    applicant: { fullName: doc.applicant?.fullName ?? '', email: doc.applicant?.email ?? '', phone: doc.applicant?.phone ?? '', city: doc.applicant?.city ?? '', state: doc.applicant?.state ?? '', isAdult: typeof doc.applicant?.isAdult === 'boolean' ? doc.applicant.isAdult : null },
    guardian: doc.guardian ? { name: doc.guardian.name ?? '', phone: doc.guardian.phone ?? '', consentAt: doc.guardian.consentAt ?? null } : null,
    consentAt: doc.consent?.at ?? null,
    contactWithdrawnAt: doc.contactConsent?.withdrawnAt ?? null,
    sharedWith: shared,
    ...(full ? {
      applicantDetails: doc.applicant ?? {},
      academics: doc.academics ?? null, exams: doc.exams ?? [],
      preference: doc.preference ?? {}, school: doc.school ?? null, careerField: doc.careerField ?? null, callback: doc.callback ?? null,
      answers: (doc.answers ?? []).map((answer) => ({ label: answer.label, value: answer.value })),
      consent: { version: doc.consent?.version ?? '', at: doc.consent?.at ?? null, text: doc.consent?.text ?? {}, guardianConsentText: doc.guardian?.consentText ?? '' },
      statusHistory: (doc.statusHistory ?? []).map((entry) => ({ status: entry.status, statusLabel: statusLabel(entry.status), at: entry.at })),
      source: { path: doc.source?.path ?? '' },
    } : {}),
  };
}

const serializeOwnRequest = (doc) => ({ ...receiptOf(doc), details: doc.details ?? '', resolution: doc.resolution ? { status: doc.resolution.status, reason: doc.resolution.reason, at: doc.resolution.at } : null });

const ownRequests = async (studentId) => (await privacyRequests()).find({ studentId }).sort({ createdAt: -1 }).limit(50).toArray();

const profileOf = (student) => ({
  name: student.name ?? '', email: student.email ?? null, phone: student.phone ?? null,
  createdAt: student.createdAt ?? null, lastLoginAt: student.lastLoginAt ?? null,
  signInMethods: [student.googleSub && 'google', student.email && 'email', student.phone && 'phone'].filter(Boolean),
  contactWithdrawnAt: student.contactConsent?.withdrawnAt ?? null,
});

export async function myData(student) {
  const [leads, requests] = await Promise.all([studentLeads(student._id), ownRequests(student._id)]);
  return {
    profile: profileOf(student),
    applications: leads.map((doc) => serializeOwnLead(doc)),
    requests: requests.map(serializeOwnRequest),
    responseTime: RESPONSE_TIME_TEXT,
  };
}

/** Everything held about the account, as one JSON document (the "Download my data" file). */
export async function exportMyData(student, now = new Date()) {
  const [leads, requests, reviews] = await Promise.all([
    studentLeads(student._id), ownRequests(student._id),
    (await collection(COLLECTIONS.reviews)).find({ studentId: student._id }, { projection: { _id: 0, studentId: 0, moderatedById: 0 } }).toArray(),
  ]);
  return {
    exportedAt: now,
    controller: 'Gyaan Vidhya (N.S. Education Society)',
    note: 'Your account, your applications and registrations, privacy requests and reviews as held on the export date. Staff notes about calls are kept for our records and are available on request.',
    profile: profileOf(student),
    applications: leads.map((doc) => serializeOwnLead(doc, { full: true })),
    privacyRequests: requests.map(serializeOwnRequest),
    reviews,
  };
}

/** Stop calls, SMS and WhatsApp on every lead of the account. Recorded as a done request with a reference. */
export async function withdrawForStudent(student, { ip = '', userAgent = '', now = new Date() } = {}) {
  const request = await createRequest({
    type: 'withdraw-consent', source: 'account', status: 'done', studentId: student._id, ip, userAgent, now,
    requester: { name: student.name ?? '', email: student.email ?? '', phone: student.phone ?? '', relationship: 'self' },
    subjectName: student.name ?? '', details: 'Withdrawn from My data: stop calls, SMS and WhatsApp.',
    note: 'Applied at once to every lead on the account.',
  });
  const { modifiedCount } = await (await applications()).updateMany(
    { studentId: student._id, 'contactConsent.withdrawnAt': { $exists: false } }, withdrawUpdate({ now, via: 'account', requestRef: request.ref }),
  );
  await (await collection(COLLECTIONS.students)).updateOne({ _id: student._id }, { $set: { contactConsent: { withdrawnAt: now, requestRef: request.ref } } });
  await (await privacyRequests()).updateOne({ _id: request._id }, { $push: { actions: { kind: 'stop-contact', at: now, byEmail: 'student', count: modifiedCount } } });
  clearLeadCounts();
  return { ...receiptOf(request), updated: modifiedCount };
}

// -----------------------------------------------------------------------------------------------
// Staff queue

const csv = (value) => String(value ?? '').slice(0, 200).split(',').map((item) => item.trim()).filter(Boolean);

function queueFilter(query, now) {
  const clauses = [];
  const statuses = csv(query.status).filter((value) => REQUEST_STATUSES.includes(value));
  if (statuses.length) clauses.push({ status: { $in: statuses } });
  const types = csv(query.type).filter((value) => REQUEST_TYPE_VALUES.includes(value));
  if (types.length) clauses.push({ type: { $in: types } });
  if (query.overdue === '1' || query.overdue === 'true') clauses.push({ status: { $in: OPEN_STATUSES }, dueAt: { $lt: now } });
  const q = String(query.q ?? '').trim().slice(0, 100);
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    clauses.push(PRIVACY_REF_PATTERN.test(q.toUpperCase()) ? { ref: q.toUpperCase() } : { $or: [{ ref: pattern }, { 'requester.name': pattern }, { 'requester.email': pattern }, { 'requester.phone': pattern }, { subjectName: pattern }] });
  }
  return clauses.length ? { $and: clauses } : {};
}

export function serializeRequest(doc, now = new Date()) {
  return {
    id: doc._id.toString(), ref: doc.ref, type: doc.type, typeLabel: typeLabel(doc.type), status: doc.status, source: doc.source,
    requester: { ...doc.requester, relationshipLabel: relationshipLabel(doc.requester?.relationship) },
    subjectName: doc.subjectName ?? '', details: doc.details ?? '', studentId: doc.studentId?.toString() ?? null,
    createdAt: doc.createdAt, updatedAt: doc.updatedAt, dueAt: doc.dueAt, overdue: isOverdue(doc, now),
    notes: doc.notes ?? [], history: doc.history ?? [], resolution: doc.resolution ?? null, actions: doc.actions ?? [],
  };
}

export async function listRequests(query = {}, now = new Date()) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const filter = queueFilter(query, now);
  const coll = await privacyRequests();
  const [items, total, byStatus, overdue] = await Promise.all([
    coll.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    coll.countDocuments(filter),
    coll.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    coll.countDocuments({ status: { $in: OPEN_STATUSES }, dueAt: { $lt: now } }),
  ]);
  const counts = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, byStatus.find((row) => row._id === status)?.n ?? 0]));
  return { items: items.map((doc) => serializeRequest(doc, now)), total, page, limit, counts: { ...counts, overdue } };
}

async function findRequest(id) {
  const _id = toObjectId(id);
  const doc = _id && await (await privacyRequests()).findOne({ _id });
  if (!doc) throw new HttpError(404, 'Privacy request not found');
  return doc;
}

const matchedLeadFields = { ref: 1, channel: 1, status: 1, createdAt: 1, applicant: 1, guardian: 1, preference: 1, school: 1, careerField: 1, contactConsent: 1, erasure: 1, studentId: 1 };

/** The leads and accounts a request is about: the account's own leads, or leads/accounts sharing its email or mobile (including a guardian's mobile). */
export async function matchesFor(request) {
  const leads = await applications();
  const students = await collection(COLLECTIONS.students);
  const { email, phone } = request.requester ?? {};
  let leadDocs = [];
  let accountDocs = [];
  if (request.studentId) {
    leadDocs = await leads.find({ studentId: request.studentId }, { projection: matchedLeadFields }).limit(MAX_MATCHES).toArray();
    const account = await students.findOne({ _id: request.studentId }, { projection: { name: 1, email: 1, phone: 1, createdAt: 1, status: 1 } });
    accountDocs = account ? [account] : [];
  } else {
    const or = [
      ...(phone ? [{ 'applicant.phone': phone }, { 'guardian.phone': { $eq: phone, $type: 'string' } }] : []),
      ...(email ? [{ 'applicant.email': email }] : []),
    ];
    if (or.length) leadDocs = await leads.find({ $or: or }, { projection: matchedLeadFields }).sort({ createdAt: -1 }).limit(MAX_MATCHES).toArray();
    const accountOr = [...(email ? [{ email: { $eq: email, $type: 'string' } }] : []), ...(phone ? [{ phone: { $eq: phone, $type: 'string' } }] : [])];
    if (accountOr.length) accountDocs = await students.find({ $or: accountOr }, { projection: { name: 1, email: 1, phone: 1, createdAt: 1, status: 1 } }).limit(10).toArray();
  }
  return {
    leads: leadDocs.map((doc) => ({
      id: doc._id.toString(), ref: doc.ref, channel: channelOf(doc), channelLabel: CHANNEL_LABELS[channelOf(doc)] ?? channelOf(doc), status: doc.status, statusLabel: statusLabel(doc.status),
      createdAt: doc.createdAt, name: doc.applicant?.fullName ?? '', phone: doc.applicant?.phone ?? '', email: doc.applicant?.email ?? '',
      about: doc.preference?.institutionName || doc.careerField?.name || doc.school?.name || '',
      isAdult: typeof doc.applicant?.isAdult === 'boolean' ? doc.applicant.isAdult : null,
      guardian: doc.guardian ? { name: doc.guardian.name ?? '', phone: doc.guardian.phone ?? '' } : null,
      matchedOn: request.studentId ? 'account' : doc.applicant?.phone === phone && phone ? 'phone' : doc.applicant?.email === email && email ? 'email' : 'guardian phone',
      doNotContact: Boolean(doc.contactConsent?.withdrawnAt), erasedAt: doc.erasure?.at ?? null,
    })),
    accounts: accountDocs.map((doc) => ({ id: doc._id.toString(), name: doc.name ?? '', email: doc.email ?? '', phone: doc.phone ?? '', createdAt: doc.createdAt ?? null, status: doc.status ?? 'active' })),
  };
}

export async function requestDetail(id, now = new Date()) {
  const doc = await findRequest(id);
  return { item: serializeRequest(doc, now), matches: await matchesFor(doc) };
}

export async function resolveRequest(staff, id, { status, reason }, now = new Date()) {
  const doc = await findRequest(id);
  const set = { status, updatedAt: now, ...(status === 'done' || status === 'rejected' ? { resolution: { status, reason, at: now, byEmail: staff.email } } : { resolution: null }) };
  const updated = await (await privacyRequests()).findOneAndUpdate({ _id: doc._id }, { $set: set, $push: { history: { status, at: now, byEmail: staff.email, reason } } }, { returnDocument: 'after' });
  await audit(staff, `privacy.${status}`, { type: 'privacy_request', id: doc._id, label: doc.ref }, { type: doc.type, reason });
  return serializeRequest(updated, now);
}

export async function addNote(staff, id, text, now = new Date()) {
  const clean = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
  if (clean.length < 2) throw new HttpError(400, 'Write a note first', { fields: { text: 'Write a note first' } });
  const doc = await findRequest(id);
  const updated = await (await privacyRequests()).findOneAndUpdate({ _id: doc._id }, { $push: { notes: { text: clean, at: now, byEmail: staff.email } }, $set: { updatedAt: now } }, { returnDocument: 'after' });
  return serializeRequest(updated, now);
}

/** The chosen lead ids, limited to leads this request actually matches (never an arbitrary lead). */
async function chosenLeads(doc, leadIds) {
  if (!Array.isArray(leadIds) || !leadIds.length) throw new HttpError(400, 'Choose at least one matched lead', { fields: { leadIds: 'Choose at least one lead' } });
  const matched = new Set((await matchesFor(doc)).leads.map((lead) => lead.id));
  const ids = [...new Set(leadIds.map(String))];
  if (ids.some((leadId) => !matched.has(leadId))) throw new HttpError(400, 'Only leads matched to this request can be changed', { fields: { leadIds: 'Reload the request' } });
  return ids.map(toObjectId);
}

const assertOpen = (doc) => {
  if (!OPEN_STATUSES.includes(doc.status)) throw new HttpError(409, 'This request is closed. Reopen it (mark it in progress) first.');
};

/** Erasure: anonymise the chosen matched leads (and their notes and follow-ups), optionally deleting the account. */
export async function anonymiseForRequest(staff, id, { leadIds, deleteAccount = false } = {}, now = new Date()) {
  const doc = await findRequest(id);
  if (doc.type !== 'erasure') throw new HttpError(400, 'Only erasure requests can anonymise leads');
  assertOpen(doc);
  const ids = leadIds?.length ? await chosenLeads(doc, leadIds) : [];
  if (!ids.length && !(deleteAccount && doc.studentId)) throw new HttpError(400, 'Choose at least one matched lead', { fields: { leadIds: 'Choose at least one lead' } });
  const leads = await applications();
  const docs = ids.length ? await leads.find({ _id: { $in: ids } }, { projection: { answers: 1, guardian: 1, callback: 1, preference: 1, contactConsent: 1 } }).toArray() : [];
  for (const lead of docs) await leads.updateOne({ _id: lead._id }, anonymiseLeadUpdate(lead, { now, requestRef: doc.ref }));
  if (ids.length) {
    await (await collection(COLLECTIONS.applicationNotes)).updateMany({ applicationId: { $in: ids } }, { $set: { text: `${ERASED_TEXT} (privacy request ${doc.ref})` } });
    await (await collection(COLLECTIONS.leadTasks)).updateMany({ leadId: { $in: ids } }, { $set: { leadName: ERASED_NAME, leadPhone: '', title: 'Follow-up (erased)' } });
  }
  let accountDeleted = false;
  if (deleteAccount && doc.studentId) {
    const students = await collection(COLLECTIONS.students);
    const account = await students.findOne({ _id: doc.studentId }, { projection: { email: 1, phone: 1 } });
    if (account) {
      // Leads still linked to the account lose the link; their contents were anonymised above if chosen.
      await leads.updateMany({ studentId: doc.studentId }, { $set: { studentId: null, updatedAt: now } });
      await (await collection(COLLECTIONS.reviews)).deleteMany({ studentId: doc.studentId });
      await (await collection(COLLECTIONS.studentEvents)).updateMany({ studentId: doc.studentId }, { $unset: { studentId: '' } });
      await (await collection(COLLECTIONS.studentFollowups)).deleteMany({ studentId: doc.studentId, studentKind: 'account' });
      const codes = await collection(COLLECTIONS.otpCodes);
      for (const [channel, identifier] of [['email', account.email], ['phone', account.phone]]) if (identifier) await codes.deleteMany({ channel, identifier });
      await students.deleteOne({ _id: doc.studentId });
      accountDeleted = true;
    }
  }
  clearLeadCounts();
  const action = { kind: 'anonymise', at: now, byEmail: staff.email, count: docs.length, accountDeleted };
  const updated = await (await privacyRequests()).findOneAndUpdate({ _id: doc._id }, { $push: { actions: action }, $set: { status: 'in-progress', updatedAt: now } }, { returnDocument: 'after' });
  await audit(staff, 'privacy.anonymise', { type: 'privacy_request', id: doc._id, label: doc.ref }, { leads: docs.length, leadIds: ids.map(String), accountDeleted });
  return { item: serializeRequest(updated, now), anonymised: docs.length, accountDeleted };
}

/** Withdrawal from the public form: mark the chosen matched leads "Do not contact". */
export async function stopContactForRequest(staff, id, { leadIds } = {}, now = new Date()) {
  const doc = await findRequest(id);
  if (!['withdraw-consent', 'erasure'].includes(doc.type)) throw new HttpError(400, 'Only withdrawal and erasure requests stop contact');
  assertOpen(doc);
  const ids = await chosenLeads(doc, leadIds);
  const { modifiedCount } = await (await applications()).updateMany({ _id: { $in: ids }, 'contactConsent.withdrawnAt': { $exists: false } }, withdrawUpdate({ now, via: 'privacy-request', requestRef: doc.ref }));
  clearLeadCounts();
  const updated = await (await privacyRequests()).findOneAndUpdate({ _id: doc._id }, { $push: { actions: { kind: 'stop-contact', at: now, byEmail: staff.email, count: modifiedCount } }, $set: { status: 'in-progress', updatedAt: now } }, { returnDocument: 'after' });
  await audit(staff, 'privacy.stop_contact', { type: 'privacy_request', id: doc._id, label: doc.ref }, { leads: modifiedCount, leadIds: ids.map(String) });
  return { item: serializeRequest(updated, now), updated: modifiedCount };
}

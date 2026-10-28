import { ObjectId } from 'mongodb';
import { collection, COLLECTIONS, getDb, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { decodeCursor, queryString } from '../../lib/query.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { escapeRegex, slugify } from '../../lib/validation.js';
import { PUBLIC_FILTER } from '../universities/university-service.js';
import { CLASS_LEVELS, CLOSED_STATUSES, INDIAN_STATES, SCHOOL_STREAMS, STATUS_LABELS, STATUSES } from './schema.js';

export const COUNTERS = 'counters';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const applications = () => collection(COLLECTIONS.applications);
export const applicationNotes = () => collection(COLLECTIONS.applicationNotes);

// Every lead is one `applications` document; `channel` says where it came from.
// Documents written before channels existed have no `channel` and count as web-apply.
export const CHANNELS = ['web-apply', 'school-drive', 'callback'];
export const CHANNEL_LABELS = { 'web-apply': 'Website apply', 'school-drive': 'School drive', callback: 'Counsellor callback' };
export const channelOf = (doc) => doc.channel ?? 'web-apply';

// Name search keys: accent-folded lowercase words, matched by anchored prefix ("asha r" → asha*, r*).
export function nameTokensOf(name) {
  const words = String(name ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return [...new Set(words.filter(Boolean))].slice(0, 8);
}
// Derived search fields written on every insert; `keysV` marks documents the backfill has brought
// up to date (2 added cityKey), so the backfill only rewrites older rows.
export const LEAD_KEYS_VERSION = 2;
export const leadKeys = (applicant) => ({ nameTokens: nameTokensOf(applicant?.fullName), cityKey: slugify(applicant?.city ?? ''), keysV: LEAD_KEYS_VERSION });

// Short-lived count cache: list pages and status chips re-use a count for 30 s instead of
// re-counting millions of rows on every click. Writes that move counts clear it.
const leadCounts = createTtlCache({ ttlMs: 30_000, maxEntries: 500 });
export const clearLeadCounts = () => leadCounts.clear();
export async function countLeads(filter, key) {
  return leadCounts.wrap(key, async () => {
    const leads = await applications();
    if (!Object.keys(filter).length) return { total: await leads.estimatedDocumentCount(), exact: true };
    try {
      return { total: await leads.countDocuments(filter, { maxTimeMS: 3000 }), exact: true };
    } catch (error) {
      if (error?.code !== 50) throw error; // MaxTimeMSExpired: show "many" rather than fail the page.
      return { total: null, exact: false };
    }
  });
}

// Human reference GV-<year>-<6 digits>, from an atomic per-year counter.
export async function nextRef(now = new Date()) {
  const year = new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear();
  const counter = await (await getDb()).collection(COUNTERS).findOneAndUpdate(
    { _id: `applications-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' },
  );
  return `GV-${year}-${String(counter.seq).padStart(6, '0')}`;
}

export async function findInstitution(slug) {
  const doc = await (await collection(COLLECTIONS.institutions)).findOne({ ...PUBLIC_FILTER, slug }, { projection: { slug: 1, name: 1, city: 1, state: 1 } });
  return doc && { slug: doc.slug, name: doc.name, city: doc.city || '', state: doc.state || '' };
}

export async function findCourse(slug) {
  const doc = await (await collection(COLLECTIONS.courses)).findOne({ slug, active: { $ne: false } }, { projection: { slug: 1, name: 1 } });
  return doc && { slug: doc.slug, name: doc.name };
}

export const isOpen = (status) => !CLOSED_STATUSES.includes(status);
export const statusLabel = (status) => STATUS_LABELS[status] ?? status;

// School-drive and callback leads carry an empty preference object; readers stay null-safe.
const preferenceSummary = (preference = {}) => ({
  institutionSlug: preference?.institutionSlug || '',
  institutionName: preference?.institutionName || '',
  city: preference?.city || '',
  state: preference?.state || '',
  courseSlug: preference?.courseSlug || '',
  courseName: preference?.courseName || '',
  programmeName: preference?.programmeName || '',
  intakeYear: preference?.intakeYear ?? null,
});
const schoolSummary = (school) => (school ? { name: school.name ?? '', district: school.district ?? '', state: school.state ?? '', city: school.city ?? '' } : null);

// Student-facing: their own application only, without internal fields (assignees, IP, staff ids).
// Applications stored before quick apply existed are detailed.
export const modeOf = (doc) => (doc.mode === 'quick' ? 'quick' : 'detailed');

export const serializeForStudent = (doc, { full = false } = {}) => ({
  ref: doc.ref,
  mode: modeOf(doc),
  status: doc.status,
  statusLabel: statusLabel(doc.status),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  preference: full ? { ...preferenceSummary(doc.preference), studyMode: doc.preference.studyMode ?? '', hostelRequired: doc.preference.hostelRequired ?? null, budgetPerYearInr: doc.preference.budgetPerYearInr ?? null, message: doc.preference.message ?? '' } : preferenceSummary(doc.preference),
  ...(full ? {
    applicant: doc.applicant ?? {},
    academics: doc.academics ?? null,
    exams: doc.exams ?? [],
    statusHistory: (doc.statusHistory ?? []).map((entry) => ({ status: entry.status, statusLabel: statusLabel(entry.status), at: entry.at })),
  } : {}),
});

export const serializeLeadSummary = (doc) => ({
  id: doc._id.toString(),
  ref: doc.ref,
  channel: channelOf(doc),
  mode: channelOf(doc) === 'web-apply' ? modeOf(doc) : null,
  status: doc.status,
  applicant: { fullName: doc.applicant?.fullName ?? '', email: doc.applicant?.email ?? '', phone: doc.applicant?.phone ?? '', city: doc.applicant?.city ?? '', state: doc.applicant?.state ?? '' },
  preference: preferenceSummary(doc.preference),
  school: schoolSummary(doc.school),
  classLevel: doc.academics?.classLevel ?? '',
  schoolStream: doc.academics?.schoolStream ?? '',
  careerField: doc.careerField ?? null,
  assignedEmployeeIds: (doc.assignedEmployeeIds ?? []).map(String),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// Staff detail: every submitted field. The IP stays in the database for audit only.
export function serializeLeadDetail(doc, { staff, people = new Map() }) {
  const person = (id) => (id ? { id: id.toString(), email: people.get(id.toString()) ?? 'Former staff' } : null);
  return {
    ...serializeLeadSummary(doc),
    studentId: doc.studentId?.toString() ?? null,
    applicant: doc.applicant ?? {},
    academics: doc.academics ?? null,
    exams: doc.exams ?? [],
    preference: doc.preference ?? {},
    formId: doc.formId?.toString() ?? null,
    answers: (doc.answers ?? []).map((answer) => ({ id: answer.id, label: answer.label, type: answer.type, value: answer.value })),
    callback: doc.callback ?? null,
    contactVerified: doc.contactVerified ?? { email: false, phone: false },
    consent: {
      contactConsent: doc.consent?.contactConsent ?? false, privacyAccepted: doc.consent?.privacyAccepted ?? false, at: doc.consent?.at ?? null, version: doc.consent?.version ?? '',
      text: doc.consent?.text ?? {},
      ...(staff.role === 'admin' ? { userAgent: doc.consent?.userAgent ?? '' } : {}),
    },
    source: doc.source ?? {},
    statusHistory: (doc.statusHistory ?? []).map((entry) => ({ status: entry.status, at: entry.at, by: person(entry.byAdminId) })),
    assignedEmployees: (doc.assignedEmployeeIds ?? []).map((id) => person(id)),
  };
}

export const serializeNote = (note) => ({ id: note._id.toString(), text: note.text, authorEmail: note.authorEmail, authorRole: note.authorRole, createdAt: note.createdAt });

export const accessFilter = (staff) => (staff.role === 'admin' ? {} : { assignedEmployeeIds: staff._id });

export async function visibleLead(id, staff) {
  const _id = toObjectId(id);
  const doc = _id && await (await applications()).findOne({ _id, ...accessFilter(staff) });
  if (!doc) throw new HttpError(404, 'Lead not found');
  return doc;
}

// "YYYY-MM-DD" in India time → the UTC instant that day starts.
export function istDayStart(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - IST_OFFSET_MS;
  return Number.isFinite(time) ? new Date(time) : null;
}

export function istToday(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Every branch is an anchored prefix so it can use an index (ref, applicant.email, applicant.phone, nameTokens).
function searchFilter(q) {
  if (/^gv-\d/i.test(q)) return { ref: { $regex: `^${escapeRegex(q.toUpperCase())}` } };
  if (q.includes('@')) return { 'applicant.email': { $regex: `^${escapeRegex(q.toLowerCase())}` } };
  const digits = q.replace(/[\s()+-]/g, '');
  if (/^\d{4,12}$/.test(digits)) {
    const local = digits.replace(/^(?:91(?=\d{10}$)|0(?=\d{10}$))/, '');
    return { 'applicant.phone': { $regex: `^\\+91${escapeRegex(local)}` } };
  }
  const terms = nameTokensOf(q).filter((term) => term.length >= 2).slice(0, 3);
  if (!terms.length) return { nameTokens: { $in: [] } }; // nothing searchable (e.g. "." or one letter) matches nothing
  const clauses = terms.map((term) => ({ nameTokens: { $regex: `^${escapeRegex(term)}` } }));
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

// "today" | "yesterday" | "7d" | "30d" | "month", resolved in India time on the server.
export const DATE_RANGES = ['today', 'yesterday', '7d', '30d', 'month'];
export function rangeDates(range, now = new Date()) {
  const today = istDayStart(istToday(now));
  const days = (count) => new Date(today.getTime() - count * DAY_MS);
  if (range === 'today') return { $gte: today };
  if (range === 'yesterday') return { $gte: days(1), $lt: today };
  if (range === '7d') return { $gte: days(6) };
  if (range === '30d') return { $gte: days(29) };
  if (range === 'month') return { $gte: istDayStart(`${istToday(now).slice(0, 8)}01`) };
  return null;
}

const listParam = (value, max = 200) => queryString(value, max).split(',').map((item) => item.trim()).filter(Boolean);
function oneOf(values, allowed, name, label) {
  if (values.some((item) => !allowed.includes(item))) throw new HttpError(400, `Unknown ${label} filter`, { fields: { [name]: `Choose a valid ${label}` } });
  return values.length === 1 ? values[0] : { $in: values };
}

// "District" or "District|State": the state keeps same-named districts in different states apart.
export function districtParam(value) {
  const [name = '', state = ''] = queryString(value, 120).split('|').map((part) => part.trim());
  const key = slugify(name);
  return key ? { key, state } : null;
}
const MAX_DISTRICT_FORMS = 500;

/**
 * leadFilter for request handlers: a district is resolved to its drives' ids through the small lead_forms
 * collection, so the list reads the formId index instead of walking every lead for a rare district.
 */
export async function resolveLeadFilter(query, staff) {
  const district = districtParam(query.district);
  if (!district) return leadFilter(query, staff);
  const forms = await (await collection(COLLECTIONS.leadForms))
    .find({ 'school.districtKey': district.key, ...(district.state && { 'school.state': district.state }) }, { projection: { _id: 1 } })
    .limit(MAX_DISTRICT_FORMS + 1).toArray();
  return leadFilter(query, staff, forms.length > MAX_DISTRICT_FORMS ? {} : { districtFormIds: forms.map((form) => form._id) });
}

/** Builds the Mongo filter for the leads list, counts and exports from query parameters. */
export function leadFilter(query, staff, { districtFormIds } = {}) {
  const clauses = [accessFilter(staff)];
  const statuses = listParam(query.status);
  if (statuses.length) clauses.push({ status: oneOf(statuses, STATUSES, 'status', 'status') });
  const channels = listParam(query.channel, 60);
  if (channels.length) {
    oneOf(channels, CHANNELS, 'channel', 'source');
    // Leads stored before channels existed have no `channel`: they are website applications.
    clauses.push({ channel: { $in: channels.flatMap((item) => (item === 'web-apply' ? ['web-apply', null] : [item])) } });
  }
  const form = queryString(query.form, 30);
  if (form) {
    const id = toObjectId(form);
    if (!id) throw new HttpError(400, 'Invalid school drive filter', { fields: { form: 'Choose a valid school drive' } });
    clauses.push({ formId: id });
  }
  const institution = slugify(queryString(query.institution, 120));
  if (institution) clauses.push({ 'preference.institutionSlug': institution });
  const course = slugify(queryString(query.course, 100));
  if (course) clauses.push({ 'preference.courseSlug': course });
  const states = listParam(query.state, 400);
  if (states.length) clauses.push({ 'applicant.state': oneOf(states, INDIAN_STATES, 'state', 'state') });
  const city = queryString(query.city, 80);
  if (city) clauses.push({ cityKey: slugify(city) });
  const district = districtParam(query.district);
  if (district) {
    clauses.push(districtFormIds
      ? { formId: { $in: districtFormIds } }
      : { channel: 'school-drive', 'school.districtKey': district.key, ...(district.state && { 'school.state': district.state }) });
  }
  // Class, stream and career field exist only on one channel's leads. Naming that channel changes no
  // result but lets the planner read the channel index instead of every lead (these fields have none).
  const classes = listParam(query.class, 80);
  if (classes.length) clauses.push({ channel: 'school-drive', 'academics.classLevel': oneOf(classes, CLASS_LEVELS.map((item) => item.value), 'class', 'class') });
  const streams = listParam(query.stream, 120);
  if (streams.length) clauses.push({ channel: 'school-drive', 'academics.schoolStream': oneOf(streams, SCHOOL_STREAMS.map((item) => item.value), 'stream', 'stream') });
  const careerField = slugify(queryString(query.careerField, 80));
  if (careerField) clauses.push({ channel: 'callback', 'careerField.slug': careerField });
  const mode = queryString(query.mode, 10);
  if (mode === 'quick') clauses.push({ mode: 'quick' });
  else if (mode === 'detailed') clauses.push({ $or: [{ mode: 'detailed' }, { mode: { $exists: false } }] });
  else if (mode) throw new HttpError(400, 'Unknown form filter', { fields: { mode: 'Choose quick or detailed' } });
  const range = queryString(query.range, 10);
  const from = queryString(query.from, 10);
  const to = queryString(query.to, 10);
  if (range) {
    if (!DATE_RANGES.includes(range)) throw new HttpError(400, 'Unknown date range', { fields: { range: 'Choose a valid date range' } });
    clauses.push({ createdAt: rangeDates(range) });
  } else if (from || to) {
    const dates = {};
    if (from) { const start = istDayStart(from); if (!start) throw new HttpError(400, 'Invalid start date', { fields: { from: 'Use YYYY-MM-DD' } }); dates.$gte = start; }
    if (to) { const end = istDayStart(to); if (!end) throw new HttpError(400, 'Invalid end date', { fields: { to: 'Use YYYY-MM-DD' } }); dates.$lt = new Date(end.getTime() + DAY_MS); }
    clauses.push({ createdAt: dates });
  }
  const assignee = queryString(query.assignee, 30);
  if (assignee && staff.role === 'admin') {
    if (assignee === 'unassigned') clauses.push({ assignedEmployeeIds: [] });
    else {
      const id = toObjectId(assignee);
      if (!id) throw new HttpError(400, 'Invalid employee filter', { fields: { assignee: 'Choose a valid employee' } });
      clauses.push({ assignedEmployeeIds: id });
    }
  }
  const q = queryString(query.q, 100);
  if (q) clauses.push(searchFilter(q));
  const filled = clauses.filter((clause) => Object.keys(clause).length);
  return filled.length > 1 ? { $and: filled } : filled[0] ?? {};
}

const FILTER_PARAMS = ['status', 'channel', 'form', 'institution', 'course', 'state', 'city', 'district', 'class', 'stream', 'careerField', 'mode', 'range', 'from', 'to', 'assignee', 'q'];
// Stable cache key for a filter: sorted parameters plus the viewer's scope (employees see only their leads).
export function filterKey(query, staff) {
  const parts = FILTER_PARAMS.map((name) => [name, queryString(query[name], 400)]).filter(([, value]) => value);
  if (['range', 'from', 'to'].some((name) => queryString(query[name]))) parts.push(['day', istToday()]);
  return `${staff.role === 'admin' ? 'admin' : staff._id.toString()}|${new URLSearchParams(parts).toString()}`;
}

export const LIST_SORTS = { newest: -1, oldest: 1 };
// Keyset page: rows strictly after (or before) the cursor row in the list order.
export function cursorClause(value, direction, order) {
  const cursor = decodeCursor(value);
  if (!cursor) throw new HttpError(400, 'Invalid page cursor', { fields: { cursor: 'Reload the list' } });
  const op = (direction === 'after') === (order === -1) ? '$lt' : '$gt';
  return { $or: [{ createdAt: { [op]: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { [op]: new ObjectId(cursor.id) } }] };
}

export async function staffEmails(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))].map(toObjectId).filter(Boolean);
  if (!unique.length) return new Map();
  const docs = await (await collection(COLLECTIONS.admins)).find({ _id: { $in: unique } }, { projection: { email: 1 } }).toArray();
  return new Map(docs.map((doc) => [doc._id.toString(), doc.email]));
}

export const DAY = DAY_MS;
export const IST_OFFSET = IST_OFFSET_MS;

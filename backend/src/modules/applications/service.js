import { collection, COLLECTIONS, getDb, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { escapeRegex, slugify } from '../../lib/validation.js';
import { PUBLIC_FILTER } from '../universities/university-service.js';
import { CLOSED_STATUSES, STATUS_LABELS, STATUSES } from './schema.js';

export const COUNTERS = 'counters';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const applications = () => collection(COLLECTIONS.applications);
export const applicationNotes = () => collection(COLLECTIONS.applicationNotes);

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

const preferenceSummary = (preference) => ({
  institutionSlug: preference.institutionSlug,
  institutionName: preference.institutionName,
  city: preference.city,
  state: preference.state,
  courseSlug: preference.courseSlug || '',
  courseName: preference.courseName || '',
  programmeName: preference.programmeName || '',
  intakeYear: preference.intakeYear,
});

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
  mode: modeOf(doc),
  status: doc.status,
  applicant: { fullName: doc.applicant?.fullName ?? '', email: doc.applicant?.email ?? '', phone: doc.applicant?.phone ?? '', city: doc.applicant?.city ?? '', state: doc.applicant?.state ?? '' },
  preference: preferenceSummary(doc.preference),
  assignedEmployeeIds: (doc.assignedEmployeeIds ?? []).map(String),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// Staff detail: every submitted field. The IP stays in the database for audit only.
export function serializeLeadDetail(doc, { staff, people = new Map() }) {
  const person = (id) => (id ? { id: id.toString(), email: people.get(id.toString()) ?? 'Former staff' } : null);
  return {
    ...serializeLeadSummary(doc),
    studentId: doc.studentId.toString(),
    applicant: doc.applicant ?? {},
    academics: doc.academics ?? null,
    exams: doc.exams ?? [],
    preference: doc.preference,
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

function searchFilter(q) {
  if (/^gv-\d/i.test(q)) return { ref: { $regex: `^${escapeRegex(q.toUpperCase())}` } };
  if (q.includes('@')) return { 'applicant.email': { $regex: `^${escapeRegex(q.toLowerCase())}` } };
  const digits = q.replace(/[\s+-]/g, '');
  if (/^\d{4,12}$/.test(digits)) return { 'applicant.phone': { $regex: escapeRegex(digits.replace(/^91(?=\d{10}$)/, '')) } };
  return { 'applicant.fullName': { $regex: escapeRegex(q), $options: 'i' } };
}

/** Builds the Mongo filter for the leads list and CSV export from query parameters. */
export function leadFilter(query, staff) {
  const clauses = [accessFilter(staff)];
  const status = queryString(query.status, 40);
  if (status) {
    const statuses = status.split(',').filter(Boolean);
    if (statuses.some((item) => !STATUSES.includes(item))) throw new HttpError(400, 'Unknown status filter', { fields: { status: 'Choose a valid status' } });
    clauses.push({ status: statuses.length === 1 ? statuses[0] : { $in: statuses } });
  }
  const institution = slugify(queryString(query.institution, 120));
  if (institution) clauses.push({ 'preference.institutionSlug': institution });
  const course = slugify(queryString(query.course, 100));
  if (course) clauses.push({ 'preference.courseSlug': course });
  const state = queryString(query.state, 60);
  if (state) clauses.push({ 'applicant.state': state });
  const mode = queryString(query.mode, 10);
  if (mode === 'quick') clauses.push({ mode: 'quick' });
  else if (mode === 'detailed') clauses.push({ mode: { $ne: 'quick' } });
  else if (mode) throw new HttpError(400, 'Unknown form filter', { fields: { mode: 'Choose quick or detailed' } });
  const from = queryString(query.from, 10);
  const to = queryString(query.to, 10);
  if (from || to) {
    const range = {};
    if (from) { const start = istDayStart(from); if (!start) throw new HttpError(400, 'Invalid start date', { fields: { from: 'Use YYYY-MM-DD' } }); range.$gte = start; }
    if (to) { const end = istDayStart(to); if (!end) throw new HttpError(400, 'Invalid end date', { fields: { to: 'Use YYYY-MM-DD' } }); range.$lt = new Date(end.getTime() + DAY_MS); }
    clauses.push({ createdAt: range });
  }
  const assignee = queryString(query.assignee, 30);
  if (assignee && staff.role === 'admin') {
    if (assignee === 'unassigned') clauses.push({ assignedEmployeeIds: { $size: 0 } });
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

export async function staffEmails(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))].map(toObjectId).filter(Boolean);
  if (!unique.length) return new Map();
  const docs = await (await collection(COLLECTIONS.admins)).find({ _id: { $in: unique } }, { projection: { email: 1 } }).toArray();
  return new Map(docs.map((doc) => [doc._id.toString(), doc.email]));
}

export const DAY = DAY_MS;
export const IST_OFFSET = IST_OFFSET_MS;

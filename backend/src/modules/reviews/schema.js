import { HttpError } from '../../lib/http-error.js';
import { isPlainObject } from '../../lib/validation.js';

// What a student says about Gyaan Vidhya. Shown publicly only after a moderator approves it, with the
// reviewer's first name and last initial (never the full name, email or phone).
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
export const REVIEWER_STAGES = {
  school: 'Class 11–12 student',
  college: 'College student',
  graduate: 'Graduate',
  parent: 'Parent',
};
export const LIMITS = { name: [2, 60], course: [2, 80], institution: [0, 100], city: [0, 60], title: [0, 80], text: [30, 800] };
export const CONSENT_TEXT = 'Gyaan Vidhya may show this review publicly with my first name, last initial, course and city.';

// Contact details and links are refused: they are spam magnets and expose the reviewer.
// (Bare "name.com" is not matched on purpose: it would refuse courses such as "B.Com".)
const LINK = /(?:https?:\/\/|\bwww\.)\S+/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\s-]?){10,}/;

// Control characters, zero-width marks, line/paragraph separators and the BOM, built from code points
// so the source stays plain ASCII.
const hex = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
const INVISIBLE = new RegExp(`[${[[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x2029], [0xfeff, 0xfeff]]
  .map(([from, to]) => (from === to ? hex(from) : `${hex(from)}-${hex(to)}`)).join('')}]`, 'g');

// Collapses whitespace runs and strips control characters; keeps line breaks in the review text.
function clean(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  const text = value.normalize('NFC').replace(INVISIBLE, '');
  if (!multiline) return text.replace(/\s+/g, ' ').trim();
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Validates a student's review form. Throws 400 with per-field messages. */
export function parseReview(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Send the review as a JSON object');
  const fields = {};
  const value = {
    name: clean(body.name),
    course: clean(body.course),
    institution: clean(body.institution),
    city: clean(body.city),
    title: clean(body.title),
    text: clean(body.text, { multiline: true }),
  };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const length = [...value[key]].length;
    if (min && length < min) fields[key] = key === 'text' ? `Write at least ${min} characters` : 'This field is required';
    else if (length > max) fields[key] = `Use at most ${max} characters`;
  }
  if (value.name && !/\p{L}/u.test(value.name)) fields.name = 'Enter your name';
  for (const key of ['title', 'text', 'institution', 'course']) {
    if (!fields[key] && (LINK.test(value[key]) || EMAIL.test(value[key]) || PHONE.test(value[key]))) {
      fields[key] = 'Please remove links, email addresses and phone numbers';
    }
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = 'Choose a rating from 1 to 5 stars';
  const stage = typeof body.stage === 'string' && Object.hasOwn(REVIEWER_STAGES, body.stage) ? body.stage : '';
  if (!stage) fields.stage = 'Tell us who you are';
  if (body.consent !== true) fields.consent = 'Please agree so we can show your review';
  if (Object.keys(fields).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields });
  return { ...value, rating, stage };
}

/** "Priya Sharma" → "Priya S."; a single word stays as it is. */
export function displayName(name) {
  const parts = clean(name).split(' ').filter(Boolean);
  if (!parts.length) return 'Student';
  const first = parts[0].slice(0, 24);
  return parts.length > 1 ? `${first} ${[...parts.at(-1)][0].toUpperCase()}.` : first;
}

/** The public shape: no student id, email, phone, status or moderation details. */
export function serializePublic(doc) {
  return {
    id: String(doc._id),
    name: displayName(doc.name),
    stage: REVIEWER_STAGES[doc.stage] ?? '',
    course: doc.course,
    institution: doc.institution || '',
    city: doc.city || '',
    rating: doc.rating,
    title: doc.title || '',
    text: doc.text,
    featured: Boolean(doc.featured),
    verified: Boolean(doc.verified),
    publishedAt: doc.approvedAt ?? doc.submittedAt,
  };
}

/** The reviewer's own copy: everything they typed plus where it is in moderation. */
export function serializeOwn(doc) {
  return {
    id: String(doc._id),
    name: doc.name, stage: doc.stage, course: doc.course, institution: doc.institution, city: doc.city,
    rating: doc.rating, title: doc.title, text: doc.text,
    status: doc.status, rejectReason: doc.status === 'rejected' ? doc.rejectReason || '' : '',
    submittedAt: doc.submittedAt, approvedAt: doc.approvedAt ?? null,
  };
}

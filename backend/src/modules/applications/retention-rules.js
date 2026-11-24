// Data retention rules for leads (`applications`). Pure functions only: no database access, so they are
// unit-tested without MongoDB. The runner is retention.js; the CLI is src/scripts/retention.js.
//
// Rule: a lead with no activity for RETENTION_MONTHS (default 24) is anonymised, whatever its status. "Activity"
// is the latest of crm.lastActivityAt, updatedAt and createdAt. Personal fields (name, phone, email, date of birth,
// PIN code, guardian, address, free-text messages and notes) are removed; what analytics need stays: channel,
// status and its history, course and university, city and state, school and class, CRM temperature/score/tags,
// assignees and every date. Leads with a follow-up still scheduled in the future are left alone.

export const DEFAULT_RETENTION_MONTHS = 24;
export const ANONYMISED_NAME = 'Anonymised lead';
// Answers to choice questions (class, stream, interests) are not personal; typed answers may be.
const KEPT_ANSWER_TYPES = new Set(['select', 'radio', 'checkbox', 'number']);
// Removed outright if present (fields other modules may add later are listed defensively; $unset of a missing field is a no-op).
export const UNSET_FIELDS = ['guardian', 'parent', 'address', 'studentId', 'ip', 'userAgent', 'consent.ip', 'consent.userAgent', 'source.ip', 'source.userAgent', 'source.referrer'];

/** RETENTION_MONTHS from the environment: a whole number from 6 to 120, otherwise the default. */
export function retentionMonths(raw = process.env.RETENTION_MONTHS) {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 6 && value <= 120 ? value : DEFAULT_RETENTION_MONTHS;
}

/** `months` calendar months before `now` (UTC). 31 March minus one month is the last day of February, not 3 March. */
export function retentionCutoff(now = new Date(), months = DEFAULT_RETENTION_MONTHS) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - months;
  const target = new Date(Date.UTC(year, month, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  return target;
}

const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The latest of crm.lastActivityAt, updatedAt and createdAt (null when none is a valid date). */
export function lastActivityOf(doc) {
  const dates = [doc?.crm?.lastActivityAt, doc?.updatedAt, doc?.createdAt].map(asDate).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

/** Whether this lead is due for anonymisation at `cutoff` (`now` guards against a follow-up still to come). */
export function isDueForRetention(doc, cutoff, now = new Date()) {
  if (!doc || doc.anonymisedAt) return false;
  const last = lastActivityOf(doc);
  if (!last || last >= cutoff) return false;
  const next = asDate(doc.crm?.nextFollowUpAt);
  return !(next && next >= now);
}

/** The MongoDB filter for leads due at `cutoff`; isDueForRetention re-checks every document before it is changed. */
export function staleLeadFilter(cutoff, now = new Date()) {
  return {
    anonymisedAt: { $exists: false },
    createdAt: { $lt: cutoff },
    $and: [
      { $or: [{ updatedAt: { $lt: cutoff } }, { updatedAt: null }] },
      { $or: [{ 'crm.lastActivityAt': { $lt: cutoff } }, { 'crm.lastActivityAt': null }] },
      { $or: [{ 'crm.nextFollowUpAt': null }, { 'crm.nextFollowUpAt': { $lt: now } }] },
    ],
  };
}

/**
 * The update that anonymises one lead. `prefix` is '' for `applications` and 'lead.' for the bin
 * (`applications_trash`, where the lead is stored under `lead`). The phone becomes a per-lead placeholder because
 * school-drive leads have a unique { formId, applicant.phone } index: an empty value would collide.
 */
export function anonymiseLeadUpdate(doc, now = new Date(), prefix = '') {
  const applicant = doc?.applicant ?? {};
  const set = {
    [`${prefix}applicant`]: { fullName: ANONYMISED_NAME, phone: `anon-${String(doc._id)}`, email: '', city: applicant.city ?? '', state: applicant.state ?? '' },
    [`${prefix}nameTokens`]: [],
    [`${prefix}anonymisedAt`]: now,
  };
  if (doc?.preference && typeof doc.preference === 'object') set[`${prefix}preference.message`] = '';
  if (doc?.callback && typeof doc.callback === 'object') set[`${prefix}callback`] = { preferredTime: doc.callback.preferredTime ?? '' };
  if (Array.isArray(doc?.answers)) set[`${prefix}answers`] = doc.answers.filter((answer) => KEPT_ANSWER_TYPES.has(answer?.type));
  if (doc?.crm && typeof doc.crm === 'object' && doc.crm.lostReason) set[`${prefix}crm.lostReason`] = '';
  const unset = Object.fromEntries(UNSET_FIELDS.map((field) => [`${prefix}${field}`, '']));
  return { $set: set, $unset: unset };
}

/** Applies an anonymise update to a plain copy (what the stored document will look like); used by the tests. */
export function applyAnonymise(doc, now = new Date()) {
  const { $set, $unset } = anonymiseLeadUpdate(doc, now);
  const out = structuredClone(doc);
  const assign = (path, value, remove = false) => {
    const parts = path.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) {
      if (node[part] === undefined || node[part] === null) { if (remove) return; node[part] = {}; }
      node = node[part];
    }
    if (remove) delete node[parts.at(-1)]; else node[parts.at(-1)] = value;
  };
  for (const [path, value] of Object.entries($set)) assign(path, value);
  for (const path of Object.keys($unset)) assign(path, undefined, true);
  return out;
}

/** What happens to a follow-up task of an anonymised lead: its copies of the name and phone go. */
export const anonymiseTaskUpdate = (task) => ({
  $set: { leadName: ANONYMISED_NAME, leadPhone: '', title: `${String(task?.kind || 'follow-up').replace(/^./, (c) => c.toUpperCase())} follow-up (anonymised)` },
});

/** Notes and call logs keep their kind, outcome, author and date; the free text goes. */
export const anonymiseNoteUpdate = (now = new Date()) => ({ $set: { text: '', anonymisedAt: now } });

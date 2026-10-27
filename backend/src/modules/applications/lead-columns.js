import { HttpError } from '../../lib/http-error.js';
import { CLASS_LEVELS, SCHOOL_STREAMS } from './schema.js';
import { CHANNEL_LABELS, channelOf, IST_OFFSET, modeOf, statusLabel } from './service.js';

// One registry for the leads table, the column picker and every export format.
// `read(doc, ctx)` returns a plain string/number; `fields` is the projection it needs.
const istDateTime = (date) => (date ? new Date(date.getTime() + IST_OFFSET).toISOString().slice(0, 16).replace('T', ' ') : '');
const labelOf = (list, value) => list.find((item) => item.value === value)?.label ?? value ?? '';
const yesNo = (value) => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : '');

export const LEAD_COLUMNS = [
  { key: 'ref', label: 'Reference', group: 'Lead', default: true, pdfWidth: 1.1, fields: ['ref'], read: (doc) => doc.ref },
  { key: 'createdAt', label: 'Submitted (IST)', group: 'Lead', default: true, pdfWidth: 1.1, fields: ['createdAt'], read: (doc) => istDateTime(doc.createdAt) },
  { key: 'status', label: 'Status', group: 'Lead', default: true, pdfWidth: 1, fields: ['status'], read: (doc) => statusLabel(doc.status) },
  { key: 'channel', label: 'Source', group: 'Lead', default: true, pdfWidth: 1, fields: ['channel'], read: (doc) => CHANNEL_LABELS[channelOf(doc)] },
  { key: 'mode', label: 'Form', group: 'Lead', fields: ['mode', 'channel'], read: (doc) => (channelOf(doc) !== 'web-apply' ? '' : modeOf(doc) === 'quick' ? 'Quick apply' : 'Detailed') },
  { key: 'updatedAt', label: 'Last updated (IST)', group: 'Lead', fields: ['updatedAt'], read: (doc) => istDateTime(doc.updatedAt) },
  { key: 'assigned', label: 'Assigned to', group: 'Lead', default: true, adminOnly: true, pdfWidth: 1.4, fields: ['assignedEmployeeIds'], read: (doc, ctx) => (doc.assignedEmployeeIds ?? []).map((id) => ctx.people?.get(id.toString()) ?? '').filter(Boolean).join('; ') },

  { key: 'fullName', label: 'Full name', group: 'Applicant', default: true, pdfWidth: 1.4, fields: ['applicant.fullName'], read: (doc) => doc.applicant?.fullName },
  { key: 'phone', label: 'Mobile', group: 'Applicant', default: true, pdfWidth: 1.1, fields: ['applicant.phone'], read: (doc) => doc.applicant?.phone },
  { key: 'email', label: 'Email', group: 'Applicant', default: true, pdfWidth: 1.6, fields: ['applicant.email'], read: (doc) => doc.applicant?.email },
  { key: 'city', label: 'City', group: 'Applicant', pdfWidth: 0.9, fields: ['applicant.city'], read: (doc) => doc.applicant?.city },
  { key: 'state', label: 'State', group: 'Applicant', default: true, pdfWidth: 1, fields: ['applicant.state'], read: (doc) => doc.applicant?.state },
  { key: 'dateOfBirth', label: 'Date of birth', group: 'Applicant', fields: ['applicant.dateOfBirth'], read: (doc) => doc.applicant?.dateOfBirth },
  { key: 'gender', label: 'Gender', group: 'Applicant', fields: ['applicant.gender'], read: (doc) => doc.applicant?.gender },
  { key: 'pincode', label: 'PIN code', group: 'Applicant', fields: ['applicant.pincode'], read: (doc) => doc.applicant?.pincode },
  { key: 'guardian', label: 'Guardian', group: 'Applicant', fields: ['applicant.guardianName', 'applicant.guardianPhone'], read: (doc) => [doc.applicant?.guardianName, doc.applicant?.guardianPhone].filter(Boolean).join(' ') },

  { key: 'schoolName', label: 'School', group: 'School drive', pdfWidth: 1.6, fields: ['school'], read: (doc) => doc.school?.name },
  { key: 'schoolDistrict', label: 'School district', group: 'School drive', pdfWidth: 1, fields: ['school'], read: (doc) => doc.school?.district },
  { key: 'schoolState', label: 'School state', group: 'School drive', pdfWidth: 1, fields: ['school'], read: (doc) => doc.school?.state },
  { key: 'classLevel', label: 'Class', group: 'School drive', pdfWidth: 0.8, fields: ['academics.classLevel'], read: (doc) => labelOf(CLASS_LEVELS, doc.academics?.classLevel) },
  { key: 'schoolStream', label: 'Stream', group: 'School drive', pdfWidth: 1, fields: ['academics.schoolStream'], read: (doc) => labelOf(SCHOOL_STREAMS, doc.academics?.schoolStream) },

  { key: 'highestQualification', label: 'Highest qualification', group: 'Academics', fields: ['academics.highestQualification'], read: (doc) => doc.academics?.highestQualification },
  { key: 'board', label: 'Board / university', group: 'Academics', fields: ['academics.board'], read: (doc) => doc.academics?.board },
  { key: 'passingYear', label: 'Passing year', group: 'Academics', fields: ['academics.passingYear'], read: (doc) => doc.academics?.passingYear },
  { key: 'score', label: 'Score', group: 'Academics', fields: ['academics.score', 'academics.scoreType'], read: (doc) => (typeof doc.academics?.score === 'number' ? `${doc.academics.score}${doc.academics.scoreType === 'cgpa' ? ' CGPA' : '%'}` : '') },
  { key: 'subjects', label: 'Stream / subjects', group: 'Academics', fields: ['academics.stream'], read: (doc) => (Array.isArray(doc.academics?.stream) ? doc.academics.stream.join('; ') : '') },
  { key: 'class12', label: 'Class 12', group: 'Academics', fields: ['academics.class12'], read: (doc) => (doc.academics?.class12 ? `${doc.academics.class12.board} ${doc.academics.class12.year} ${doc.academics.class12.percentage}%` : '') },
  { key: 'exams', label: 'Exams', group: 'Academics', fields: ['exams'], read: (doc) => (doc.exams ?? []).map((exam) => [exam.name, exam.year, exam.scoreOrRank].filter(Boolean).join(' ')).join('; ') },

  { key: 'university', label: 'University', group: 'Preference', default: true, pdfWidth: 1.8, fields: ['preference.institutionName'], read: (doc) => doc.preference?.institutionName },
  { key: 'universitySlug', label: 'University slug', group: 'Preference', fields: ['preference.institutionSlug'], read: (doc) => doc.preference?.institutionSlug },
  { key: 'course', label: 'Course', group: 'Preference', default: true, pdfWidth: 1.2, fields: ['preference.courseName'], read: (doc) => doc.preference?.courseName },
  { key: 'programme', label: 'Programme (free text)', group: 'Preference', fields: ['preference.programmeName'], read: (doc) => doc.preference?.programmeName },
  { key: 'intakeYear', label: 'Intake year', group: 'Preference', pdfWidth: 0.7, fields: ['preference.intakeYear'], read: (doc) => doc.preference?.intakeYear },
  { key: 'studyMode', label: 'Study mode', group: 'Preference', fields: ['preference.studyMode'], read: (doc) => doc.preference?.studyMode },
  { key: 'hostel', label: 'Hostel', group: 'Preference', fields: ['preference.hostelRequired'], read: (doc) => yesNo(doc.preference?.hostelRequired) },
  { key: 'budget', label: 'Budget per year (INR)', group: 'Preference', fields: ['preference.budgetPerYearInr'], read: (doc) => doc.preference?.budgetPerYearInr ?? '' },
  { key: 'message', label: 'Message', group: 'Preference', fields: ['preference.message', 'callback'], read: (doc) => doc.preference?.message || doc.callback?.message },
  { key: 'careerField', label: 'Career field', group: 'Counsellor callback', pdfWidth: 1.2, fields: ['careerField'], read: (doc) => doc.careerField?.name },
  { key: 'preferredTime', label: 'Preferred call time', group: 'Counsellor callback', fields: ['callback'], read: (doc) => doc.callback?.preferredTime },

  { key: 'sourcePath', label: 'Source page', group: 'Tracking', fields: ['source.path'], read: (doc) => doc.source?.path },
  { key: 'utmSource', label: 'UTM source', group: 'Tracking', fields: ['source.utmSource'], read: (doc) => doc.source?.utmSource },
  { key: 'utmMedium', label: 'UTM medium', group: 'Tracking', fields: ['source.utmMedium'], read: (doc) => doc.source?.utmMedium },
  { key: 'utmCampaign', label: 'UTM campaign', group: 'Tracking', fields: ['source.utmCampaign'], read: (doc) => doc.source?.utmCampaign },
];
const byKey = new Map(LEAD_COLUMNS.map((column) => [column.key, column]));

// Column order of the original CSV export, kept so existing spreadsheets keep lining up.
export const LEGACY_CSV_KEYS = [
  'ref', 'createdAt', 'status', 'mode', 'fullName', 'email', 'phone', 'dateOfBirth', 'gender', 'city', 'state', 'pincode', 'guardian',
  'highestQualification', 'board', 'passingYear', 'score', 'subjects', 'class12', 'exams', 'university', 'universitySlug', 'course', 'programme',
  'intakeYear', 'studyMode', 'hostel', 'budget', 'message', 'assigned', 'sourcePath', 'utmSource', 'utmMedium', 'utmCampaign',
];
export const DEFAULT_COLUMN_KEYS = LEAD_COLUMNS.filter((column) => column.default).map((column) => column.key);

// Custom questions of one school drive form become "answer:<fieldId>" columns.
export function answerColumns(form) {
  return (form?.fields ?? []).filter((field) => !field.builtIn).map((field) => ({
    key: `answer:${field.id}`, label: field.label, group: 'Form answers', pdfWidth: 1.2, fields: ['answers'],
    read: (doc) => {
      const value = doc.answers?.find((answer) => answer.id === field.id)?.value;
      return Array.isArray(value) ? value.join('; ') : value ?? '';
    },
  }));
}

export const describeColumn = ({ key, label, group, default: isDefault = false, adminOnly = false }) => ({ key, label, group, default: isDefault, adminOnly });

/** Resolves requested column keys; unknown keys are a 400, staff-only columns are dropped for employees. */
export function resolveColumns(keys, { staff, form = null } = {}) {
  const extra = new Map(answerColumns(form).map((column) => [column.key, column]));
  const unknown = keys.filter((key) => !byKey.has(key) && !extra.has(key));
  if (unknown.length) throw new HttpError(400, `Unknown column: ${unknown[0]}`, { fields: { columns: 'Choose columns from the list' } });
  return [...new Set(keys)].map((key) => byKey.get(key) ?? extra.get(key)).filter((column) => staff?.role === 'admin' || !column.adminOnly);
}

// Mongo rejects a projection naming both "a" and "a.b", so sub-paths of an included parent are dropped.
export function projectionFor(columns, extraFields = []) {
  const fields = [...new Set(['_id', 'createdAt', ...extraFields, ...columns.flatMap((column) => column.fields)])];
  const kept = fields.filter((field) => !fields.some((other) => other !== field && field.startsWith(`${other}.`)));
  return Object.fromEntries(kept.map((field) => [field, 1]));
}

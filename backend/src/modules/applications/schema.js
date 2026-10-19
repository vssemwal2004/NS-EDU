import { HttpError } from '../../lib/http-error.js';
import { isPlainObject, validate } from '../../lib/validation.js';
import { normalizeIdentifier } from '../student-auth/otp.js';

// Lead lifecycle. "Open" leads block a duplicate application for the same university and course.
export const STATUSES = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted', 'not-interested', 'closed'];
export const STATUS_LABELS = {
  new: 'New', contacted: 'Contacted', 'in-progress': 'In progress', 'applied-to-university': 'Applied to university',
  admitted: 'Admitted', 'not-interested': 'Not interested', closed: 'Closed',
};
export const CLOSED_STATUSES = ['not-interested', 'closed'];

export const QUALIFICATIONS = ['class-10', 'class-12', 'diploma', 'ug', 'pg', 'other'];
export const GENDERS = ['female', 'male', 'non-binary', 'prefer-not-to-say'];
export const STUDY_MODES = ['full-time', 'part-time', 'distance', 'online'];
export const SCORE_TYPES = ['percentage', 'cgpa'];
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Consent wording. The frontend copy lives in frontend/src/features/apply/apply-options.js:
// change both together and bump the version so stale forms are asked to re-read it.
export const CONSENT_VERSION = '2026-10';
export const CONSENT_TEXT = {
  contact: 'I agree that Gyaan Vidhya’s admissions team may contact me by phone, SMS or email about my application to {university}.',
  privacy: 'I confirm these details are accurate and I have read the Privacy policy. I understand that submitting this form does not apply to {university} directly: Gyaan Vidhya’s admissions team receives my details and will help me with the university’s own application process.',
};

const MAX_EXAMS = 5;
const currentYear = () => new Date().getUTCFullYear();

const applicantFields = [
  { name: 'fullName', type: 'string', required: true, minLength: 2, maxLength: 100 },
  { name: 'email', type: 'email', required: true },
  { name: 'phone', type: 'string', required: true, maxLength: 20 },
  { name: 'dateOfBirth', type: 'string', required: true, maxLength: 10, pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: 'Use the format YYYY-MM-DD' },
  { name: 'gender', type: 'select', options: GENDERS },
  { name: 'city', type: 'string', required: true, maxLength: 80 },
  { name: 'state', type: 'select', options: INDIAN_STATES, required: true },
  { name: 'pincode', type: 'string', maxLength: 6, pattern: /^[1-9]\d{5}$/, patternMessage: 'Enter a 6-digit PIN code' },
  { name: 'guardianName', type: 'string', maxLength: 100 },
  { name: 'guardianPhone', type: 'string', maxLength: 20 },
];
const academicFields = () => [
  { name: 'highestQualification', type: 'select', options: QUALIFICATIONS, required: true },
  { name: 'board', type: 'string', required: true, maxLength: 120 },
  { name: 'passingYear', type: 'integer', required: true, min: 1970, max: currentYear() + 1 },
  { name: 'scoreType', type: 'select', options: SCORE_TYPES, required: true },
  { name: 'score', type: 'number', required: true, min: 0, max: 100 },
  { name: 'stream', type: 'stringList', maxItems: 8, maxLength: 60 },
];
const class12Fields = () => [
  { name: 'board', type: 'string', required: true, maxLength: 120 },
  { name: 'year', type: 'integer', required: true, min: 1970, max: currentYear() + 1 },
  { name: 'percentage', type: 'number', required: true, min: 0, max: 100 },
];
const examFields = () => [
  { name: 'name', type: 'string', required: true, maxLength: 80 },
  { name: 'year', type: 'integer', required: true, min: 2000, max: currentYear() + 1 },
  { name: 'scoreOrRank', type: 'string', maxLength: 40 },
];
const preferenceFields = () => [
  { name: 'institutionSlug', type: 'slug', required: true, maxLength: 120 },
  { name: 'courseSlug', type: 'slug', maxLength: 100 },
  { name: 'programmeName', type: 'string', maxLength: 120 },
  { name: 'intakeYear', type: 'integer', required: true, min: currentYear(), max: currentYear() + 2 },
  { name: 'studyMode', type: 'select', options: STUDY_MODES, required: true },
  { name: 'hostelRequired', type: 'boolean', default: false },
  { name: 'budgetPerYearInr', type: 'integer', min: 0, max: 10_000_000, nullable: true },
  { name: 'message', type: 'text', maxLength: 1000 },
];
const consentFields = [
  { name: 'contactConsent', type: 'boolean', required: true },
  { name: 'privacyAccepted', type: 'boolean', required: true },
  { name: 'version', type: 'string', required: true, maxLength: 20 },
];
const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'];
const sourceFields = [
  { name: 'path', type: 'string', maxLength: 200, pattern: /^\/[^\s]*$/, patternMessage: 'Must be a site path' },
  ...UTM_KEYS.map((name) => ({ name, type: 'string', maxLength: 100 })),
];

// Validates one nested section and prefixes its errors ("applicant.email").
function section(fields, input, prefix, errors) {
  const { value, errors: sectionErrors } = validate(fields, isPlainObject(input) ? input : {});
  for (const [key, message] of Object.entries(sectionErrors)) errors[`${prefix}.${key}`] = message;
  return value;
}

const phoneOf = (raw) => normalizeIdentifier('phone', raw);
const isFilled = (value) => isPlainObject(value) && Object.values(value).some((item) => item !== undefined && item !== null && String(item).trim() !== '');

export function ageOn(dateOfBirth, today = new Date()) {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age -= 1;
  return age;
}

const isRealDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/**
 * Validates a submitted application. Unknown keys are dropped, every string is length-capped
 * and all field errors are returned together, keyed by dotted path ("academics.score").
 */
export function parseApplication(body) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const applicant = section(applicantFields, body.applicant, 'applicant', errors);
  if (applicant.phone) {
    const phone = phoneOf(applicant.phone);
    if (phone.error) errors['applicant.phone'] = phone.error;
    else applicant.phone = phone.value;
  }
  if (applicant.guardianPhone) {
    const phone = phoneOf(applicant.guardianPhone);
    if (phone.error) errors['applicant.guardianPhone'] = phone.error;
    else applicant.guardianPhone = phone.value;
  }
  if (applicant.dateOfBirth && !errors['applicant.dateOfBirth']) {
    if (!isRealDate(applicant.dateOfBirth)) errors['applicant.dateOfBirth'] = 'Enter a valid date';
    else {
      const age = ageOn(applicant.dateOfBirth);
      if (age < 14 || age > 70) errors['applicant.dateOfBirth'] = 'Applicants must be between 14 and 70 years old';
    }
  }

  const rawAcademics = isPlainObject(body.academics) ? body.academics : {};
  const academics = section(academicFields(), rawAcademics, 'academics', errors);
  if (academics.scoreType === 'cgpa' && academics.score > 10) errors['academics.score'] = 'CGPA must be between 0 and 10';
  academics.class12 = isFilled(rawAcademics.class12) ? section(class12Fields(), rawAcademics.class12, 'academics.class12', errors) : null;

  let exams = [];
  if (body.exams !== undefined && body.exams !== null) {
    if (!Array.isArray(body.exams)) errors.exams = 'Must be a list';
    else {
      const filled = body.exams.filter(isFilled);
      if (filled.length > MAX_EXAMS) errors.exams = `Add at most ${MAX_EXAMS} exams`;
      else exams = filled.map((exam, index) => section(examFields(), exam, `exams.${index}`, errors));
    }
  }

  const preference = section(preferenceFields(), body.preference, 'preference', errors);
  if (!preference.courseSlug && !preference.programmeName && !errors['preference.courseSlug'] && !errors['preference.programmeName']) {
    errors['preference.courseSlug'] = 'Choose a course or describe the programme you want';
  }

  const consent = section(consentFields, body.consent, 'consent', errors);
  if (consent.contactConsent !== true && !errors['consent.contactConsent']) errors['consent.contactConsent'] = 'Agree to be contacted so our team can help with this application';
  if (consent.privacyAccepted !== true && !errors['consent.privacyAccepted']) errors['consent.privacyAccepted'] = 'Accept the privacy terms to submit';
  if (consent.version && consent.version !== CONSENT_VERSION) errors['consent.version'] = 'The consent wording has changed. Reload the page and review it again.';

  const source = isPlainObject(body.source) ? section(sourceFields, body.source, 'source', errors) : {};

  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  return { mode: 'detailed', applicant, academics, exams, preference, consentVersion: consent.version, source };
}

// Admissions in India start around July: before July the coming intake is this year, from July the next.
export function nextIntakeYear(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.getUTCFullYear() + (ist.getUTCMonth() >= 6 ? 1 : 0);
}

const quickApplicantFields = [
  { name: 'fullName', type: 'string', required: true, minLength: 2, maxLength: 100 },
  { name: 'phone', type: 'string', required: true, maxLength: 20 },
  { name: 'email', type: 'email' },
  { name: 'city', type: 'string', maxLength: 80 },
  { name: 'state', type: 'select', options: INDIAN_STATES },
];
const quickAcademicFields = [
  { name: 'highestQualification', type: 'select', options: QUALIFICATIONS },
  { name: 'scoreType', type: 'select', options: SCORE_TYPES },
  { name: 'score', type: 'number', min: 0, max: 100, nullable: true },
];
const quickPreferenceFields = () => [
  { name: 'institutionSlug', type: 'slug', required: true, maxLength: 120 },
  { name: 'courseSlug', type: 'slug', maxLength: 100 },
  { name: 'programmeName', type: 'string', maxLength: 120 },
  { name: 'intakeYear', type: 'integer', min: currentYear(), max: currentYear() + 2, nullable: true },
];

/**
 * Validates a one-screen quick application. Only the university, name, mobile and consent are
 * required; the email comes from the verified account (`accountEmail`) and the client's value is
 * ignored unless the account has none.
 */
export function parseQuickApplication(body, { accountEmail = null } = {}) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const errors = {};
  const applicant = section(quickApplicantFields, body.applicant, 'applicant', errors);
  if (applicant.phone) {
    const phone = phoneOf(applicant.phone);
    if (phone.error) errors['applicant.phone'] = phone.error;
    else applicant.phone = phone.value;
  }
  if (accountEmail) {
    applicant.email = accountEmail;
    delete errors['applicant.email'];
  } else if (!applicant.email && !errors['applicant.email']) errors['applicant.email'] = 'Enter your email address';

  const academics = section(quickAcademicFields, body.academics, 'academics', errors);
  if (academics.score !== null && academics.score !== undefined && !academics.scoreType) academics.scoreType = 'percentage';
  if (academics.scoreType === 'cgpa' && academics.score > 10) errors['academics.score'] = 'CGPA must be between 0 and 10';
  const hasAcademics = Boolean(academics.highestQualification) || academics.score !== null;

  const preference = section(quickPreferenceFields(), body.preference, 'preference', errors);
  if (preference.intakeYear === null) preference.intakeYear = nextIntakeYear();

  const consent = section(consentFields, body.consent, 'consent', errors);
  if (consent.contactConsent !== true && !errors['consent.contactConsent']) errors['consent.contactConsent'] = 'Agree to be contacted so our team can help with this application';
  if (consent.privacyAccepted !== true && !errors['consent.privacyAccepted']) errors['consent.privacyAccepted'] = 'Accept the privacy terms to submit';
  if (consent.version && consent.version !== CONSENT_VERSION) errors['consent.version'] = 'The consent wording has changed. Reload the page and review it again.';

  const source = isPlainObject(body.source) ? section(sourceFields, body.source, 'source', errors) : {};

  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  return {
    mode: 'quick',
    applicant: { fullName: applicant.fullName, email: applicant.email, phone: applicant.phone, city: applicant.city, state: applicant.state },
    academics: hasAcademics ? { highestQualification: academics.highestQualification, scoreType: academics.score === null ? '' : academics.scoreType, score: academics.score } : null,
    exams: [],
    preference,
    consentVersion: consent.version,
    source,
  };
}

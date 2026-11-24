// Under-18 rule shared by every public form that creates a lead (quick/detailed apply, counsellor
// callback, school-drive QR registration). DPDP Act 2023 s. 9 needs verifiable consent from a parent or
// lawful guardian before a child's personal data is processed; the student answers "Are you 18 or
// older?" and, if not, a parent or guardian adds their name, mobile and consent.
//
// Pure: no database, no env. The frontend copy lives in frontend/src/features/privacy/AgeGuardianFields.js;
// change both together and bump GUARDIAN_CONSENT_VERSION.
import { isPlainObject } from '../../lib/validation.js';

export const GUARDIAN_CONSENT_VERSION = 'guardian-2026-11';
export const GUARDIAN_CONSENT_TEXT = 'I am the parent or guardian of {student} and I consent to Gyaan Vidhya using these details to guide {student} with admissions.';

/** '+91XXXXXXXXXX' for a 10-digit Indian mobile (with or without +91 / 91 / 0), else null. */
export function indianMobile(raw) {
  if (typeof raw !== 'string' || raw.length > 20) return null;
  const digits = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(raw.trim().replace(/[\s()-]/g, ''))?.[1];
  return digits ? `+91${digits}` : null;
}

export const guardianConsentText = (studentName) => GUARDIAN_CONSENT_TEXT.replaceAll('{student}', String(studentName ?? '').trim() || 'the student');

/**
 * Reads `{ isAdult, guardian: { name, phone, consent } }` from a submitted body. Errors are written into
 * `errors` under "isAdult", "guardian.name", "guardian.phone" and "guardian.consent".
 * Returns { isAdult: true|false|null, guardian: null | { name, phone, consentAt, consentVersion, consentText } }.
 */
export function parseAgeAndGuardian(body, errors, { studentName = '', now = new Date() } = {}) {
  const isAdult = isPlainObject(body) ? body.isAdult : undefined;
  if (typeof isAdult !== 'boolean') {
    errors.isAdult = 'Tell us whether you are 18 or older';
    return { isAdult: null, guardian: null };
  }
  if (isAdult) return { isAdult: true, guardian: null };

  const raw = isPlainObject(body.guardian) ? body.guardian : {};
  const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) errors['guardian.name'] = 'Enter the parent or guardian’s name';
  else if (name.length > 100) errors['guardian.name'] = 'Must be at most 100 characters';
  const phone = indianMobile(raw.phone);
  if (!phone) errors['guardian.phone'] = raw.phone ? 'Enter a valid 10-digit Indian mobile number' : 'Enter the parent or guardian’s mobile number';
  if (raw.consent !== true) errors['guardian.consent'] = 'A parent or guardian must give consent for students under 18';
  return {
    isAdult: false,
    guardian: { name, phone: phone ?? '', consentAt: now, consentVersion: GUARDIAN_CONSENT_VERSION, consentText: guardianConsentText(studentName) },
  };
}

/** The extra fields a lead's consent record carries about age (old leads have neither: "unknown"). */
export const ageConsentFields = ({ isAdult, guardian }) => ({ ageConfirmed: isAdult === true ? 'adult' : 'minor', guardianConsent: Boolean(guardian) });

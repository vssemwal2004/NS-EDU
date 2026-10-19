// Apply vocabulary. Values mirror backend/src/modules/applications/schema.js.

// Consent: keep CONSENT_VERSION identical to the backend's CONSENT_VERSION. The backend stores its own
// full wording with each lead; this one checkbox covers both its contact and privacy statements.
export const CONSENT_VERSION = '2026-10';
export const consentSentence = (university) => `I agree that Gyaan Vidhya’s admissions team may contact me by phone, SMS or email about ${university}. I understand my details go to Gyaan Vidhya’s team, not automatically to the university, and that the team will help me with the university’s own application.`;

export const QUALIFICATIONS = [
  { value: 'class-10', label: 'Class 10' },
  { value: 'class-12', label: 'Class 12' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'ug', label: 'Undergraduate degree' },
  { value: 'pg', label: 'Postgraduate degree' },
  { value: 'other', label: 'Other' },
];
export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];
export const STUDY_MODES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'distance', label: 'Distance' },
  { value: 'online', label: 'Online' },
];
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Admissions in India start around July: before July the coming intake is this year, from July the next
// (same rule as nextIntakeYear in the backend). The API accepts this year to two years ahead.
export function intakeYears(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const year = ist.getUTCFullYear();
  return { options: [year, year + 1, year + 2], suggested: year + (ist.getUTCMonth() >= 6 ? 1 : 0) };
}

export const STATUS_LABELS = {
  new: 'Submitted', contacted: 'Contacted', 'in-progress': 'In progress', 'applied-to-university': 'Applied to university',
  admitted: 'Admitted', 'not-interested': 'Not interested', closed: 'Closed',
};
// Chip tone per status: wine (active), green (good outcome), grey (ended).
export const statusTone = (status) => (status === 'admitted' || status === 'applied-to-university' ? 'good' : status === 'not-interested' || status === 'closed' ? 'ended' : status === 'new' ? 'new' : 'active');

export const labelOf = (options, value) => options.find((option) => option.value === value)?.label || value || '';

// Shared by the login dialog and /account. Everything personal except the
// account itself (name, verified contact) lives in this browser's storage.
export const SESSION_DAYS = 7; // Mirrors STUDENT_SESSION_SECONDS in the API.
export const DEFAULT_CODE_MINUTES = 5;
export const COMPARE_KEY = 'nsedu:compare';
export const COMPARE_MAX = 3;
const CHANNEL_KEY = 'nsedu:login-channel';

// Only claims that are true for Gyaan Vidhya today.
export const accountBenefits = [
  { icon: 'lock', title: 'No password, ever', short: 'No password', text: 'A one-time code to your email logs you in.' },
  { icon: 'dashboard', title: 'Your student space', short: 'Student space', text: 'Comparisons, saved news and preferences together.' },
  { icon: 'location', title: 'Set course and city once', short: 'Course & city once', text: 'Pages open with your picks on this device.' },
  { icon: 'scales', title: 'Pick up your comparisons', short: 'Your comparisons', text: `Up to ${COMPARE_MAX} colleges per course, kept on this device.` },
];

// Counts derived from the (illustrative) catalogue only; never user or review numbers.
export const catalogStats = ({ colleges, courses, exams }) => [
  { value: new Set(colleges.map((row) => row.collegeId)).size, label: 'Institutions' },
  { value: colleges.length, label: 'Programmes' },
  { value: courses.length, label: 'Courses' },
  { value: exams.length, label: 'Exam guides' },
];

export const quickTools = [
  { href: '/compare', icon: 'scales', title: 'Compare colleges', text: 'Fees, salaries and demo ratings side by side' },
  { href: '/eligibility', icon: 'eligibility', title: 'Check eligibility', text: 'Match your profile with sample requirements' },
  { href: '/budget', icon: 'wallet', title: 'Plan your budget', text: 'Add tuition, living and one-time costs' },
  { href: '/scholarships', icon: 'cap', title: 'Scholarships', text: 'Explore funding options and portals' },
  { href: '/admission-checklist', icon: 'document', title: 'Admission checklist', text: 'Keep key details ready before applying' },
  { href: '/career-guidance', icon: 'compass', title: 'Career guidance', text: 'Questions to find your direction' },
];

export function readChannel() {
  try { return window.localStorage.getItem(CHANNEL_KEY) === 'phone' ? 'phone' : 'email'; } catch { return 'email'; }
}
export function rememberChannel(channel) {
  try { window.localStorage.setItem(CHANNEL_KEY, channel); } catch { /* storage unavailable */ }
}

// Accepts typed, pasted or autofilled numbers: "+91 98765-43210", "098765 43210", "9876543210".
export function phoneDigits(raw) {
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}
export const formatPhone = (digits) => digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

const emailPattern = /^[^\s@"<>()[\]\\,;:]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
export function validateIdentifier(channel, value) {
  if (channel === 'phone') {
    if (!value) return 'Enter your 10-digit mobile number.';
    return /^[6-9]\d{9}$/.test(value) ? '' : 'Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.';
  }
  const email = value.trim().toLowerCase();
  if (!email) return 'Enter your email address.';
  return email.length <= 254 && emailPattern.test(email) ? '' : 'Enter a valid email address, like name@example.com.';
}

const domainFixes = {
  'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yaho.co.in': 'yahoo.co.in',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outllok.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'redifmail.com': 'rediffmail.com', 'rediffmail.con': 'rediffmail.com',
};
export function emailSuggestion(value) {
  const [local, domain, extra] = value.trim().toLowerCase().split('@');
  return local && domain && extra === undefined && domainFixes[domain] ? `${local}@${domainFixes[domain]}` : '';
}

export function maskIdentifier(channel, identifier) {
  if (channel === 'phone') {
    const digits = identifier.replace(/^\+91/, '');
    return `+91 ${digits.slice(0, 2)}••• ••${digits.slice(-3)}`;
  }
  const [name, domain] = identifier.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function initials(student) {
  const words = (student?.name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  return student?.email ? student.email[0].toUpperCase() : '';
}
export const firstName = (student) => (student?.name || '').trim().split(/\s+/)[0] || '';
export function displayContact(student) {
  if (student?.phone) return `+91 ${formatPhone(student.phone.replace(/^\+91/, ''))}`;
  return student?.email || '';
}

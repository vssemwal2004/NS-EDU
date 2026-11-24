// The staff data-confidentiality undertaking every console user accepts before seeing student data.
//
// The text is a constant on purpose: changing a word is a code change that is reviewed, and bumping
// CONFIDENTIALITY_VERSION asks everyone to read and accept it again (their old acceptance stays on record
// in the audit log). The frontend shows exactly this text from GET /api/admin/auth/confidentiality.
//
// No database access here, so the rules below are unit-tested without MongoDB.

export const CONFIDENTIALITY_VERSION = '2026-11-v1';
export const CONFIDENTIALITY_CODE = 'CONFIDENTIALITY_REQUIRED';

export const CONFIDENTIALITY_TITLE = 'Student data confidentiality undertaking';
export const CONFIDENTIALITY_INTRO = 'Students and their families trust us with their names, phone numbers and plans. Before you open the console, read and accept these points. They apply to every lead, student and record you can see here.';
export const CONFIDENTIALITY_POINTS = [
  'I will use a student’s details only to guide that student with their own admission, course and university questions, and for nothing else.',
  'I will not copy, photograph, screenshot, download, export, print, forward or share any student’s details outside this console: not to my own phone, personal email or WhatsApp, not to friends, and not to any other company or institution.',
  'I will contact students only through the organisation’s channels and only about their own enquiry. I will never contact them for personal, business or any other reasons, including after I leave.',
  'I will never ask a student or their family for money, gifts or any payment, and I will never promise a seat, scholarship or result.',
  'I will open only the records I need for my work, keep my password to myself, never let anyone else use my account, and sign out or lock my device when I step away.',
  'I will report a suspected leak, a lost or stolen device, or anyone misusing student data to my manager or the owner immediately.',
  'I understand that every record I open, every contact I reveal and every download is logged and can be reviewed.',
  'I understand that breaking this undertaking can lead to immediate termination of my employment and to civil and criminal action under Indian law, including the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000. These duties continue after my employment ends.',
];

/** The full text as the API returns it. */
export const confidentialityText = () => ({
  version: CONFIDENTIALITY_VERSION, title: CONFIDENTIALITY_TITLE, intro: CONFIDENTIALITY_INTRO, points: CONFIDENTIALITY_POINTS,
});

const isOwner = (admin) => Boolean(admin?.isOwner ?? admin?.role === 'admin');

/** Has this person accepted the current version? */
export const hasAcceptedConfidentiality = (admin) => admin?.confidentiality?.version === CONFIDENTIALITY_VERSION;

/** Whether the console should show the undertaking. Owners see it too, so their acceptance is on record. */
export const mustAcceptConfidentiality = (admin) => !hasAcceptedConfidentiality(admin);

/**
 * Whether the API refuses data to this person until they accept. Owners are exempt from the server-side block
 * (never from the dialog): a new version or a bug in this check must never lock the last owner out of the
 * console, for example while suspending an employee who is leaking data.
 */
export const confidentialityEnforced = (admin) => !isOwner(admin) && mustAcceptConfidentiality(admin);

/** The record stored on the staff document when they accept. */
export function confidentialityRecord({ ip = '', userAgent = '', now = new Date() } = {}) {
  return { version: CONFIDENTIALITY_VERSION, acceptedAt: now, ip: String(ip ?? '').slice(0, 64), userAgent: String(userAgent ?? '').slice(0, 300) };
}

/** What the console may show about someone's acceptance (no IP or browser). */
export const confidentialitySummary = (admin) => {
  const record = admin?.confidentiality;
  return {
    version: record?.version ?? null,
    acceptedAt: record?.acceptedAt ?? null,
    current: record?.version === CONFIDENTIALITY_VERSION,
  };
};

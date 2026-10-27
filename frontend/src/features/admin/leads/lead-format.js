import { statusTone } from '@/features/apply/apply-options';

export { statusTone };
export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'applied-to-university', label: 'Applied to university' },
  { value: 'admitted', label: 'Admitted' },
  { value: 'not-interested', label: 'Not interested' },
  { value: 'closed', label: 'Closed' },
];
export const leadStatusLabel = (status) => LEAD_STATUSES.find((item) => item.value === status)?.label || status;
export const LEADS_QUERY_KEY = 'gv-admin-leads-query';
// Everything the list keeps in the URL. `institutionName` only labels the university chip; it is never sent to the API.
export const FILTER_KEYS = [
  'status', 'channel', 'form', 'institution', 'institutionName', 'course', 'state', 'city', 'district', 'class', 'stream',
  'careerField', 'mode', 'range', 'from', 'to', 'assignee', 'q', 'sort', 'limit', 'page', 'cursor', 'dir',
];
export const LEAD_PAGE_SIZES = [25, 50, 100];
export const LEAD_MODES = [{ value: 'quick', label: 'Quick apply' }, { value: 'detailed', label: 'Detailed form' }];
export const isQuick = (item) => item?.mode === 'quick';

// Mirrors backend CHANNEL_LABELS / CLASS_LEVELS / SCHOOL_STREAMS (applications/service.js, schema.js).
export const LEAD_CHANNELS = [
  { value: 'web-apply', label: 'Website apply' },
  { value: 'school-drive', label: 'School drive' },
  { value: 'callback', label: 'Counsellor callback' },
];
export const CLASS_LEVELS = [
  { value: '9', label: 'Class 9' }, { value: '10', label: 'Class 10' }, { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' }, { value: 'passed-12', label: 'Passed Class 12' }, { value: 'other', label: 'Other' },
];
export const SCHOOL_STREAMS = [
  { value: 'pcm', label: 'Science (PCM)' }, { value: 'pcb', label: 'Science (PCB)' }, { value: 'pcmb', label: 'Science (PCMB)' },
  { value: 'commerce', label: 'Commerce' }, { value: 'arts', label: 'Arts / Humanities' }, { value: 'vocational', label: 'Vocational' },
  { value: 'not-decided', label: 'Not decided yet' }, { value: 'other', label: 'Other' },
];
export const DATE_RANGES = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' }, { value: 'month', label: 'This month' },
];
const labelIn = (list, value) => list.find((item) => item.value === value)?.label || value || '';
export const channelOf = (item) => item?.channel || 'web-apply';
export const channelLabel = (value) => labelIn(LEAD_CHANNELS, value || 'web-apply');
export const classLabel = (value) => labelIn(CLASS_LEVELS, value);
export const streamLabel = (value) => labelIn(SCHOOL_STREAMS, value);
export const rangeLabel = (value) => labelIn(DATE_RANGES, value);

const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '—');
// "YYYY-MM-DD" (an IST calendar day) → "5 Oct 2026"; noon UTC keeps it on the same day in IST.
export const formatDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? formatDate(`${value}T12:00:00Z`) : '');
export const formatCount = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : '');
// School-drive and callback leads have an empty preference, so these stay null-safe.
export const courseText = (preference) => [preference?.courseName, preference?.programmeName].filter(Boolean).join(' · ') || 'Not specified';
export const placeText = (item) => [item?.city, item?.state].filter(Boolean).join(', ');
export function answerText(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== '' && item !== null && item !== undefined).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value === null || value === undefined ? '' : String(value);
}

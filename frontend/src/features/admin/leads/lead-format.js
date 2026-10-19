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
export const FILTER_KEYS = ['status', 'q', 'institution', 'institutionName', 'course', 'state', 'from', 'to', 'assignee', 'page'];

const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '—');
export const courseText = (preference) => [preference.courseName, preference.programmeName].filter(Boolean).join(' · ') || 'Not specified';
export const placeText = (item) => [item.city, item.state].filter(Boolean).join(', ');

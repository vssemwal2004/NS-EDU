// Human wording for dates and people. All times are shown in the viewer's own timezone (staff work in IST).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// null/''/undefined mean "no date": new Date(null) would otherwise be the 1970 epoch.
const dateOf = (value) => { if (value === null || value === undefined || value === '') return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** "anita.rawat@example.com" → "Anita Rawat" (staff are listed by email when no display name is stored). */
export const displayName = (value = '') => (value.includes('@') ? value.split('@')[0] : value).split(/[._-]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ') || value;

export const initialsOf = (value = '') => value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

/** "just now", "5 min ago", "3 h ago", "yesterday", "12 Nov" */
export function relativeTime(value, now = new Date()) {
  const date = dateOf(value);
  if (!date) return '';
  const diff = now - date;
  if (diff < 0) return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY && sameDay(date, now)) return `${Math.round(diff / HOUR)} h ago`;
  if (sameDay(date, new Date(now - DAY))) return 'yesterday';
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export const timeOf = (value) => dateOf(value)?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) ?? '';
export const dateTimeOf = (value) => { const date = dateOf(value); return date ? `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${timeOf(date)}` : ''; };

/**
 * How a follow-up date should read and look:
 * overdue → red, today → amber, tomorrow/soon → blue, later → neutral, none → muted.
 */
export function followUpState(value, now = new Date()) {
  const date = dateOf(value);
  if (!date) return { state: 'none', tone: 'neutral', label: 'No follow-up', short: '—' };
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - startOfToday) / DAY);
  if (date < now) {
    const late = Math.max(1, Math.round((now - date) / DAY));
    const label = now - date < DAY ? `Overdue by ${Math.max(1, Math.round((now - date) / HOUR))} h` : `Overdue by ${late} day${late === 1 ? '' : 's'}`;
    return { state: 'overdue', tone: 'bad', label, short: 'Overdue' };
  }
  if (days === 0) return { state: 'today', tone: 'warn', label: `Today, ${timeOf(date)}`, short: `Today ${timeOf(date)}` };
  if (days === 1) return { state: 'tomorrow', tone: 'info', label: `Tomorrow, ${timeOf(date)}`, short: 'Tomorrow' };
  if (days < 7) return { state: 'soon', tone: 'info', label: `${date.toLocaleDateString('en-IN', { weekday: 'long' })}, ${timeOf(date)}`, short: date.toLocaleDateString('en-IN', { weekday: 'short' }) };
  return { state: 'later', tone: 'neutral', label: dateTimeOf(date), short: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
}

export const formatNumber = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : '—');
export const formatPercent = (value) => (typeof value === 'number' ? `${Number.isInteger(value) ? value : value.toFixed(1)}%` : '—');
export const formatHours = (value) => {
  if (typeof value !== 'number') return '—';
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 48) return `${value.toFixed(value < 10 ? 1 : 0)} h`;
  return `${(value / 24).toFixed(1)} days`;
};

/** A <input type="datetime-local"> value (local time) for a Date, default one working hour ahead. */
export function localInputValue(date = new Date(Date.now() + HOUR)) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Turns a datetime-local value into an ISO string the API accepts. */
export const isoFromLocalInput = (value) => (value ? new Date(value).toISOString() : '');
/** Quick follow-up presets: label → Date. */
export function followUpPresets(now = new Date()) {
  const at = (days, hour = 10) => { const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0); return date; };
  return [
    { key: 'in-2h', label: 'In 2 hours', date: new Date(now.getTime() + 2 * HOUR) },
    { key: 'tomorrow', label: 'Tomorrow 10 am', date: at(1) },
    { key: 'in-3d', label: 'In 3 days', date: at(3) },
    { key: 'next-week', label: 'Next week', date: at(7) },
  ];
}

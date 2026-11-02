'use client';
// Quiet value renderers shared by the lead screens (list, Lead 360, board, My day, bin): plain text instead of pills,
// so a row carries at most one pill (the temperature). Colour only where it means something (overdue, due today).
import Icon from '@/components/ui/Icon';
import { Avatar } from '@/features/admin/crm/ui';
import { PRIORITIES } from '@/features/admin/crm/meta';
import { dateTimeOf, followUpState } from '@/features/admin/crm/format';
import styles from './LeadBits.module.css';

const dateOf = (value) => { if (value === null || value === undefined || value === '') return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };

/** "31 Oct, 4:05 pm" (the year only when it is not this year). Empty string for no date. */
export function formatWhen(value, { time = true } = {}) {
  const date = dateOf(value);
  if (!date) return '';
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  return time ? `${day}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : day;
}

/** A muted "—" for a missing value; `title` says what is missing. */
export function Dash({ title }) {
  return <span className={styles.dash} title={title}>—</span>;
}

/** Next follow-up as text: red "Overdue" / amber "Today 4 pm" with an icon, otherwise the plain date. */
export function FollowUpText({ at, closed = false }) {
  if (closed) return <Dash title="Closed leads have no follow-ups" />;
  const info = followUpState(at);
  if (info.state === 'none') return <Dash title="No follow-up booked" />;
  const urgent = info.state === 'overdue' || info.state === 'today';
  return <span className={`crm-tone ${styles.follow}`} data-tone={urgent ? info.tone : undefined} data-urgent={urgent || undefined} title={`${info.label} · ${dateTimeOf(at)}`}>
    {urgent && <Icon name={info.state === 'overdue' ? 'alert' : 'clock'} />}
    <span>{info.state === 'overdue' ? 'Overdue' : info.state === 'today' ? info.short : formatWhen(at)}</span>
  </span>;
}

/** High / Urgent as a small icon + word; Normal and Low read as a dash (they need no attention). */
export function PriorityText({ priority, dash = true }) {
  const config = PRIORITIES[priority];
  if (!config || priority === 'normal' || priority === 'low') return dash ? <Dash title={`${config?.label ?? 'Normal'} priority`} /> : null;
  return <span className={`crm-tone ${styles.priority}`} data-tone={config.tone} title={`${config.label} priority`}><Icon name={config.icon} />{config.label}</span>;
}

/** 20px avatar + name. */
export function Person({ name, email, extra = 0, title }) {
  const label = name || email || 'Staff';
  return <span className={styles.person} title={title ?? label}>
    <Avatar name={name} email={email} size={20} /><span className={styles.personName}>{label}</span>{extra > 0 && <small>+{extra}</small>}
  </span>;
}

/** Stage as a small dot + word. */
export function StageDot({ label, tone }) {
  return <span className={`crm-tone ${styles.stage}`} data-tone={tone}><i aria-hidden="true" />{label}</span>;
}

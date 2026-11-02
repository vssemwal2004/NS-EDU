'use client';
// Small pieces shared by the catalogue screens (/admin/[resource]) and the data pipeline (/admin/data/*).
import { useEffect, useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Catalogue.module.css';

/** `value` after it has stopped changing for `delay` ms (search boxes). */
export function useDebounced(value, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function SearchBox({ value, onChange, label, placeholder, maxLength = 120 }) {
  const id = useId();
  return <div className={styles.search}>
    <label htmlFor={id} className="sr-only">{label}</label>
    <Icon name="search" />
    <input id={id} type="search" className="adm-input" value={value} placeholder={placeholder ?? `${label}…`} maxLength={maxLength} autoComplete="off"
      onChange={(event) => onChange(event.target.value)} />
  </div>;
}

/** A labelled <select>; the label is for screen readers, the "all" option names the filter for everyone else. */
export function FilterSelect({ label, value, onChange, options, allLabel }) {
  const id = useId();
  return <div className={styles.filter}>
    <label htmlFor={id} className="sr-only">{label}</label>
    <select id={id} className="adm-select" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{allLabel ?? `Any ${label.toLowerCase()}`}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}

/** Sticky bar shown while rows are selected. Children are the bulk action buttons. */
export function BulkBar({ count, children, onClear }) {
  return <div className={styles.bulk} role="region" aria-label="Bulk actions">
    <strong className="crm-tabnum">{count.toLocaleString('en-IN')} selected</strong>
    <div className={styles.bulkActions}>{children}</div>
    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onClear}>Clear selection</button>
  </div>;
}

/** Empty list: one muted line (extra words go into a tooltip) and at most one secondary action. */
export function EmptyState({ title, children, action }) {
  return <div className={styles.state} title={typeof children === 'string' ? children : undefined}>
    <span>{title}</span>
    {action}
  </div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className={styles.state} role="alert">
    <Icon name="alert" />
    <span>Could not load this: {message}</span>
    {onRetry && <button type="button" className="adm-btn adm-btn--sm" onClick={onRetry}><Icon name="refresh" />Try again</button>}
  </div>;
}

/** Status in a table cell: a small coloured dot and a word (the word carries the meaning, not the colour). */
export function StatusDot({ tone = 'neutral', children, title }) {
  return <span className={`crm-tone ${styles.status}`} data-tone={tone} title={title}><span className={styles.statusDot} aria-hidden="true" />{children}</span>;
}

/** "Label: value" rows for drawers and readouts — label left and muted, value right. rows: [[label, value]] */
export function Facts({ rows, className }) {
  return <dl className={[styles.facts, className].filter(Boolean).join(' ')}>
    {rows.filter(Boolean).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? <span className={styles.muted}>—</span>}</dd></div>)}
  </dl>;
}

/** Placeholder fields while a record loads into an editor. */
export function FormSkeleton({ rows = 6 }) {
  return <div className={styles.loadingForm} role="status" aria-label="Loading the record">
    {Array.from({ length: rows * 2 }, (_, index) => <span key={index} />)}
  </div>;
}

const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDay = (value) => (value ? dateTime.format(new Date(value)) : '—');

// "31 Oct, 4:05 pm" (with the year only when it is not this year), in India time. Tables use this; relative
// times ("2 h ago") are for activity feeds only.
const IST = 'Asia/Kolkata';
const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
const dayMonthYear = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const yearOf = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: IST });
export function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = (yearOf.format(date) === yearOf.format(new Date()) ? dayMonth : dayMonthYear).format(date);
  return `${day}, ${clock.format(date).toLowerCase()}`;
}
export const plural = (count, one, many = `${one}s`) => `${Number(count ?? 0).toLocaleString('en-IN')} ${count === 1 ? one : many}`;

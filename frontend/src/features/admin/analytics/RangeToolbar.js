'use client';
import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { relativeTime } from '@/features/admin/crm/format';
import { PageToolbar } from '@/features/admin/ui/Page';
import { cx, isDay, useTick } from './shared';
import styles from './Analytics.module.css';

const LABELS = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
const DAY_MS = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

/**
 * The one filter row every analytics screen starts with:
 *   summary · [7 days | 30 days | 90 days | Custom] · person select (where allowed)      Updated x ago · Refresh
 * `value` is { range } or { from, to }; `onChange` receives the same shape (the person is kept by the caller).
 * `range` ({ from, to } from the API) pre-fills the custom form. Without `maxDays` the Custom option is hidden.
 */
export default function RangeToolbar({ summary, value, onChange, presets = ['7d', '30d', '90d'], maxDays = 366, allowCustom = true, range,
  people, person = '', onPerson, personLabel = 'Everyone in scope', generatedAt, busy = false, onRefresh, children }) {
  useTick();
  const formId = useId();
  const [open, setOpen] = useState(() => allowCustom && !value?.range);
  const [draft, setDraft] = useState(() => ({ from: value?.from ?? '', to: value?.to ?? '' }));
  const [error, setError] = useState('');
  const custom = !presets.includes(value?.range);
  const toggle = () => {
    if (!open && !draft.from && !draft.to && range) setDraft({ from: range.from, to: range.to });
    setOpen(!open);
  };
  const apply = (event) => {
    event.preventDefault();
    const message = !isDay(draft.from) || !isDay(draft.to) ? 'Choose both a start and an end date.'
      : draft.from > draft.to ? 'The start date must be on or before the end date.'
        : (Date.parse(draft.to) - Date.parse(draft.from)) / DAY_MS + 1 > maxDays ? `Choose at most ${maxDays} days.` : '';
    setError(message);
    if (!message) onChange({ from: draft.from, to: draft.to });
  };
  return <>
    <PageToolbar summary={summary} start={<>
      <div className={styles.segmented} role="group" aria-label="Date range">
        {presets.map((preset) => <button key={preset} type="button" aria-pressed={value?.range === preset} onClick={() => { setOpen(false); setError(''); onChange({ range: preset }); }}>{LABELS[preset] ?? preset}</button>)}
        {allowCustom && <button type="button" aria-pressed={custom} aria-expanded={open} aria-controls={formId} onClick={toggle}><Icon name="calendar" />Custom</button>}
      </div>
      {people && onPerson && <select className={cx('adm-select', styles.person)} value={person} onChange={(event) => onPerson(event.target.value)} aria-label="Person">
        <option value="">{personLabel}</option>
        {people.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>}
    </>}>
      {generatedAt && <span className={styles.updated} aria-live="polite"><Icon name="clock" />{busy ? 'Updating…' : `Updated ${relativeTime(generatedAt)}`}</span>}
      {children}
      {onRefresh && <button type="button" className={cx('adm-btn', busy && styles.spin)} onClick={onRefresh} disabled={busy}><Icon name="refresh" />Refresh</button>}
    </PageToolbar>
    {allowCustom && open && <form id={formId} className={styles.custom} onSubmit={apply} noValidate aria-label="Custom date range">
      <label className="adm-label">From<input type="date" className="adm-input" value={draft.from} max={draft.to || istToday()} onChange={(event) => setDraft({ ...draft, from: event.target.value })} aria-invalid={Boolean(error) || undefined} /></label>
      <label className="adm-label">To<input type="date" className="adm-input" value={draft.to} min={draft.from || undefined} max={istToday()} onChange={(event) => setDraft({ ...draft, to: event.target.value })} aria-invalid={Boolean(error) || undefined} /></label>
      <button type="button" className="adm-btn adm-btn--ghost" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary">Apply</button>
      {error ? <p className={styles.customError} role="alert">{error}</p> : <p className={styles.customNote}>Up to {maxDays} days, India time, both days included.</p>}
    </form>}
  </>;
}

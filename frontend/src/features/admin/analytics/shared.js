'use client';
// Helpers shared by the console home and the analytics screens (CRM performance, Lead volume, Search insights).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { toQuery } from '@/features/admin/table/useServerList';
import pageStyles from '@/features/admin/ui/Page.module.css';
import styles from './Analytics.module.css';

export const cx = (...parts) => parts.filter(Boolean).join(' ');
export const n = (value) => (typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN') : '—');
export const pct = (part, whole, digits = 0) => (whole > 0 ? `${((part / whole) * 100).toFixed(digits).replace(/\.0+$/, '')}%` : '—');

const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const asDay = (iso) => new Date(`${iso}T00:00:00Z`);
export const dayShort = (iso) => shortFmt.format(asDay(iso));
export const dayLong = (iso) => longFmt.format(asDay(iso));
/** "2 Oct – 31 Oct" for a { from, to } range of India dates. */
export const rangeText = (range) => (!range ? '' : range.from === range.to ? dayShort(range.from) : `${dayShort(range.from)} – ${dayShort(range.to)}`);
/** TrendChart rows from [{ date|day, count }]. */
export const trendRows = (list = [], key = 'date') => list.map((item) => ({ key: item[key], value: item.count, short: dayShort(item[key]), long: dayLong(item[key]) }));

/** The API lists only days with activity; the chart shows every day of the window (India time), quiet days as 0. */
export function fillDays(list = [], days, now = Date.now()) {
  const counts = new Map(list.map((row) => [row.day, row.count]));
  const today = Date.parse(`${new Date(now + 330 * 60_000).toISOString().slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
}

export const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const first = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim();
const isId = (value) => /^[0-9a-f]{24}$/i.test(value);

/**
 * URL → API params: `{ range }` (a known preset) or `{ from, to }` (India dates), plus an optional `employee` id.
 * Presets beyond the segmented ones (today, month) still load from old links.
 */
export function readRangeParams(source = {}, { presets = ['today', '7d', '30d', '90d', 'month'], fallback = '30d', employee = true } = {}) {
  const range = first(source.range);
  const from = first(source.from); const to = first(source.to);
  const person = first(source.employee);
  const base = presets.includes(range) ? { range } : isDay(from) && isDay(to) && from <= to ? { from, to } : { range: fallback };
  return { ...base, ...(employee && isId(person) ? { employee: person } : {}) };
}

/** Params held in state and mirrored into the URL (default range omitted), so links and reloads keep the view. */
export function useUrlParams(path, initial, fallback = '30d') {
  const router = useRouter();
  const [params, setParams] = useState(initial);
  const choose = useCallback((next) => {
    setParams(next);
    const query = toQuery(next.range === fallback ? { ...next, range: undefined } : next);
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }, [router, path, fallback]);
  return [params, choose];
}

/** Re-renders every `ms` so "Updated 3 min ago" stays true. */
export function useTick(ms = 30_000) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), ms); return () => window.clearInterval(timer); }, [ms]);
}

/** Loading layout: panel-shaped placeholders in the same grid as the final screen. */
export function PanelSkeletons({ spans = ['wide', '', '', '', ''] }) {
  return <div className={styles.grid} aria-busy="true">
    <span className="sr-only" role="status">Loading</span>
    {spans.map((span, index) => <div key={index} className={cx('adm-panel', styles.skeletonPanel, span && styles[span])} aria-hidden="true"><span /><span /><span /></div>)}
  </div>;
}

export function ErrorBanner({ title = 'This view could not load.', message, onRetry }) {
  return <div className={styles.error} role="alert">
    <Icon name="alert" />
    <div><strong>{title}</strong>{message && <p>{message}</p>}</div>
    {onRetry && <button type="button" className="adm-btn adm-btn--sm" onClick={onRetry}><Icon name="refresh" />Retry</button>}
  </div>;
}

/** Panel action that flips a chart to its table view. */
export function TableToggle({ table, onChange }) {
  return <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" aria-pressed={table} onClick={() => onChange(!table)}>
    <Icon name={table ? 'chart' : 'document'} />{table ? 'Chart' : 'Table'}
  </button>;
}

/** A small "View all" style link for a panel header. */
export function PanelLink({ href, children = 'View leads', label }) {
  return <Link className={styles.panelLink} href={href}>{children}{label && <span className="sr-only">: {label}</span>}<Icon name="arrow" /></Link>;
}

/** Empty state: one muted line, plus at most one secondary action. Centres itself in the panel's free space. */
export function Empty({ title, action }) {
  return <div className={styles.empty}><p>{title}</p>{action}</div>;
}

/** The ⓘ hover/focus hint (same look as `Panel description`) for panels that also show a `meta` data line.
 *  Put it first in the meta line: `meta={<><InfoHint text="…" />12 first contacts</>}` (renders "Title ⓘ 12 first contacts"). */
export function InfoHint({ text }) {
  return <span className={cx(pageStyles.hint, styles.infoHint)} tabIndex={0} role="note" aria-label={text} data-tip={text}>i</span>;
}

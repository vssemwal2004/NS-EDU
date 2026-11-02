'use client';
// CRM performance panels: pipeline by stage, lead temperature, lead aging and first response.
// Every widget reads label → value: label left (or above), number right-aligned in tabular digits.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatHours } from '@/features/admin/crm/format';
import { HEATS, OPEN_STAGES, STAGE_ORDER, STAGES } from '@/features/admin/crm/meta';
import { cx, Empty, InfoHint, n, pct, PanelLink, TableToggle, trendRows } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import BarList from '@/features/admin/ui/BarList';
import { Panel } from '@/features/admin/ui/Page';
import TrendChart from '@/features/admin/ui/TrendChart';
import { toQuery } from '@/features/admin/table/useServerList';

/** `/admin/leads?…` for the filtered list; `employee` narrows by assignee when one is picked. */
export const leadsHref = (params = {}, employee = '') => {
  const query = toQuery({ ...params, ...(employee ? { assignee: employee } : {}) });
  return query ? `/admin/leads?${query}` : '/admin/leads';
};
export const OPEN = OPEN_STAGES.join(',');
export const SPEED_HINT = 'First response = time from a lead arriving to its first real conversation. Green up to 4 h, amber up to a day, red slower.';

/** First-response speed: green up to 4 h, amber up to a day, red beyond. */
export function responseTone(hours) {
  if (typeof hours !== 'number') return { tone: 'neutral', icon: 'clock', word: 'No data' };
  if (hours <= 4) return { tone: 'good', icon: 'check', word: 'Fast' };
  if (hours <= 24) return { tone: 'warn', icon: 'clock', word: 'Within a day' };
  return { tone: 'bad', icon: 'alert', word: 'Slow' };
}

/** Status as a small coloured dot + the word (no pill). */
export function StatusWord({ tone, children, title }) {
  return <span className={cx('crm-tone', styles.status)} data-tone={tone} title={title}>{children}</span>;
}

/* ---------- Pipeline: every lead in scope right now, by stage ---------- */
export function StagePanel({ byStatus = [], total = 0, employee }) {
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row.count]));
  const rows = STAGE_ORDER.map((status) => ({ key: status, label: STAGES[status]?.label ?? status, value: counts[status] ?? 0, href: leadsHref({ status }, employee) }));
  return <Panel title="Pipeline by stage" meta={<><InfoHint text="Every lead in scope right now, by its current stage." />{n(total)} leads</>}
    actions={<PanelLink href={leadsHref({}, employee)} label="Pipeline by stage">All leads</PanelLink>}>
    {total ? <BarList label="Leads by stage" rows={rows} total={total} /> : <Empty title="No leads yet" />}
  </Panel>;
}

/* ---------- Lead temperature: one whole split into parts ---------- */
const HEAT_ROWS = [
  { key: 'hot', tone: 'bad' }, { key: 'warm', tone: 'warn' }, { key: 'cold', tone: 'info' }, { key: 'unscored', tone: 'muted', label: 'Not scored', hint: 'No score yet' },
];

export function TemperaturePanel({ heat = [], employee }) {
  const counts = Object.fromEntries(heat.map((item) => [item.key, item.count]));
  const rows = HEAT_ROWS.filter((row) => row.key !== 'unscored' || counts.unscored > 0)
    .map((row) => ({ ...row, label: row.label ?? HEATS[row.key]?.label, hint: row.hint ?? HEATS[row.key]?.hint, count: counts[row.key] ?? 0 }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <Panel title="Lead temperature" meta={<><InfoHint text="Open leads right now, by how likely they are to convert. Hover a row for what it means." />{n(total)} open</>}>
    {!total ? <Empty title="No open leads" /> : <>
      <div className={styles.parts} role="img" aria-label={`Open leads by temperature: ${rows.map((row) => `${row.label} ${n(row.count)} (${pct(row.count, total)})`).join(', ')}`}>
        {rows.filter((row) => row.count > 0).map((row) => <span key={row.key} className={cx('crm-tone', styles.part)} data-tone={row.tone}
          style={{ flexGrow: row.count, flexBasis: 0 }} title={`${row.label}: ${n(row.count)} (${pct(row.count, total)})`} />)}
      </div>
      <ul className={styles.legend}>
        {rows.map((row) => {
          const body = <>
            <span className={cx('crm-tone', styles.key)} data-tone={row.tone} aria-hidden="true" />
            <span>{row.label}</span>
            <strong>{n(row.count)}</strong>
            <em>{pct(row.count, total)}</em>
          </>;
          return <li key={row.key}>{row.key === 'unscored'
            ? <div className={styles.legendRow} title={row.hint}>{body}</div>
            : <Link className={styles.legendRow} href={leadsHref({ heat: row.key, status: OPEN }, employee)} title={`${row.label}: ${row.hint}`}>{body}</Link>}</li>;
        })}
      </ul>
    </>}
  </Panel>;
}

/* ---------- Lead aging: open leads by time since the last activity ---------- */
export function AgingPanel({ aging = [], employee }) {
  const total = aging.reduce((sum, bucket) => sum + bucket.count, 0);
  const stale = aging.filter((bucket) => Number(bucket.key) >= 14).reduce((sum, bucket) => sum + bucket.count, 0);
  return <Panel title="Lead aging" meta={<><InfoHint text="Open leads with activity, by time since the last call, message or note. Over 2 weeks shows in amber." />{n(total)} open</>}>
    {!total ? <Empty title="No open leads with activity yet" /> : <>
      <BarList label="Open leads by time since last activity" unit="open leads" total={total}
        rows={aging.map((bucket) => ({ key: bucket.key, label: bucket.label, value: bucket.count, tone: Number(bucket.key) >= 14 && bucket.count > 0 ? 'warn' : undefined }))} />
      {stale > 0
        ? <Link className={cx('crm-tone', styles.callout)} data-tone="warn" href={leadsHref({ idle: 14 }, employee)}><Icon name="alert" /><span><strong>{n(stale)}</strong> untouched for over 2 weeks</span><Icon name="arrow" /></Link>
        : <p className={cx('crm-tone', styles.callout)} data-tone="good"><Icon name="check" /><span>None untouched for over 2 weeks</span></p>}
    </>}
  </Panel>;
}

/* ---------- First response ---------- */
const percentText = (value) => (typeof value === 'number' ? `${value}%` : '—');

export function ResponsePanel({ kpis = {}, trend }) {
  const [table, setTable] = useState(false);
  const speed = responseTone(kpis.avgResponseHours);
  const rows = trendRows((trend?.days ?? []).map((day, index) => ({ date: day, count: trend.firstContacts?.[index] ?? 0 })));
  const firsts = rows.reduce((sum, row) => sum + row.value, 0);
  const hasAverage = typeof kpis.avgResponseHours === 'number';
  return <Panel className={styles.wide} title="Response time" meta={<><InfoHint text={SPEED_HINT} />{n(firsts)} first contacts in this range</>}
    actions={firsts > 0 && <TableToggle table={table} onChange={setTable} />}>
    <dl className={cx(styles.figures, styles.figuresRule)}>
      <div><dt>Avg first response</dt><dd>{formatHours(kpis.avgResponseHours)}{hasAverage && <StatusWord tone={speed.tone}>{speed.word}</StatusWord>}</dd></div>
      <div title="Share of contacted leads that were reached within 24 hours"><dt>Contacted within 24 h</dt><dd>{percentText(kpis.within24Rate)}</dd></div>
      <div title="Share of this range’s new leads that have been contacted"><dt>Contact rate</dt><dd>{percentText(kpis.contactRate)}</dd></div>
    </dl>
    {firsts > 0 ? <>
      {!table && <p className={styles.chartLabel}>First contacts per day</p>}
      <TrendChart data={rows} title="First contacts per day" valueLabel="First contacts" height={170} table={table} />
    </> : <Empty title="No first contacts in this range" />}
  </Panel>;
}

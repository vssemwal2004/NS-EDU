'use client';
import { useState } from 'react';
import { Empty, fillDays, InfoHint, n, TableToggle, trendRows } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { Panel } from '@/features/admin/ui/Page';
import TrendChart from '@/features/admin/ui/TrendChart';

const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`);

/**
 * Cookie decisions and estimated visitors (GET /api/admin/insights/consent). Decisions are anonymous rows;
 * "visitors who accepted" are distinct personalisation ids in the activity log; the estimate scales that by the
 * acceptance rate and is labelled as an estimate everywhere it appears.
 */
export default function ConsentPanel({ data, className }) {
  const [table, setTable] = useState(false);
  const accepted = data?.totals?.all ?? 0;
  const essential = data?.totals?.essential ?? 0;
  const decisions = data?.decisions ?? 0;
  const daily = data?.days ? trendRows(fillDays((data.daily ?? []).map((row) => ({ day: row.day, count: row.all + row.essential })), data.days), 'day') : [];
  const parts = [
    { key: 'all', label: 'Accepted all', hint: 'Personalised; activity is recorded', count: accepted, tone: 'accent' },
    { key: 'essential', label: 'Essential only', hint: 'Never tracked', count: essential, tone: 'muted' },
  ];
  const hint = `Each decision is one anonymous row, kept 400 days. Estimated visitors ≈ visitors who accepted (${n(data?.trackedVisitors)}) ÷ acceptance rate (${percent(data?.acceptanceRate)}).`;
  return <Panel className={className} title="Cookie choices" meta={<><InfoHint text={hint} />{n(decisions)} decisions · {n(data?.changed)} changed</>} actions={decisions > 0 && <TableToggle table={table} onChange={setTable} />}>
    {!decisions ? <Empty title="No cookie decisions in this window" /> : <>
      <div className={styles.parts} role="img" aria-label={`${percent(accepted / decisions)} accepted all, ${percent(essential / decisions)} chose essential only`}>
        {parts.filter((part) => part.count > 0).map((part) => <span key={part.key} className={styles.part} data-tone={part.tone} style={{ flexGrow: part.count, flexBasis: 0 }}
          title={`${part.label}: ${n(part.count)} (${percent(part.count / decisions)})`} />)}
      </div>
      <ul className={styles.legend}>
        {parts.map((part) => <li key={part.key}><div className={styles.legendRow} title={part.hint}>
          <span className={styles.key} data-tone={part.tone} aria-hidden="true" />
          <span>{part.label}</span>
          <strong>{n(part.count)}</strong><em>{percent(part.count / decisions)}</em>
        </div></li>)}
      </ul>
      <div className={styles.chartBlock}>
        {!table && <p className={styles.chartLabel}>Decisions per day</p>}
        <TrendChart data={daily} title="Cookie decisions per day" valueLabel="Decisions" height={140} table={table} />
      </div>
    </>}
  </Panel>;
}

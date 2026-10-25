'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { ColumnChart } from '../BarChart';
import dash from '../Dashboard.module.css';
import styles from './Insights.module.css';

const count = (value) => (value ?? 0).toLocaleString('en-IN');
const percent = (value) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`);
const dayShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });

// Cookie decisions and estimated visitors (GET /api/admin/insights/consent). Decisions are anonymous
// rows; "visitors who accepted" are distinct personalisation ids in the activity log; the estimate
// scales that by the acceptance rate and is labelled as an estimate everywhere it appears.
export default function ConsentPanel({ days }) {
  const { request } = useAdminSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request(`/insights/consent?days=${days}`, { signal: controller.signal })
      .then((value) => { setData(value); setError(''); })
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [days, request]);

  if (error) return <section className={dash.card}><p className={styles.muted}>{error}</p></section>;
  const ready = data && data.days === days;
  const accepted = data?.totals?.all ?? 0;
  const essential = data?.totals?.essential ?? 0;
  const daily = (data?.daily ?? []).map((row) => ({ label: row.day, value: row.all + row.essential }));
  const formatDay = (item, size) => (size === 'short' ? dayShort : dayLong).format(new Date(`${item.label}T00:00:00Z`));

  return <section className={dash.card} aria-labelledby="consent-title" aria-busy={!ready}>
    <header className={dash.cardHeader}>
      <div><h3 id="consent-title">Cookies &amp; visits</h3><p>How visitors answered the cookie banner, and an estimate of how many visited</p></div>
    </header>

    <div className={styles.tiles}>
      <div className={styles.tile}><span>Estimated visitors</span><strong>{ready ? (data.estimatedVisitors === null ? '—' : `≈ ${count(data.estimatedVisitors)}`) : '…'}</strong>
        <small>{ready && data.estimatedVisitors === null ? 'Needs at least one “Accept all”' : `${count(data?.trackedVisitors)} who accepted ÷ ${percent(data?.acceptanceRate)} acceptance`}</small></div>
      <div className={styles.tile}><span>Cookie decisions</span><strong>{ready ? count(data.decisions) : '…'}</strong><small>{count(data?.changed)} changed an earlier choice</small></div>
      <div className={styles.tile}><span>Accepted all</span><strong>{ready ? percent(data.acceptanceRate) : '…'}</strong><small>{count(accepted)} visitors · personalised</small></div>
      <div className={styles.tile}><span>Essential only</span><strong>{ready ? percent(data.decisions ? essential / data.decisions : null) : '…'}</strong><small>{count(essential)} visitors · not tracked</small></div>
    </div>

    {ready && data.decisions > 0 && <div className={styles.split} role="img" aria-label={`${percent(data.acceptanceRate)} accepted all, ${percent(essential / data.decisions)} chose essential only`}>
      <span style={{ flexGrow: accepted }} data-kind="all" />
      <span style={{ flexGrow: essential }} data-kind="essential" />
    </div>}

    <h4 className={styles.subhead}>Decisions per day</h4>
    {daily.length ? <ColumnChart data={daily} label={`Cookie decisions per day over the last ${days} days`} formatLabel={formatDay} height={160} />
      : <p className={styles.muted}>{ready ? 'No cookie decisions in this window yet.' : 'Loading…'}</p>}

    <p className={styles.method}><Icon name="uniInfo" />
      Each decision is one anonymous row (the choice and the time — no visitor id, IP address or browser details), kept 400 days.
      Visitors who choose “Essential only” are never tracked, so they are counted only through the estimate.
    </p>
  </section>;
}

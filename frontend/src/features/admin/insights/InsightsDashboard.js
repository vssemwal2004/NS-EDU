'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { ColumnChart, RankedBars } from '../BarChart';
import ConsentPanel from './ConsentPanel';
import dash from '../Dashboard.module.css';
import styles from './Insights.module.css';

const WINDOWS = [7, 30, 90];
const PAGE_SIZE = 20;
const dayShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const count = (value) => (value ?? 0).toLocaleString('en-IN');
const bars = (rows, limit = 8) => rows.slice(0, limit).map((row) => ({ label: row.value, value: row.count }));

export default function InsightsDashboard() {
  const { request } = useAdminSession();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [page, setPage] = useState(1);
  const [searches, setSearches] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    request(`/insights/overview?days=${days}`, { signal: controller.signal })
      .then((value) => { setData(value); setError(''); })
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [days, request]);

  useEffect(() => {
    const controller = new AbortController();
    request(`/insights/searches?days=${days}&page=${page}&limit=${PAGE_SIZE}${onlyGaps ? '&noResults=true' : ''}`, { signal: controller.signal })
      .then(setSearches).catch(() => {});
    return () => controller.abort();
  }, [days, onlyGaps, page, request]);

  if (error) return <div className={dash.errorCard} role="alert"><Icon name="shield" /><p>{error}</p></div>;

  const loading = !data || data.days !== days;
  const daily = (data?.dailyStudents ?? []).map((row) => ({ label: row.day, value: row.count }));
  const formatDay = (item, size) => (size === 'short' ? dayShort : dayLong).format(new Date(`${item.label}T00:00:00Z`));
  const pages = Math.max(1, Math.ceil((searches?.total ?? 0) / PAGE_SIZE));

  return <div className={styles.page} aria-busy={loading}>
    <div className={styles.intro}>
      <p className={styles.privacy}><Icon name="shield" />
        This activity is collected only from visitors who chose “Accept all” in the cookie banner, to improve search
        results and university recommendations. It is visible to administrators only. Searches, filters and the
        universities opened are stored — never IP addresses, browsers or full web addresses — and rows are deleted
        automatically after {data?.retentionDays ?? 180} days.
      </p>
      <div className={styles.windows} role="group" aria-label="Time window">
        {WINDOWS.map((value) => <button key={value} type="button" className={styles.window} aria-pressed={days === value}
          onClick={() => { setDays(value); setPage(1); }}>Last {value} days</button>)}
      </div>
    </div>

    <section className={styles.tiles} aria-label="Key figures">
      {[
        { label: 'Events', value: data?.total, note: `${count(data?.byType?.find((row) => row.value === 'search')?.count)} searches` },
        { label: 'From signed-in students', value: data?.fromSignedIn, note: 'Linked to a student account' },
        { label: 'From visitors', value: data?.fromVisitors, note: 'Not signed in' },
        { label: 'Searches with no results', value: data?.noResults?.reduce((sum, row) => sum + row.count, 0), note: 'Gaps in the directory', tone: 'warning' },
      ].map((tile) => <div key={tile.label} className={styles.tile} data-tone={tile.tone}>
        <span>{tile.label}</span><strong>{data ? count(tile.value) : '…'}</strong><small>{tile.note}</small>
      </div>)}
    </section>

    <ConsentPanel days={days} />

    <div className={styles.row}>
      <section className={dash.card} aria-labelledby="active-title">
        <header className={dash.cardHeader}><div><h3 id="active-title">Daily active students</h3><p>Signed-in students who searched or opened a university</p></div></header>
        {daily.length ? <ColumnChart data={daily} label={`Daily active students over the last ${days} days`} formatLabel={formatDay} />
          : <p className={styles.muted}>No signed-in activity in this window yet.</p>}
      </section>
      <section className={dash.card} aria-labelledby="viewed-title">
        <header className={dash.cardHeader}><div><h3 id="viewed-title">Most viewed universities</h3><p>Profile opens</p></div></header>
        {data?.topViewed?.length ? <ul className={styles.list}>{data.topViewed.slice(0, 10).map((row) => <li key={row.slug}>
          <Link href={`/admin/institutions?q=${encodeURIComponent(row.name)}`}>{row.name}</Link>
          <small>{row.place}</small><strong>{count(row.count)}</strong>
        </li>)}</ul> : <p className={styles.muted}>{data ? 'No profile views in this window.' : 'Loading…'}</p>}
      </section>
    </div>

    <div className={styles.row}>
      <section className={dash.card} aria-labelledby="states-title">
        <header className={dash.cardHeader}><div><h3 id="states-title">Where students are looking</h3><p>States and cities in searches and filters</p></div></header>
        {data?.states?.length ? <RankedBars data={bars(data.states)} /> : <p className={styles.muted}>{data ? 'No state signal yet.' : 'Loading…'}</p>}
        {data?.cities?.length > 0 && <><h4 className={styles.subhead}>Cities</h4><RankedBars data={bars(data.cities)} /></>}
      </section>
      <section className={dash.card} aria-labelledby="streams-title">
        <header className={dash.cardHeader}><div><h3 id="streams-title">Streams and courses in demand</h3><p>From filters and the apply flow</p></div></header>
        {data?.streams?.length ? <RankedBars data={bars(data.streams)} /> : <p className={styles.muted}>{data ? 'No stream signal yet.' : 'Loading…'}</p>}
        {data?.courses?.length > 0 && <><h4 className={styles.subhead}>Courses</h4><RankedBars data={bars(data.courses)} /></>}
      </section>
    </div>

    <section className={dash.card} aria-labelledby="searches-title">
      <header className={dash.cardHeader}>
        <div><h3 id="searches-title">{onlyGaps ? 'Searches that found nothing' : 'Top searches'}</h3>
          <p>{onlyGaps ? 'Content gaps: what students look for and the directory does not have' : 'What students typed, case-folded'} · {count(searches?.total)} distinct</p></div>
        <button type="button" className={dash.linkButton} onClick={() => { setOnlyGaps(!onlyGaps); setPage(1); }}>
          {onlyGaps ? 'Show all searches' : 'Show only no-result searches'}
        </button>
      </header>
      {searches?.items?.length ? <table className={dash.table}>
        <thead><tr><th scope="col">Search</th><th scope="col">Times</th><th scope="col">Last seen</th><th scope="col" /></tr></thead>
        <tbody>{searches.items.map((row) => <tr key={row.query}>
          <td>{row.query}</td><td>{count(row.count)}</td><td>{row.lastAt ? dateTime.format(new Date(row.lastAt)) : '—'}</td>
          <td><Link className={dash.linkButton} href={`/admin/institutions?q=${encodeURIComponent(row.query)}`}>Check catalogue</Link></td>
        </tr>)}</tbody>
      </table> : <p className={styles.muted}>{searches ? (onlyGaps ? 'Every search in this window returned results.' : 'No searches in this window.') : 'Loading…'}</p>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination">
        <span>Page {page} of {pages}</span>
        <div>
          <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className={styles.pageButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </nav>}
    </section>

    <p className={styles.footnote}>
      Open a student from <Link href="/admin/students">Student accounts</Link> or a lead from <Link href="/admin/leads">Leads</Link> to see that
      student’s own search and view history at <code>/admin/insights/students/&lt;id&gt;</code>.
    </p>
  </div>;
}

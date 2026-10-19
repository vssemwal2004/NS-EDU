'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import dash from '../Dashboard.module.css';
import styles from './Insights.module.css';

const PAGE_SIZE = 25;
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const TYPES = [['', 'All activity'], ['search', 'Searches'], ['view', 'Profile views'], ['filter', 'Filters'], ['compare', 'Comparisons'], ['apply-open', 'Apply opened']];

const context = (row) => [row.city, row.state, row.stream, row.courseSlug].filter(Boolean).join(' · ');

/** One student's own search and view history, newest first. Administrators only. */
export default function StudentActivity({ id }) {
  const { request } = useAdminSession();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request(`/insights/students/${encodeURIComponent(id)}?page=${page}&limit=${PAGE_SIZE}${type ? `&type=${type}` : ''}`, { signal: controller.signal })
      .then((value) => { setData(value); setError(''); })
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [id, page, request, type]);

  if (error) return <div className={dash.errorCard} role="alert"><Icon name="shield" /><p>{error}</p><Link className="button button--outline" href="/admin/insights">Back to insights</Link></div>;

  const student = data?.student;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return <div className={styles.page} aria-busy={!data || data.page !== page}>
    <div className={styles.header}>
      <div>
        <Link className={styles.back} href="/admin/insights"><Icon name="arrow" />Search insights</Link>
        <h2>{student?.name || student?.email || student?.phone || 'Student activity'}</h2>
        <p>{[student?.email, student?.phone].filter(Boolean).join(' · ') || '—'} · {(data?.total ?? 0).toLocaleString('en-IN')} recorded events</p>
      </div>
      <label className={styles.back} htmlFor="activity-type">
        <span className="sr-only">Filter by activity</span>
        <select id="activity-type" className={styles.window} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>

    <p className={styles.privacy}><Icon name="shield" />
      Collected to improve this student’s search results and recommendations. Visible to administrators only, and
      deleted automatically after 180 days. No IP address, browser or full web address is stored.
    </p>

    <section className={dash.card} aria-labelledby="activity-title">
      <header className={dash.cardHeader}><div><h3 id="activity-title">Activity</h3><p>Newest first</p></div>
        <Link className={dash.linkButton} href={`/admin/leads?q=${encodeURIComponent(student?.email || '')}`}>Leads from this student</Link>
      </header>
      {data?.items?.length ? <table className={dash.table}>
        <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Details</th><th scope="col">Results</th></tr></thead>
        <tbody>{data.items.map((row) => <tr key={row.id}>
          <td>{dateTime.format(new Date(row.at))}</td>
          <td><span className={styles.kind} data-type={row.type}>{row.type}</span></td>
          <td>
            <strong>{row.query || row.institutionName || row.institutionSlug || context(row) || '—'}</strong>
            {(row.query || row.institutionName) && context(row) ? <small>{context(row)}</small> : null}
          </td>
          <td>{row.type === 'search' && row.results !== null ? <span className={row.results === 0 ? styles.zero : undefined}>{row.results}</span> : '—'}</td>
        </tr>)}</tbody>
      </table> : <p className={styles.muted}>{data ? 'No activity recorded for this student yet.' : 'Loading…'}</p>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination">
        <span>Page {page} of {pages}</span>
        <div>
          <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className={styles.pageButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </nav>}
    </section>
  </div>;
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { Empty, ErrorBanner, n } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { useServerList } from '@/features/admin/table/useServerList';
import { PageToolbar, Panel } from '@/features/admin/ui/Page';

const PAGE_SIZE = 25;
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const TYPES = [['', 'All activity'], ['search', 'Searches'], ['view', 'Profile views'], ['filter', 'Filters'], ['compare', 'Comparisons'], ['apply-open', 'Apply opened']];
const TYPE_LABEL = { search: 'Search', view: 'Profile view', filter: 'Filter', compare: 'Comparison', 'apply-open': 'Apply opened' };
const context = (row) => [row.city, row.state, row.stream, row.courseSlug].filter(Boolean).join(' · ');

/** One student's own search and view history, newest first. */
export default function StudentActivity({ id }) {
  const { admin, request } = useAdminSession();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const { data, error, loading, busy, reload } = useServerList(request, `/insights/students/${encodeURIComponent(id)}`, { page, limit: PAGE_SIZE, type }, { scope: admin?.id ?? '' });
  const student = data?.student;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const who = student?.name || student?.email || student?.phone || 'Student';

  return <div className={styles.page}>
    <PageToolbar summary={<><Link className={`${styles.panelLink} ${styles.back}`} href="/admin/insights"><Icon name="arrow" />Search insights</Link>{student && <> · <strong>{who}</strong>{[student.email, student.phone].filter((value) => value && value !== who).map((value) => ` · ${value}`)} · {n(data.total)} events</>}</>}>
      <select className={`adm-select ${styles.person}`} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Activity type">
        {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {student?.email && <Link className="adm-btn" href={`/admin/leads?q=${encodeURIComponent(student.email)}`}><Icon name="eligibility" />Leads from this student</Link>}
    </PageToolbar>
    {error && !data ? <ErrorBanner title="This student’s activity could not load." message={error} onRetry={reload} /> : <>
      <Panel title="Activity" description="Newest first · kept 180 days" flush>
        {loading || !data ? <div className={styles.skeletonPanel} aria-hidden="true"><span /><span /><span /></div>
          : data.items?.length ? <div className={styles.tableWrap} role="region" aria-label="Activity" tabIndex={0} data-busy={busy || undefined}>
            <table className={styles.table}>
              <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Details</th><th scope="col" data-num="">Results</th></tr></thead>
              <tbody>{data.items.map((row) => <tr key={row.id}>
                <td>{dateTime.format(new Date(row.at))}</td>
                <td>{TYPE_LABEL[row.type] ?? row.type}</td>
                <td className={styles.truncate} title={[row.query || row.institutionName || row.institutionSlug, context(row)].filter(Boolean).join(' · ')}>
                  {row.query || row.institutionName || row.institutionSlug || context(row) || '—'}
                  {(row.query || row.institutionName) && context(row) ? <small>{context(row)}</small> : null}
                </td>
                <td data-num="">{row.type === 'search' && row.results !== null && row.results !== undefined
                  ? row.results === 0 ? <span className={styles.warnText}>0 · no results</span> : n(row.results) : '—'}</td>
              </tr>)}</tbody>
            </table>
          </div> : <Empty title="No activity recorded for this student yet" />}
        {pages > 1 && <nav className={styles.pager} aria-label="Activity pages">
          <span>Page {page} of {n(pages)}</span>
          <div>
            <button type="button" className="adm-btn adm-btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button type="button" className="adm-btn adm-btn--sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </nav>}
      </Panel>
      <p className={styles.privacy}><Icon name="shield" /><span>Collected to improve this student’s search results and recommendations. Visible to staff with search insights access; deleted after 180 days. No IP address, browser or full web address is stored.</span></p>
    </>}
  </div>;
}

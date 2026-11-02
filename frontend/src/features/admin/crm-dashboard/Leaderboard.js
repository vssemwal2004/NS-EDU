'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { displayName, formatHours } from '@/features/admin/crm/format';
import { Empty, InfoHint, n } from '@/features/admin/analytics/shared';
import styles from '@/features/admin/analytics/Analytics.module.css';
import { Panel } from '@/features/admin/ui/Page';
import { leadsHref, responseTone, SPEED_HINT, StatusWord } from './PipelinePanels';

const COLUMNS = [
  { key: 'rank', label: '#', sort: (row) => row.rank, dir: 'asc', num: true },
  { key: 'person', label: 'Person', sort: (row) => displayName(row.email).toLowerCase(), dir: 'asc' },
  { key: 'leads', label: 'Leads', sort: (row) => row.leads, num: true },
  { key: 'open', label: 'Open', sort: (row) => row.open, num: true },
  { key: 'contactRate', label: 'Contacted', sort: (row) => row.contactRate ?? -1, num: true },
  { key: 'responseHours', label: 'First response', sort: (row) => row.responseHours ?? Infinity, dir: 'asc', num: true },
  { key: 'activities', label: 'Activities', sort: (row) => row.activities, num: true },
  { key: 'tasksDone', label: 'Tasks done', sort: (row) => row.tasksDone, num: true },
  { key: 'tasksOverdue', label: 'Overdue', sort: (row) => row.tasksOverdue, num: true },
  { key: 'hot', label: 'Hot', sort: (row) => row.hot, num: true },
  { key: 'admitted', label: 'Admitted', sort: (row) => row.admitted, num: true },
];

/** Per-person results for the range, ranked by admissions then admission rate. One row for a counsellor. */
export default function Leaderboard({ rows = [], admin, scope, person = '' }) {
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const ranked = useMemo(() => [...rows]
    .sort((a, b) => b.admitted - a.admitted || (b.admitRate ?? 0) - (a.admitRate ?? 0) || b.leads - a.leads)
    .map((row, index) => ({ ...row, rank: index + 1 })), [rows]);
  const column = COLUMNS.find((item) => item.key === sort.key) ?? COLUMNS[0];
  const sorted = useMemo(() => [...ranked].sort((a, b) => {
    const x = column.sort(a); const y = column.sort(b);
    const order = x < y ? -1 : x > y ? 1 : 0;
    return (sort.dir === 'asc' ? order : -order) || a.rank - b.rank;
  }), [ranked, column, sort.dir]);
  const own = (row) => row.id === admin?.id || row.email === admin?.email;
  const single = scope === 'own' || Boolean(person);
  const toggle = (item) => setSort((current) => (current.key === item.key ? { key: item.key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key: item.key, dir: item.dir ?? 'desc' }));

  return <Panel className={styles.wide} title={person ? `Numbers for ${person}` : single ? 'Your numbers' : scope === 'team' ? 'Team leaderboard' : 'Leaderboard'}
    meta={<><InfoHint text={single ? 'Results for leads received in this range.' : `Leads received in this range, per assignee, ranked by admissions. Click a column to sort. ${SPEED_HINT}`} />
      {single ? 'Leads received in this range' : `${n(ranked.length)} ${ranked.length === 1 ? 'person' : 'people'}`}</>} flush>
    {!ranked.length ? <Empty title="No assigned leads in this range" />
      : <div className={styles.tableWrap} role="region" aria-label="Leaderboard" tabIndex={0}>
        <table className={styles.table}>
          <thead><tr>
            {COLUMNS.filter((item) => !single || item.key !== 'rank').map((item) => <th key={item.key} scope="col" data-num={item.num ? '' : undefined}
              aria-sort={sort.key === item.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => toggle(item)}>{item.label}<span aria-hidden="true">{sort.key === item.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span></button>
            </th>)}
          </tr></thead>
          <tbody>
            {sorted.map((row) => {
              const speed = responseTone(row.responseHours);
              return <tr key={row.id} data-own={own(row) || undefined}>
                {!single && <td data-num="">{row.rank}</td>}
                <th scope="row" className={styles.truncate} title={row.email}>
                  <Link href={leadsHref({ assignee: row.id })} className={styles.personLink}>{displayName(row.email)}{own(row) && <span className="crm-muted"> (you)</span>}</Link>
                </th>
                <td data-num="">{n(row.leads)}</td>
                <td data-num="">{n(row.open)}</td>
                <td data-num="">{typeof row.contactRate === 'number' ? `${row.contactRate}%` : <span className={styles.zero}>—</span>}</td>
                <td data-num="">{typeof row.responseHours === 'number' ? <StatusWord tone={speed.tone} title={speed.word}>{formatHours(row.responseHours)}</StatusWord> : <span className={styles.zero}>—</span>}</td>
                <td data-num="" title={`${n(row.calls)} calls`}>{n(row.activities)}</td>
                <td data-num="">{n(row.tasksDone)}</td>
                <td data-num="">{row.tasksOverdue > 0 ? <StatusWord tone="bad" title="Overdue">{n(row.tasksOverdue)}</StatusWord> : <span className={styles.zero}>0</span>}</td>
                <td data-num="">{n(row.hot)}</td>
                <td data-num="" title={typeof row.admitRate === 'number' ? `${row.admitRate}% of leads admitted` : undefined}><strong>{n(row.admitted)}</strong></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
  </Panel>;
}

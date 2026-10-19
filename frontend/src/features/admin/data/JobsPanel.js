'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { formatCount, formatDate, hostOf } from './data-api';
import styles from './DataOps.module.css';
import table from '../ResourceManager.module.css';

const PAGE_SIZE = 20;
const FILTERS = [['', 'All'], ['queued', 'Queued'], ['running', 'Running'], ['done', 'Done'], ['failed', 'Failed'], ['skipped', 'Skipped'], ['cancelled', 'Cancelled']];

function Outcome({ job }) {
  const result = job.result;
  if (job.status === 'done' && result) {
    const visibility = result.published === true ? 'published' : result.published === false ? 'held for review' : 'visibility unchanged';
    return <div className={table.primaryCell}>
      <span>{result.slug} · {result.action}{result.action === 'inserted' ? `, ${visibility}` : ''}</span>
      <small>{result.fields?.length ?? 0} fields found{result.missing?.length ? ` · missing ${result.missing.join(', ')}` : ''} · {result.pages?.filter((page) => page.ok).length ?? 0} pages</small>
    </div>;
  }
  if (job.status === 'queued' && job.attempts > 0) return <div className={table.primaryCell}><small className={styles.errorText}>{job.error}</small><small>Next attempt {formatDate(job.nextRunAt)}</small></div>;
  if (job.error) return <span className={styles.errorText} title={job.error}>{job.error}</span>;
  if (job.status === 'running') return <span className={table.muted}>Leased by {job.lockedBy}</span>;
  return <span className={table.muted}>—</span>;
}

export default function JobsPanel({ notify, onChanged, reloadKey }) {
  const { request } = useAdminSession();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: '' });
  const [busy, setBusy] = useState('');

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  const load = useCallback(async (signal) => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (search) params.set('q', search);
    try { const data = await request(`/data-ops/scraper/jobs?${params}`, { signal }); setList({ items: data.items, total: data.total, loading: false, error: '' }); } catch (failure) {
      if (failure.name !== 'AbortError') setList((previous) => ({ ...previous, loading: false, error: failure.message }));
    }
  }, [page, request, search, status]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load, reloadKey]);

  async function act(action, body, key) {
    setBusy(key);
    try {
      const result = await request(`/data-ops/scraper/jobs/${action}`, { method: 'POST', body });
      notify(action === 'retry' ? `${formatCount(result.retried)} job${result.retried === 1 ? '' : 's'} queued again${result.skipped ? ` (${formatCount(result.skipped)} already had an open job)` : ''}.` : `${formatCount(result.cancelled)} queued job${result.cancelled === 1 ? '' : 's'} cancelled.`);
      load(); onChanged();
    } catch (failure) { notify(failure.message, 'error'); }
    setBusy('');
  }

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  return <div className={table.manager}>
    <div className={table.toolbar}>
      <div className={table.summary}><span className={table.summaryIcon}><Icon name="layers" /></span><div><strong>{formatCount(list.total)} jobs</strong><small>One job per source per run, newest activity first</small></div></div>
      <button type="button" className="button button--outline" disabled={Boolean(busy)} onClick={() => act('retry', { status: 'failed' }, 'retry-all')}>{busy === 'retry-all' ? 'Retrying…' : 'Retry all failed'}</button>
      <button type="button" className="button button--ghost" disabled={Boolean(busy)} onClick={() => act('cancel', {}, 'cancel-all')}>{busy === 'cancel-all' ? 'Cancelling…' : 'Cancel all queued'}</button>
    </div>
    <div className={styles.filters}>
      <div className={styles.segmentedScroll}><div className={table.segmented} role="group" aria-label="Filter by job status">{FILTERS.map(([value, label]) => <button key={label} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div></div>
      <label className={table.search}><Icon name="search" /><span className="sr-only">Search jobs</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or domain…" maxLength={80} /></label>
    </div>
    <div className={table.tableCard}>
      {list.error ? <div className={table.errorBox} role="alert"><Icon name="shield" />{list.error}<button type="button" className="button button--outline" onClick={() => load()}>Retry</button></div> : <div className={table.tableScroll}>
        <table className={table.table} aria-busy={list.loading}>
          <thead><tr><th scope="col">Institution</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Updated</th><th scope="col">Outcome</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{list.items.map((job) => <tr key={job.id}>
            <td><div className={table.primaryCell}><strong title={job.name}>{job.name}</strong><small>{hostOf(job.website)}</small></div></td>
            <td><span className={styles.pill} data-status={job.status}>{job.status}</span></td>
            <td className={styles.nowrap}>{job.attempts} / {job.maxAttempts}</td>
            <td className={styles.nowrap}>{formatDate(job.updatedAt)}</td>
            <td><Outcome job={job} /></td>
            <td className={table.rowActions}>
              {['failed', 'skipped', 'cancelled'].includes(job.status) && <button type="button" className={`button button--outline ${styles.small}`} disabled={Boolean(busy)} onClick={() => act('retry', { ids: [job.id] }, job.id)}>Retry</button>}
              {job.status === 'queued' && <button type="button" className={`button button--ghost ${styles.small}`} disabled={Boolean(busy)} onClick={() => act('cancel', { ids: [job.id] }, job.id)}>Cancel</button>}
            </td>
          </tr>)}</tbody>
        </table>
        {!list.loading && !list.items.length && <div className={table.empty}><Icon name="layers" /><p>{status || search ? 'No jobs match these filters.' : 'No jobs yet. Queue a crawl from the Sources tab.'}</p></div>}
      </div>}
      {pages > 1 && <nav className={table.pagination} aria-label="Jobs pagination"><span>Page {page} of {formatCount(pages)}</span><div>
        <button type="button" className={table.iconButton} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="arrow" /></button>
        <button type="button" className={table.iconButton} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="arrow" /></button>
      </div></nav>}
    </div>
  </div>;
}

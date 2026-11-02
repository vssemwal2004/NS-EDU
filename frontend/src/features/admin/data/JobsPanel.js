'use client';
// Scraper › Job queue: one job per source per run. Retry failed or skipped jobs; cancel queued ones.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import ConfirmDialog from '../crm/ConfirmDialog';
import RowMenu from '../crm/RowMenu';
import { useToaster } from '../crm/toast';
import Pagination from '../table/Pagination';
import { useServerList } from '../table/useServerList';
import CatalogueTable, { ACTIONS_COLUMN } from '../catalogue/CatalogueTable';
import { EmptyState, FilterSelect, SearchBox, useDebounced } from '../catalogue/CatalogueParts';
import { formatCount, formatDate, hostOf } from './data-api';
import { JOB_ORDER, JOB_STATUS, JobChip } from './data-ui';
import styles from '../catalogue/Catalogue.module.css';

const PAGE_SIZES = [25, 50, 100];

function outcome(job) {
  const result = job.result;
  if (job.status === 'done' && result) {
    const visibility = result.published === true ? 'published' : result.published === false ? 'held for review' : 'visibility unchanged';
    return [`${result.slug} · ${result.action}${result.action === 'inserted' ? `, ${visibility}` : ''}`,
      `${result.fields?.length ?? 0} fields · ${result.pages?.filter((page) => page.ok).length ?? 0} pages${result.missing?.length ? ` · missing ${result.missing.join(', ')}` : ''}`];
  }
  if (job.status === 'queued' && job.attempts > 0) return [job.error || 'Retrying', `Next attempt ${formatDate(job.nextRunAt)}`];
  if (job.error) return [job.error, ''];
  if (job.status === 'running') return [`Leased by ${job.lockedBy}`, ''];
  return ['', ''];
}

export default function JobsPanel({ status, onStatus, onChanged, reloadKey }) {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null); // 'retry-all' | 'cancel-all'

  const search = useDebounced(query.trim(), 300);
  const listKey = JSON.stringify([search, status, limit]);
  const page = paging.key === listKey ? paging.page : 1;
  const setPage = (next) => setPaging({ key: listKey, page: next });
  const list = useServerList(request, '/data-ops/scraper/jobs', { q: search, status, page, limit }, { scope: `${admin?.id ?? ''}:${reloadKey}` });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;

  async function act(action, body, key) {
    setBusy(key);
    try {
      const result = await request(`/data-ops/scraper/jobs/${action}`, { method: 'POST', body });
      toast.success(action === 'retry'
        ? `${formatCount(result.retried)} job${result.retried === 1 ? '' : 's'} queued again${result.skipped ? ` (${formatCount(result.skipped)} already had an open job)` : ''}.`
        : `${formatCount(result.cancelled)} queued job${result.cancelled === 1 ? '' : 's'} cancelled.`);
      setConfirm(null);
      list.reload(); onChanged();
    } catch (failure) { toast.error(failure.message); }
    setBusy('');
  }

  const columns = [
    { key: 'name', label: 'Institution', render: (job) => <div className={styles.primary}>
      <strong className={styles.truncate} title={job.name}>{job.name}</strong><span className={styles.sub}>{hostOf(job.website)}</span>
    </div> },
    { key: 'status', label: 'Status', width: 120, render: (job) => <JobChip status={job.status} /> },
    { key: 'attempts', label: 'Attempts', width: 90, align: 'end', render: (job) => <span className={styles.num}>{job.attempts} / {job.maxAttempts}</span> },
    { key: 'updated', label: 'Updated', width: 170, render: (job) => <span className={styles.truncate}>{formatDate(job.updatedAt)}</span> },
    { key: 'outcome', label: 'Outcome', render: (job) => { const [line, sub] = outcome(job); return line ? <div className={styles.primary}>
      <span className={`${styles.truncate} ${job.error && job.status !== 'done' ? styles.errorText : ''}`} title={line}>{line}</span>{sub && <span className={styles.sub} title={sub}>{sub}</span>}
    </div> : <span className={styles.muted}>—</span>; } },
    { ...ACTIONS_COLUMN, render: (job) => <RowMenu label={`Actions for ${job.name}`} items={[
      { key: 'retry', label: 'Retry', icon: 'refresh', onSelect: () => act('retry', { ids: [job.id] }, job.id), hidden: !['failed', 'skipped', 'cancelled'].includes(job.status) },
      { key: 'cancel', label: 'Cancel job', icon: 'close', tone: 'danger', onSelect: () => act('cancel', { ids: [job.id] }, job.id), hidden: job.status !== 'queued' },
      { key: 'site', label: 'Visit website', icon: 'external', onSelect: () => window.open(job.website, '_blank', 'noopener') },
    ]} /> },
  ];

  return <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.actionsRow} style={{ marginTop: 0, flex: '1 1 400px' }}>
        <SearchBox label="Search jobs" value={query} onChange={setQuery} placeholder="Search name or domain…" maxLength={80} />
        <FilterSelect label="Status" value={status} onChange={onStatus} options={JOB_ORDER.map((value) => ({ value, label: JOB_STATUS[value][1] }))} allLabel="Any status" />
      </div>
      <div className={styles.actionsRow} style={{ marginTop: 0 }}>
        <button type="button" className="adm-btn" disabled={Boolean(busy)} onClick={() => setConfirm('retry-all')}><Icon name="refresh" />Retry all failed</button>
        <button type="button" className="adm-btn adm-btn--ghost" disabled={Boolean(busy)} onClick={() => setConfirm('cancel-all')}><Icon name="close" />Cancel all queued</button>
      </div>
    </div>
    <CatalogueTable caption="Crawl jobs" columns={columns} rows={items} loading={list.loading} busy={list.busy} error={list.error} onRetry={list.reload}
      empty={status || search ? <EmptyState title="No jobs match these filters." action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); onStatus(''); }}>Clear filters</button>} />
        : <EmptyState title="No jobs yet. Queue a crawl to add some." />} />
    {(items.length > 0 || page > 1) && <Pagination page={page} pageSize={limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun="jobs"
      hasNext={page * limit < total} hasPrevious={page > 1} disabled={list.busy} onPage={setPage} onPageSize={setLimit} />}

    <ConfirmDialog open={Boolean(confirm)} tone={confirm === 'cancel-all' ? 'danger' : 'primary'} icon={confirm === 'cancel-all' ? 'close' : 'refresh'} busy={Boolean(busy)}
      title={confirm === 'cancel-all' ? 'Cancel every queued job?' : 'Retry every failed job?'} confirmLabel={confirm === 'cancel-all' ? 'Cancel queued jobs' : 'Retry failed jobs'}
      onConfirm={() => (confirm === 'cancel-all' ? act('cancel', {}, 'cancel-all') : act('retry', { status: 'failed' }, 'retry-all'))} onCancel={() => setConfirm(null)}>
      <p>{confirm === 'cancel-all' ? 'Jobs waiting for a worker are cancelled. Running jobs finish normally. You can queue a crawl again at any time.' : 'Failed jobs go back into the queue; a worker on the server picks them up.'}</p>
    </ConfirmDialog>
  </div>;
}

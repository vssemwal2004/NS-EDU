'use client';
// Scraper › Sources: institutions to crawl and their official websites.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import ConfirmDialog from '../crm/ConfirmDialog';
import RowMenu from '../crm/RowMenu';
import { useToaster } from '../crm/toast';
import Pagination from '../table/Pagination';
import { useServerList } from '../table/useServerList';
import CatalogueTable, { ACTIONS_COLUMN } from '../catalogue/CatalogueTable';
import { BulkBar, EmptyState, FilterSelect, formatDay, SearchBox, useDebounced } from '../catalogue/CatalogueParts';
import { formatDate, hostOf } from './data-api';
import { JobChip, SourceChip } from './data-ui';
import { AddSourceForm, SeedUploadForm } from './SourceForms';
import styles from '../catalogue/Catalogue.module.css';

const PAGE_SIZES = [25, 50, 100];
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'blocked', label: 'Blocked (opt-out)' }];
const CRAWL_OPTIONS = [{ value: 'never', label: 'Never crawled' }];

export default function SourcesPanel({ onChanged, onEnqueue, reloadKey }) {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [crawled, setCrawled] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState('');
  const [confirm, setConfirm] = useState(null);

  const search = useDebounced(query.trim(), 300);
  const listKey = JSON.stringify([search, status, crawled, limit]);
  const page = paging.key === listKey ? paging.page : 1;
  const setPage = (next) => setPaging({ key: listKey, page: next });
  const selectionKey = `${listKey}|${page}`;
  const [selectionFor, setSelectionFor] = useState(selectionKey);
  if (selectionFor !== selectionKey) { setSelectionFor(selectionKey); if (selected.length) setSelected([]); }

  const list = useServerList(request, '/data-ops/scraper/sources', { q: search, status, crawled, page, limit }, { scope: `${admin?.id ?? ''}:${reloadKey}` });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const reload = () => { list.reload(); onChanged(); };

  async function changeStatus(source, next) {
    try {
      await request(`/data-ops/scraper/sources/${source.id}`, { method: 'PATCH', body: { status: next } });
      toast.success(next === 'active' ? `${source.name} will be crawled again.` : `${source.name} is ${next}; its queued jobs were cancelled.`);
      reload();
    } catch (failure) { toast.error(failure.message); }
  }

  async function remove() {
    setConfirm((current) => ({ ...current, busy: true, error: '' }));
    try {
      await request(`/data-ops/scraper/sources/${confirm.source.id}`, { method: 'DELETE' });
      setConfirm(null);
      toast.success('Source deleted. Universities it already created stay in the catalogue.');
      reload();
    } catch (failure) { setConfirm((current) => ({ ...current, busy: false, error: failure.message })); }
  }

  const columns = [
    { key: 'name', label: 'Institution', render: (source) => <div className={styles.primary}>
      <strong className={styles.truncate} title={source.name}>{source.name}</strong>
      <a className={`${styles.sub} ${styles.link}`} href={source.website} target="_blank" rel="noopener noreferrer">{hostOf(source.website)}</a>
    </div> },
    { key: 'location', label: 'Location', width: 170, render: (source) => { const text = [source.city, source.state].filter(Boolean).join(', '); return text ? <span className={styles.truncate} title={text}>{text}</span> : <span className={styles.muted}>—</span>; } },
    { key: 'seed', label: 'Seed list', width: 170, render: (source) => (source.seedListName ? <span className={styles.truncate} title={source.seedListName}>{source.seedListName}</span> : <span className={styles.muted}>—</span>) },
    { key: 'last', label: 'Last crawl', width: 210, render: (source) => (source.lastResult
      ? <span className={styles.inline} title={[formatDate(source.lastResult.at), source.lastResult.slug, source.lastResult.error].filter(Boolean).join(' · ')}>
        <JobChip status={source.lastResult.status} /><span className={styles.sub}>{formatDay(source.lastResult.at)}</span>
      </span> : <span className={styles.muted}>Never</span>) },
    { key: 'status', label: 'Status', width: 100, render: (source) => <SourceChip status={source.status} /> },
    { ...ACTIONS_COLUMN, render: (source) => <RowMenu label={`Actions for ${source.name}`} items={[
      { key: 'queue', label: 'Queue a crawl now', icon: 'play', onSelect: () => onEnqueue({ mode: 'selected', sourceIds: [source.id] }), disabled: source.status !== 'active', reason: 'Only active sources are crawled' },
      { key: 'site', label: 'Visit website', icon: 'external', onSelect: () => window.open(source.website, '_blank', 'noopener') },
      { divider: true },
      { key: 'active', label: 'Set active', icon: 'play', onSelect: () => changeStatus(source, 'active'), hidden: source.status === 'active' },
      { key: 'paused', label: 'Pause', icon: 'pause', onSelect: () => changeStatus(source, 'paused'), hidden: source.status === 'paused' },
      { key: 'blocked', label: 'Block (opt-out request)', icon: 'ban', onSelect: () => changeStatus(source, 'blocked'), hidden: source.status === 'blocked' },
      { divider: true },
      { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', onSelect: () => setConfirm({ source }) },
    ]} /> },
  ];

  const filtered = Boolean(search || status || crawled);
  return <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.actionsRow} style={{ marginTop: 0, flex: '1 1 400px' }}>
        <SearchBox label="Search sources" value={query} onChange={setQuery} placeholder="Search name or domain…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        <FilterSelect label="Crawled" value={crawled} onChange={setCrawled} options={CRAWL_OPTIONS} allLabel="Crawled or not" />
      </div>
      <div className={styles.actionsRow} style={{ marginTop: 0 }}>
        <button type="button" className="adm-btn" onClick={() => setDrawer('upload')}><Icon name="upload" />Upload seed list</button>
        <button type="button" className="adm-btn" onClick={() => setDrawer('add')}><Icon name="plus" />Add source</button>
      </div>
    </div>
    {selected.length > 0 && <BulkBar count={selected.length} onClear={() => setSelected([])}>
      <button type="button" className="adm-btn adm-btn--sm" onClick={() => onEnqueue({ mode: 'selected', sourceIds: selected }, () => setSelected([]))}><Icon name="play" />Queue crawl now</button>
    </BulkBar>}
    <CatalogueTable caption="Crawl sources" columns={columns} rows={items} loading={list.loading} busy={list.busy} error={list.error} onRetry={list.reload}
      selectable selected={selected} onSelectionChange={setSelected} rowLabel={(source) => source.name} rowMuted={(source) => source.status !== 'active'} stickyOffset={selected.length ? 40 : 0}
      empty={filtered ? <EmptyState title="No sources match these filters." action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setStatus(''); setCrawled(''); }}>Clear filters</button>} />
        : <EmptyState title="No crawl sources yet." action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => setDrawer('upload')}><Icon name="upload" />Upload a seed list</button>} />} />
    {(items.length > 0 || page > 1) && <Pagination page={page} pageSize={limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun="sources"
      hasNext={page * limit < total} hasPrevious={page > 1} disabled={list.busy} onPage={setPage} onPageSize={setLimit} />}

    <AdminDrawer open={drawer === 'add'} onClose={() => setDrawer('')} title="Add crawl source" subtitle="One institution and its official website.">
      {drawer === 'add' && <AddSourceForm onCancel={() => setDrawer('')} onDone={(item) => { setDrawer(''); toast.success(`${item.name} added. Queue a crawl to fetch it.`); reload(); }} />}
    </AdminDrawer>
    <AdminDrawer open={drawer === 'upload'} onClose={() => setDrawer('')} title="Upload seed list" subtitle="CSV or JSON list of institutions and their official websites.">
      {drawer === 'upload' && <SeedUploadForm onCancel={() => setDrawer('')} onDone={reload} />}
    </AdminDrawer>
    <ConfirmDialog open={Boolean(confirm)} tone="danger" icon="trash" title="Delete this source?" confirmLabel="Delete source" busy={confirm?.busy} error={confirm?.error} onConfirm={remove} onCancel={() => setConfirm(null)}>
      {confirm && <><p><strong>{confirm.source.name}</strong> will no longer be crawled and its queued jobs are cancelled. Universities it already created stay in the catalogue.</p>
        <p>To honour an opt-out request, use Block instead, so a later seed upload does not add it again.</p></>}
    </ConfirmDialog>
  </div>;
}

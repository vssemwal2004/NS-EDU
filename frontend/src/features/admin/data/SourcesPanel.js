'use client';
// Scraper › Sources: institutions to crawl and their official websites.
// Permissions: data.create adds sources (form or seed list), data.edit edits / changes status / queues
// crawls, data.delete removes sources. Actions the person cannot use are hidden.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import BulkBar from '../crm/BulkBar';
import ConfirmDialog from '../crm/ConfirmDialog';
import { can } from '../crm/meta';
import RowMenu from '../crm/RowMenu';
import { useToaster } from '../crm/toast';
import Pagination from '../table/Pagination';
import { useServerList } from '../table/useServerList';
import CatalogueTable, { ACTIONS_COLUMN } from '../catalogue/CatalogueTable';
import { EmptyState, FilterSelect, formatDay, plural, SearchBox, useDebounced } from '../catalogue/CatalogueParts';
import { formatDate, hostOf } from './data-api';
import { JobChip, SourceChip } from './data-ui';
import { AddSourceForm, EditSourceForm, SeedUploadForm } from './SourceForms';
import styles from '../catalogue/Catalogue.module.css';

const PAGE_SIZES = [25, 50, 100];
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'blocked', label: 'Blocked (opt-out)' }];
const CRAWL_OPTIONS = [{ value: 'never', label: 'Never crawled' }];
const STATUS_WORDS = { active: 'set active', paused: 'paused', blocked: 'blocked' };

export default function SourcesPanel({ onChanged, onEnqueue, reloadKey }) {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const rights = { create: can(admin, 'data.create'), edit: can(admin, 'data.edit'), delete: can(admin, 'data.delete') };
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [crawled, setCrawled] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { source } | { bulk: true }
  const [bulkBusy, setBulkBusy] = useState(false);

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

  /** Runs one request per selected source (there is no bulk endpoint for sources) and reports the outcome. */
  async function forEachSelected(run) {
    const ids = [...selected];
    let done = 0;
    const failed = [];
    for (const id of ids) {
      try { await run(id); done += 1; } catch (failure) { failed.push(failure.message); }
    }
    return { ids, done, failed };
  }

  async function bulkStatus(next) {
    setBulkBusy(true);
    const { done, failed } = await forEachSelected((id) => request(`/data-ops/scraper/sources/${id}`, { method: 'PATCH', body: { status: next } }));
    const message = `${plural(done, 'source')} ${STATUS_WORDS[next]}${next === 'active' ? '' : '; their queued jobs were cancelled'}.`;
    if (failed.length) toast.warn(`${message} ${plural(failed.length, 'source')} could not be changed: ${failed[0]}`);
    else toast.success(message);
    setSelected([]);
    setBulkBusy(false);
    reload();
  }

  async function remove() {
    setConfirm((current) => ({ ...current, busy: true, error: '' }));
    if (confirm.bulk) {
      const { done, failed } = await forEachSelected((id) => request(`/data-ops/scraper/sources/${id}`, { method: 'DELETE' }));
      if (failed.length && !done) { setConfirm((current) => ({ ...current, busy: false, error: failed[0] })); return; }
      setConfirm(null);
      setSelected([]);
      const message = `${plural(done, 'source')} deleted. Universities they already created stay in the catalogue.`;
      if (failed.length) toast.warn(`${message} ${plural(failed.length, 'source')} could not be deleted: ${failed[0]}`); else toast.success(message);
      if (done === items.length && page > 1) setPage(page - 1);
      reload();
      return;
    }
    try {
      await request(`/data-ops/scraper/sources/${confirm.source.id}`, { method: 'DELETE' });
      setConfirm(null);
      toast.success('Source deleted. Universities it already created stay in the catalogue.');
      reload();
    } catch (failure) { setConfirm((current) => ({ ...current, busy: false, error: failure.message })); }
  }

  const columns = [
    { key: 'name', label: 'Institution', render: (source) => <div className={styles.primary}>
      {rights.edit ? <button type="button" className={styles.primaryButton} title={source.name} onClick={() => setEditing(source)}>{source.name}</button>
        : <strong className={styles.truncate} title={source.name}>{source.name}</strong>}
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
      { key: 'edit', label: 'Edit source…', icon: 'edit', hidden: !rights.edit, onSelect: () => setEditing(source) },
      { key: 'queue', label: 'Queue a crawl now', icon: 'play', hidden: !rights.edit, onSelect: () => onEnqueue({ mode: 'selected', sourceIds: [source.id] }), disabled: source.status !== 'active', reason: 'Only active sources are crawled' },
      { key: 'site', label: 'Visit website', icon: 'external', onSelect: () => window.open(source.website, '_blank', 'noopener') },
      { divider: true },
      { key: 'active', label: 'Set active', icon: 'play', onSelect: () => changeStatus(source, 'active'), hidden: !rights.edit || source.status === 'active' },
      { key: 'paused', label: 'Pause', icon: 'pause', onSelect: () => changeStatus(source, 'paused'), hidden: !rights.edit || source.status === 'paused' },
      { key: 'blocked', label: 'Block (opt-out request)', icon: 'ban', onSelect: () => changeStatus(source, 'blocked'), hidden: !rights.edit || source.status === 'blocked' },
      { divider: true },
      { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !rights.delete, onSelect: () => setConfirm({ source }) },
    ]} /> },
  ];

  const bulkable = rights.edit || rights.delete;
  const queueSelected = () => onEnqueue({ mode: 'selected', sourceIds: selected }, () => setSelected([]));
  const bulkMenu = [
    { key: 'queue', label: 'Queue crawl now', icon: 'play', hidden: !rights.edit, onSelect: queueSelected },
    { divider: true },
    { key: 'active', label: 'Set active', icon: 'play', hidden: !rights.edit, onSelect: () => bulkStatus('active') },
    { key: 'paused', label: 'Pause', icon: 'pause', hidden: !rights.edit, onSelect: () => bulkStatus('paused') },
    { key: 'blocked', label: 'Block (opt-out request)', icon: 'ban', hidden: !rights.edit, onSelect: () => bulkStatus('blocked') },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !rights.delete, onSelect: () => setConfirm({ bulk: true }) },
  ];

  const filtered = Boolean(search || status || crawled);
  return <div className={styles.card}>
    <div className={styles.cardHead}>
      <div className={styles.actionsRow} style={{ marginTop: 0, flex: '1 1 400px' }}>
        <SearchBox label="Search sources" value={query} onChange={setQuery} placeholder="Search name or domain…" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Any status" />
        <FilterSelect label="Crawled" value={crawled} onChange={setCrawled} options={CRAWL_OPTIONS} allLabel="Crawled or not" />
      </div>
      {rights.create && <div className={styles.actionsRow} style={{ marginTop: 0 }}>
        <button type="button" className="adm-btn" onClick={() => setDrawer('upload')}><Icon name="upload" />Upload seed list</button>
        <button type="button" className="adm-btn" onClick={() => setDrawer('add')}><Icon name="plus" />Add source</button>
      </div>}
    </div>
    {bulkable && selected.length > 0 && <div className={styles.bulkDock}>
      <BulkBar count={selected.length} noun={['source', 'sources']} onClear={() => setSelected([])} busy={bulkBusy}
        quick={[{ key: 'queue', label: 'Queue crawl now', icon: 'play', hidden: !rights.edit, onSelect: queueSelected }]} menu={bulkMenu} />
    </div>}
    <CatalogueTable caption="Crawl sources" columns={columns} rows={items} loading={list.loading} busy={list.busy} error={list.error} onRetry={list.reload}
      selectable={bulkable} selected={selected} onSelectionChange={setSelected} rowLabel={(source) => source.name} rowMuted={(source) => source.status !== 'active'} stickyOffset={bulkable && selected.length ? 42 : 0}
      empty={filtered ? <EmptyState title="No sources match these filters." action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setStatus(''); setCrawled(''); }}>Clear filters</button>} />
        : <EmptyState title="No crawl sources yet." action={rights.create && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setDrawer('upload')}><Icon name="upload" />Upload a seed list</button>} />} />
    {(items.length > 0 || page > 1) && <Pagination page={page} pageSize={limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun="sources"
      hasNext={page * limit < total} hasPrevious={page > 1} disabled={list.busy} onPage={setPage} onPageSize={setLimit} />}

    <AdminDrawer open={drawer === 'add'} onClose={() => setDrawer('')} title="Add crawl source" subtitle="One institution and its official website.">
      {drawer === 'add' && <AddSourceForm onCancel={() => setDrawer('')} onDone={(item) => { setDrawer(''); toast.success(`${item.name} added. Queue a crawl to fetch it.`); reload(); }} />}
    </AdminDrawer>
    <AdminDrawer open={drawer === 'upload'} onClose={() => setDrawer('')} title="Upload seed list" subtitle="CSV or JSON list of institutions and their official websites.">
      {drawer === 'upload' && <SeedUploadForm onCancel={() => setDrawer('')} onDone={reload} />}
    </AdminDrawer>
    <AdminDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit crawl source" subtitle={editing?.name}>
      {editing && <EditSourceForm key={editing.id} source={editing} onCancel={() => setEditing(null)}
        onDone={(item) => { setEditing(null); toast.success(`${item.name} saved.`); reload(); }} />}
    </AdminDrawer>
    <ConfirmDialog open={Boolean(confirm)} tone="danger" icon="trash" busy={confirm?.busy} error={confirm?.error} onConfirm={remove} onCancel={() => setConfirm(null)}
      title={confirm?.bulk ? `Delete ${plural(selected.length, 'source')}?` : 'Delete this source?'} confirmLabel={confirm?.bulk ? 'Delete sources' : 'Delete source'}
      requireText={confirm?.bulk && selected.length >= 5 ? 'DELETE' : undefined}>
      {confirm?.source && <p><strong>{confirm.source.name}</strong> will no longer be crawled and its queued jobs are cancelled. Universities it already created stay in the catalogue.</p>}
      {confirm?.bulk && <p>The {plural(selected.length, 'selected source', 'selected sources')} will no longer be crawled and their queued jobs are cancelled. Universities they already created stay in the catalogue.</p>}
      {confirm && <p>To honour an opt-out request, use Block instead, so a later seed upload does not add it again.</p>}
    </ConfirmDialog>
  </div>;
}

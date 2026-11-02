'use client';
// Data pipeline › Review queue: imported and scraped universities waiting to be checked.
// Verify / publish / hide / reject one row (⋮) or a selection (bulk bar); open a record to fix it first.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import ConfirmDialog from '../crm/ConfirmDialog';
import RowMenu from '../crm/RowMenu';
import { Chip } from '../crm/ui';
import { useToaster } from '../crm/toast';
import { PageToolbar, ViewTabs } from '../ui/Page';
import Pagination from '../table/Pagination';
import { useServerList } from '../table/useServerList';
import CatalogueTable, { ACTIONS_COLUMN } from '../catalogue/CatalogueTable';
import { BulkBar, EmptyState, FilterSelect, SearchBox, StatusDot, useDebounced } from '../catalogue/CatalogueParts';
import { SOURCE_LABELS } from '../resource-config';
import RecordEditor from '../catalogue/RecordEditor';
import { useResourceMeta } from '../ResourceManager';
import { formatCount, formatDate, hostOf } from './data-api';
import styles from '../catalogue/Catalogue.module.css';

const PAGE_SIZES = [25, 50, 100];
const VIEWS = [{ key: 'held', label: 'Held for review', count: 'held' }, { key: 'visible', label: 'Visible, unverified', count: 'visible' }, { key: 'all', label: 'All unverified' }];
const SOURCES = [{ value: 'scrape', label: 'Scraped' }, { value: 'import', label: 'Imported' }, { value: 'admin', label: 'Admin' }, { value: 'seed', label: 'Seed' }];
const ACTIONS = {
  verify: { label: 'Verify', icon: 'checkCircle', done: 'verified and visible' },
  publish: { label: 'Publish', icon: 'eye', done: 'visible to students' },
  hide: { label: 'Hide', icon: 'eyeOff', done: 'hidden from students' },
  reject: { label: 'Reject…', icon: 'ban', done: 'rejected and hidden', danger: true },
};

export default function ReviewQueue({ initialView = 'held', initialSource = '' }) {
  const { admin, request } = useAdminSession();
  const { meta } = useResourceMeta(request);
  const toast = useToaster();
  const [view, setView] = useState(VIEWS.some((item) => item.key === initialView) ? initialView : 'held');
  const [source, setSource] = useState(SOURCES.some((item) => item.value === initialSource) ? initialSource : '');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState('');
  const [reject, setReject] = useState(null); // ids to reject
  const [editor, setEditor] = useState(null);

  const search = useDebounced(query.trim(), 300);
  const listKey = JSON.stringify([view, source, search, limit]);
  const page = paging.key === listKey ? paging.page : 1;
  const setPage = (next) => setPaging({ key: listKey, page: next });
  const selectionKey = `${listKey}|${page}`;
  const [selectionFor, setSelectionFor] = useState(selectionKey);
  if (selectionFor !== selectionKey) { setSelectionFor(selectionKey); if (selected.length) setSelected([]); }

  const list = useServerList(request, '/data-ops/review', { view, source, q: search, page, limit }, { scope: admin?.id ?? '' });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const counts = list.data?.counts;

  async function apply(action, ids) {
    setBusy(action);
    try {
      const result = await request('/data-ops/universities/bulk', { method: 'POST', body: { ids, action } });
      toast.success(`${formatCount(result.matched)} ${result.matched === 1 ? 'university' : 'universities'} ${ACTIONS[action].done}.`);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setReject(null);
      if (items.length === ids.length && page > 1) setPage(page - 1);
      list.reload();
    } catch (failure) { toast.error(failure.message); }
    setBusy('');
  }
  const run = (action, ids) => (ACTIONS[action].danger ? setReject(ids) : apply(action, ids));

  const columns = [
    { key: 'name', label: 'University', render: (item) => <div className={styles.primary}>
      {meta?.institutions ? <button type="button" className={styles.primaryButton} title={item.name} onClick={() => setEditor({ mode: 'edit', id: item.id, title: item.name })}>{item.name}</button> : <strong className={styles.truncate} title={item.name}>{item.name}</strong>}
      <span className={styles.sub}>{item.website ? <a className={styles.link} href={item.website} target="_blank" rel="noopener noreferrer">{hostOf(item.website)}</a> : item.slug}</span>
    </div> },
    { key: 'location', label: 'Location', width: 170, render: (item) => { const text = [item.city, item.state].filter(Boolean).join(', '); return text ? <span className={styles.truncate} title={text}>{text}</span> : <span className={styles.muted}>—</span>; } },
    { key: 'source', label: 'Source', width: 190, render: (item) => (item.source ? <div className={styles.primary}>
      <span className={styles.truncate} title={[item.source.kind, item.source.name].filter(Boolean).join(' · ')}>{item.source.name || SOURCE_LABELS[item.source.kind] || item.source.kind}</span>
      {item.source.fetchedAt && <span className={styles.sub}>Fetched {formatDate(item.source.fetchedAt)}</span>}
    </div> : <span className={styles.muted}>—</span>) },
    { key: 'found', label: 'Fields found', width: 100, align: 'end', render: (item) => (item.scrapedFields.length ? <span className={styles.num} title={item.scrapedFields.join(', ')}>{item.scrapedFields.length}</span> : <span className={styles.muted}>—</span>) },
    { key: 'missing', label: 'Missing', width: 170, render: (item) => (item.missing.length
      ? <span className={styles.truncate} title={item.missing.join(', ')}>{item.missing.slice(0, 2).join(', ')}{item.missing.length > 2 && <span className={styles.sub} style={{ display: 'inline' }}> +{item.missing.length - 2}</span>}</span>
      : <span className={styles.muted}>—</span>) },
    { key: 'active', label: 'Visibility', width: 110, render: (item) => (item.active ? <StatusDot tone="good">Visible</StatusDot> : <Chip size="sm" tone="warn" icon="clock" title="Hidden from students until reviewed">Held</Chip>) },
    { ...ACTIONS_COLUMN, render: (item) => <RowMenu label={`Actions for ${item.name}`} items={[
      { key: 'open', label: 'Open and edit', icon: 'edit', onSelect: () => setEditor({ mode: 'edit', id: item.id, title: item.name }), hidden: !meta?.institutions },
      { key: 'site', label: 'Visit official website', icon: 'external', onSelect: () => window.open(item.website, '_blank', 'noopener'), hidden: !item.website },
      { divider: true },
      { key: 'verify', label: 'Verify', icon: 'checkCircle', onSelect: () => apply('verify', [item.id]) },
      item.active ? { key: 'hide', label: 'Hide from students', icon: 'eyeOff', onSelect: () => apply('hide', [item.id]) } : { key: 'publish', label: 'Publish without verifying', icon: 'eye', onSelect: () => apply('publish', [item.id]) },
      { divider: true },
      { key: 'reject', label: 'Reject…', icon: 'ban', tone: 'danger', onSelect: () => setReject([item.id]) },
    ]} /> },
  ];

  const filtered = Boolean(search || source);
  return <div className={styles.screen}>
    <PageToolbar start={<>
      <ViewTabs label="Review views" value={view} onChange={setView} items={VIEWS.map((item) => ({ key: item.key, label: item.label, count: item.count && counts ? counts[item.count] : undefined }))} />
      <SearchBox label="Search universities" value={query} onChange={setQuery} placeholder="Search name, city or state…" />
      <FilterSelect label="Source" value={source} onChange={setSource} options={SOURCES} allLabel="Any source" />
      {filtered && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { setQuery(''); setSource(''); }}>Clear</button>}
    </>}>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon" onClick={list.reload} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
    </PageToolbar>

    <div className={styles.card}>
      {selected.length > 0 && <BulkBar count={selected.length} onClear={() => setSelected([])}>
        {Object.entries(ACTIONS).map(([action, config]) => <button key={action} type="button" className={`adm-btn adm-btn--sm${config.danger ? ' adm-btn--danger' : ''}`} disabled={Boolean(busy)} onClick={() => run(action, selected)}>
          <Icon name={config.icon} />{busy === action ? 'Working…' : config.label}
        </button>)}
      </BulkBar>}
      <CatalogueTable caption="Universities awaiting review" columns={columns} rows={items} loading={list.loading} busy={list.busy} error={list.error} onRetry={list.reload}
        selectable selected={selected} onSelectionChange={setSelected} rowLabel={(item) => item.name} stickyOffset={selected.length ? 40 : 0}
        onRowClick={meta?.institutions ? (item) => setEditor({ mode: 'edit', id: item.id, title: item.name }) : undefined}
        empty={filtered ? <EmptyState title="Nothing matches these filters." action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setSource(''); }}>Clear filters</button>} />
          : <EmptyState title={view === 'held' ? 'Nothing is held for review.' : 'No unverified universities.'}>New imports and crawls appear here.</EmptyState>} />
      {(items.length > 0 || page > 1) && <Pagination page={page} pageSize={limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun="universities"
        hasNext={page * limit < total} hasPrevious={page > 1} disabled={list.busy} onPage={setPage} onPageSize={setLimit} />}
    </div>

    <RecordEditor resource="institutions" meta={meta?.institutions} editor={editor} refOptions={{}} onClose={() => setEditor(null)}
      onSaved={(item) => { setEditor(null); toast.success(`${item.name} saved. Edited fields are now protected from imports and crawls.`); list.reload(); }} />

    <ConfirmDialog open={Boolean(reject)} tone="danger" icon="ban" title={`Reject ${reject?.length ?? 0} ${reject?.length === 1 ? 'university' : 'universities'}?`} confirmLabel="Reject" busy={busy === 'reject'}
      onConfirm={() => apply('reject', reject)} onCancel={() => setReject(null)}>
      <p>Rejected records are hidden from students and leave this queue. Use it for duplicates, closed institutions or wrong matches. Later crawls still update them, but they stay rejected.</p>
    </ConfirmDialog>
  </div>;
}

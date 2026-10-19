'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import ResourceForm from '../ResourceForm';
import { formatCount, formatDate, hostOf } from './data-api';
import { useToast } from './useToast';
import styles from './DataOps.module.css';
import table from '../ResourceManager.module.css';

const PAGE_SIZE = 20;
const VIEWS = [['held', 'Held for review', 'held'], ['visible', 'Visible, unverified', 'visible'], ['all', 'All unverified', null]];
const SOURCES = [['', 'Any source'], ['scrape', 'Scraped'], ['import', 'Imported'], ['admin', 'Admin'], ['seed', 'Seed']];
const ACTIONS = {
  verify: { label: 'Verify', done: 'verified and visible' },
  publish: { label: 'Publish', done: 'visible to students' },
  hide: { label: 'Hide', done: 'hidden from students' },
  reject: { label: 'Reject', done: 'rejected and hidden', danger: true },
};

export default function ReviewQueue({ initialView = 'held', initialSource = '' }) {
  const { request } = useAdminSession();
  const [view, setView] = useState(VIEWS.some(([value]) => value === initialView) ? initialView : 'held');
  const [source, setSource] = useState(SOURCES.some(([value]) => value === initialSource) ? initialSource : '');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, counts: null, loading: true, error: '' });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [editor, setEditor] = useState(null);
  const [toast, notify] = useToast();

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); setSelected([]); }, 250); return () => window.clearTimeout(timer); }, [query]);

  const load = useCallback(async (signal) => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    const params = new URLSearchParams({ view, page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('q', search);
    if (source) params.set('source', source);
    try { const data = await request(`/data-ops/review?${params}`, { signal }); setList({ items: data.items, total: data.total, counts: data.counts, loading: false, error: '' }); } catch (failure) {
      if (failure.name !== 'AbortError') setList((previous) => ({ ...previous, loading: false, error: failure.message }));
    }
  }, [page, request, search, source, view]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function apply(action) {
    setBusy(action); setConfirmReject(false);
    try {
      const result = await request('/data-ops/universities/bulk', { method: 'POST', body: { ids: selected, action } });
      notify(`${formatCount(result.matched)} record${result.matched === 1 ? '' : 's'} ${ACTIONS[action].done}.`);
      setSelected([]);
      if (list.items.length === selected.length && page > 1) setPage(page - 1); else load();
    } catch (failure) { notify(failure.message, 'error'); }
    setBusy('');
  }

  async function openEditor(item) {
    setEditor({ item, meta: null, full: null, error: '' });
    try {
      const [{ resources }, { item: full }] = await Promise.all([request('/resources'), request(`/institutions/${item.id}`)]);
      setEditor((current) => (current?.item.id === item.id ? { ...current, meta: resources.institutions, full } : current));
    } catch (failure) { setEditor((current) => current && { ...current, error: failure.message }); }
  }
  async function save(payload) {
    await request(`/institutions/${editor.item.id}`, { method: 'PATCH', body: payload });
    notify(`${payload.name || editor.item.name} saved. Edited fields are now locked against imports and crawls.`);
    setEditor(null);
    load();
  }

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const allSelected = list.items.length > 0 && list.items.every((item) => selected.includes(item.id));
  const change = (setter) => (value) => { setter(value); setPage(1); setSelected([]); };

  return <div className={styles.page}>
    <div className={styles.intro}>
      <p>Imported and scraped universities start <strong>unverified</strong>. Check each record against its source, fix anything wrong, then verify it. Records without a state or official website are held back from students until you publish them.</p>
    </div>
    <div className={styles.filters}>
      <div className={styles.segmentedScroll}><div className={table.segmented} role="group" aria-label="Review view">{VIEWS.map(([value, label, countKey]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => change(setView)(value)}>
        {label}{countKey && list.counts ? ` (${formatCount(list.counts[countKey])})` : ''}
      </button>)}</div></div>
      <select className={styles.select} aria-label="Source" value={source} onChange={(event) => change(setSource)(event.target.value)}>{SOURCES.map(([value, label]) => <option key={label} value={value}>{label}</option>)}</select>
      <label className={table.search}><Icon name="search" /><span className="sr-only">Search universities</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, city or state…" maxLength={120} /></label>
    </div>

    {selected.length > 0 && <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
      <strong>{selected.length} selected</strong>
      {Object.entries(ACTIONS).map(([action, { label, danger }]) => <button key={action} type="button" data-tone={danger ? 'danger' : undefined} disabled={Boolean(busy)} onClick={() => (danger ? setConfirmReject(true) : apply(action))}>{busy === action ? `${label}…` : label}</button>)}
      <button type="button" onClick={() => setSelected([])}>Clear</button>
    </div>}

    <div className={table.tableCard}>
      {list.error ? <div className={table.errorBox} role="alert"><Icon name="shield" />{list.error}<button type="button" className="button button--outline" onClick={() => load()}>Retry</button></div> : <div className={table.tableScroll}>
        <table className={table.table} aria-busy={list.loading} style={{ minWidth: 900 }}>
          <thead><tr>
            <th scope="col"><input type="checkbox" aria-label="Select all universities on this page" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? list.items.map((item) => item.id) : [])} /></th>
            <th scope="col">University</th><th scope="col">Location</th><th scope="col">Source</th><th scope="col">Scraped fields</th><th scope="col">Missing</th><th scope="col">Visibility</th><th scope="col"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {list.loading && !list.items.length && Array.from({ length: 5 }, (_, index) => <tr key={index} className={table.skeletonRow}>{Array.from({ length: 8 }, (__, cell) => <td key={cell}><span /></td>)}</tr>)}
            {list.items.map((item) => <tr key={item.id}>
              <td><input type="checkbox" aria-label={`Select ${item.name}`} checked={selected.includes(item.id)} onChange={(event) => setSelected((previous) => (event.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id)))} /></td>
              <td><div className={table.primaryCell}><strong title={item.name}>{item.name}</strong>{item.website ? <a className={styles.cellLink} href={item.website} target="_blank" rel="noopener noreferrer">{hostOf(item.website)}</a> : <small>{item.slug}</small>}</div></td>
              <td>{[item.city, item.state].filter(Boolean).join(', ') || <span className={table.muted}>—</span>}</td>
              <td>{item.source ? <div className={table.primaryCell}>
                <span>{item.source.kind}{item.source.name ? ` · ${item.source.name}` : ''}</span>
                {item.source.url && <a className={styles.cellLink} href={item.source.url} target="_blank" rel="noopener noreferrer">{hostOf(item.source.url)}</a>}
                {item.source.fetchedAt && <small>Fetched {formatDate(item.source.fetchedAt)}</small>}
              </div> : <span className={table.muted}>—</span>}</td>
              <td>{item.scrapedFields.length ? <div className={styles.chips}>{item.scrapedFields.slice(0, 6).map((field) => <span key={field} className={styles.chip}>{field}</span>)}{item.scrapedFields.length > 6 && <span className={styles.chip}>+{item.scrapedFields.length - 6}</span>}</div> : <span className={table.muted}>—</span>}</td>
              <td>{item.missing.length ? <div className={styles.chips}>{item.missing.map((field) => <span key={field} className={styles.chip} data-tone="warning">{field}</span>)}</div> : <span className={table.muted}>—</span>}</td>
              <td><span className={styles.pill} data-status={item.active ? 'visible' : 'held'}>{item.active ? 'Visible' : 'Held'}</span></td>
              <td className={table.rowActions}><button type="button" className={table.iconButton} onClick={() => openEditor(item)} aria-label={`Edit ${item.name}`} title="Edit"><Icon name="edit" /></button></td>
            </tr>)}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className={table.empty}><Icon name="collegesCheckCircle" /><p>{search || source ? 'Nothing matches these filters.' : view === 'held' ? 'Nothing is held for review.' : 'No unverified universities. Everything has been reviewed.'}</p></div>}
      </div>}
      {pages > 1 && <nav className={table.pagination} aria-label="Pagination"><span>Page {page} of {formatCount(pages)} · {formatCount(list.total)} records</span><div>
        <button type="button" className={table.iconButton} disabled={page <= 1} onClick={() => { setPage(page - 1); setSelected([]); }} aria-label="Previous page"><Icon name="arrow" /></button>
        <button type="button" className={table.iconButton} disabled={page >= pages} onClick={() => { setPage(page + 1); setSelected([]); }} aria-label="Next page"><Icon name="arrow" /></button>
      </div></nav>}
    </div>

    <AdminDrawer open={confirmReject} onClose={() => setConfirmReject(false)} title={`Reject ${selected.length} record${selected.length === 1 ? '' : 's'}?`} variant="confirm">
      <div className={table.confirm}>
        <p>Rejected records are hidden from students and leave the review queue. Use this for duplicates, closed institutions or wrong matches. Later imports and crawls still update them, but they stay rejected.</p>
        <div className={table.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirmReject(false)}>Cancel</button><button type="button" className={`button ${table.dangerButton}`} onClick={() => apply('reject')}>Reject</button></div>
      </div>
    </AdminDrawer>
    <AdminDrawer open={Boolean(editor)} onClose={() => setEditor(null)} title="Edit university" subtitle={editor ? `${editor.item.name}. Fields you change are locked against later imports and crawls.` : ''}>
      {editor?.error && <p className={table.formError} role="alert"><Icon name="shield" />{editor.error}</p>}
      {editor && !editor.error && !editor.meta && <p className={table.help} role="status">Loading…</p>}
      {editor?.meta && editor.full && <ResourceForm key={editor.item.id} meta={editor.meta} mode="edit" item={editor.full} refOptions={{}} onSubmit={save} onCancel={() => setEditor(null)} />}
    </AdminDrawer>
    {toast && <p className={table.toast} data-tone={toast.tone} role="status"><Icon name={toast.tone === 'error' ? 'shield' : 'check'} />{toast.message}</p>}
  </div>;
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import AdminDrawer from '../AdminDrawer';
import { formatCount, formatDate, hostOf } from './data-api';
import { AddSourceForm, SeedUploadForm } from './SourceForms';
import styles from './DataOps.module.css';
import table from '../ResourceManager.module.css';

const PAGE_SIZE = 20;
const STATUS_FILTERS = [['', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['blocked', 'Blocked']];

export default function SourcesPanel({ notify, onChanged, onEnqueue, reloadKey }) {
  const { request } = useAdminSession();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [neverCrawled, setNeverCrawled] = useState(false);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: '' });
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); setSelected([]); }, 250); return () => window.clearTimeout(timer); }, [query]);

  const load = useCallback(async (signal) => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (neverCrawled) params.set('crawled', 'never');
    try { const data = await request(`/data-ops/scraper/sources?${params}`, { signal }); setList({ items: data.items, total: data.total, loading: false, error: '' }); } catch (failure) {
      if (failure.name !== 'AbortError') setList((previous) => ({ ...previous, loading: false, error: failure.message }));
    }
  }, [neverCrawled, page, request, search, status]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load, reloadKey]);

  async function changeStatus(source, next) {
    try {
      const { item } = await request(`/data-ops/scraper/sources/${source.id}`, { method: 'PATCH', body: { status: next } });
      setList((previous) => ({ ...previous, items: previous.items.map((row) => (row.id === item.id ? item : row)) }));
      notify(next === 'active' ? `${source.name} will be crawled again.` : `${source.name} is ${next}; its queued jobs were cancelled.`);
      onChanged();
    } catch (failure) { notify(failure.message, 'error'); }
  }

  async function remove() {
    const source = confirm;
    setConfirm({ ...source, busy: true });
    try {
      await request(`/data-ops/scraper/sources/${source.id}`, { method: 'DELETE' });
      setConfirm(null); setSelected((previous) => previous.filter((id) => id !== source.id));
      notify('Source deleted. Records it already created stay in the catalogue.');
      load(); onChanged();
    } catch (failure) { setConfirm({ ...source, busy: false, error: failure.message }); }
  }

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const allSelected = list.items.length > 0 && list.items.every((item) => selected.includes(item.id));
  const lastResult = (source) => {
    const result = source.lastResult;
    if (!result) return <span className={table.muted}>Never</span>;
    return <div className={table.primaryCell}><span><span className={styles.pill} data-status={result.status}>{result.status}</span></span><small>{formatDate(result.at)}{result.slug ? ` · ${result.slug}` : ''}</small>{result.error && <small className={styles.errorText} title={result.error}>{result.error}</small>}</div>;
  };

  return <div className={table.manager}>
    <div className={table.toolbar}>
      <div className={table.summary}><span className={table.summaryIcon}><Icon name="guidesGlobe" /></span><div><strong>{formatCount(list.total)} sources</strong><small>{search ? `matching “${search}”` : 'Institutions to crawl'}</small></div></div>
      <button type="button" className="button button--outline" onClick={() => setDrawer('upload')}><Icon name="document" />Upload seed list</button>
      <button type="button" className="button button--primary" onClick={() => setDrawer('add')}><Icon name="plus" />Add source</button>
    </div>
    <div className={styles.filters}>
      <div className={styles.segmentedScroll}><div className={table.segmented} role="group" aria-label="Filter by status">{STATUS_FILTERS.map(([value, label]) => <button key={label} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); setSelected([]); }}>{label}</button>)}</div></div>
      <label className={styles.check}><input type="checkbox" checked={neverCrawled} onChange={(event) => { setNeverCrawled(event.target.checked); setPage(1); setSelected([]); }} />Never crawled</label>
      <label className={table.search}><Icon name="search" /><span className="sr-only">Search sources</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or domain…" maxLength={120} /></label>
    </div>

    {selected.length > 0 && <div className={styles.bulkBar} role="region" aria-label="Selected sources">
      <strong>{selected.length} selected</strong>
      <button type="button" onClick={() => onEnqueue({ mode: 'selected', sourceIds: selected }, () => setSelected([]))}>Queue crawl now</button>
      <button type="button" onClick={() => setSelected([])}>Clear</button>
    </div>}

    <div className={table.tableCard}>
      {list.error ? <div className={table.errorBox} role="alert"><Icon name="shield" />{list.error}<button type="button" className="button button--outline" onClick={() => load()}>Retry</button></div> : <div className={table.tableScroll}>
        <table className={table.table} aria-busy={list.loading}>
          <thead><tr>
            <th scope="col"><input type="checkbox" aria-label="Select all sources on this page" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? list.items.map((item) => item.id) : [])} /></th>
            <th scope="col">Institution</th><th scope="col">Location</th><th scope="col">Seed list</th><th scope="col">Last crawl</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>{list.items.map((source) => <tr key={source.id} data-hidden={source.status !== 'active'}>
            <td><input type="checkbox" aria-label={`Select ${source.name}`} checked={selected.includes(source.id)} onChange={(event) => setSelected((previous) => (event.target.checked ? [...previous, source.id] : previous.filter((id) => id !== source.id)))} /></td>
            <td><div className={table.primaryCell}><strong title={source.name}>{source.name}</strong><a className={styles.cellLink} href={source.website} target="_blank" rel="noopener noreferrer">{hostOf(source.website)}</a></div></td>
            <td>{[source.city, source.state].filter(Boolean).join(', ') || <span className={table.muted}>—</span>}</td>
            <td>{source.seedListName || <span className={table.muted}>—</span>}</td>
            <td>{lastResult(source)}</td>
            <td><select className={styles.select} aria-label={`Status of ${source.name}`} value={source.status} onChange={(event) => changeStatus(source, event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="blocked">Blocked (opt-out)</option></select></td>
            <td className={table.rowActions}><button type="button" className={table.iconButton} data-tone="danger" onClick={() => setConfirm(source)} aria-label={`Delete ${source.name}`} title="Delete source"><Icon name="trash" /></button></td>
          </tr>)}</tbody>
        </table>
        {!list.loading && !list.items.length && <div className={table.empty}><Icon name="guidesGlobe" /><p>{search || status || neverCrawled ? 'No sources match these filters.' : 'No crawl sources yet. Upload a seed list or add a source.'}</p></div>}
      </div>}
      {pages > 1 && <nav className={table.pagination} aria-label="Sources pagination"><span>Page {page} of {formatCount(pages)}</span><div>
        <button type="button" className={table.iconButton} disabled={page <= 1} onClick={() => { setPage(page - 1); setSelected([]); }} aria-label="Previous page"><Icon name="arrow" /></button>
        <button type="button" className={table.iconButton} disabled={page >= pages} onClick={() => { setPage(page + 1); setSelected([]); }} aria-label="Next page"><Icon name="arrow" /></button>
      </div></nav>}
    </div>

    <AdminDrawer open={drawer === 'add'} onClose={() => setDrawer('')} title="Add crawl source" subtitle="One institution and its official website.">
      {drawer === 'add' && <AddSourceForm onCancel={() => setDrawer('')} onDone={(item) => { setDrawer(''); notify(`${item.name} added. Queue a crawl to fetch it.`); load(); onChanged(); }} />}
    </AdminDrawer>
    <AdminDrawer open={drawer === 'upload'} onClose={() => setDrawer('')} title="Upload seed list" subtitle="CSV or JSON list of institutions and their official websites.">
      {drawer === 'upload' && <SeedUploadForm onCancel={() => setDrawer('')} onDone={() => { load(); onChanged(); }} />}
    </AdminDrawer>
    <AdminDrawer open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete this source?" variant="confirm">
      {confirm && <div className={table.confirm}>
        <p><strong>{confirm.name}</strong> will no longer be crawled and its queued jobs are cancelled. Universities it already created stay in the catalogue.</p>
        <p className={table.help}>To honour an opt-out or takedown request, set the status to Blocked instead so a later seed upload does not re-add it silently.</p>
        {confirm.error && <p className={table.formError} role="alert"><Icon name="shield" />{confirm.error}</p>}
        <div className={table.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className={`button ${table.dangerButton}`} onClick={remove} disabled={confirm.busy}>{confirm.busy ? 'Deleting…' : 'Delete source'}</button></div>
      </div>}
    </AdminDrawer>
  </div>;
}

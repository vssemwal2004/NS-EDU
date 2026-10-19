'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import ResourceForm from './ResourceForm';
import AdminDrawer from './AdminDrawer';
import { resourceColumns, resourceIcons } from './resource-config';
import styles from './ResourceManager.module.css';

const PAGE_SIZE = 20;
let metaPromise = null;

function useResourceMeta(request) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    metaPromise ||= request('/resources').then((data) => data.resources).catch((failure) => { metaPromise = null; throw failure; });
    metaPromise.then(setMeta).catch((failure) => setError(failure.message));
  }, [request]);
  return { meta, error };
}

export default function ResourceManager({ resource, startCreating = false }) {
  const { request } = useAdminSession();
  const { meta: allMeta, error: metaError } = useResourceMeta(request);
  const meta = allMeta?.[resource];
  const columns = resourceColumns[resource];
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: '' });
  const [editor, setEditor] = useState(startCreating ? { mode: 'create', item: null } : null);
  const [confirm, setConfirm] = useState(null);
  const [refOptions, setRefOptions] = useState({});
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  const notify = useCallback((message, tone = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Debounce typing into the server-side search.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (signal) => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: resource === 'programmes' ? '-updatedAt' : 'order' });
      if (search) params.set('q', search);
      const data = await request(`/${resource}?${params}`, { signal });
      setList({ items: data.items, total: data.total, loading: false, error: '' });
    } catch (failure) {
      if (failure.name !== 'AbortError') setList((previous) => ({ ...previous, loading: false, error: failure.message }));
    }
  }, [page, request, resource, search]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  // Reference fields (programme → institution/course) need option lists and readable labels.
  const refs = useMemo(() => meta ? [...new Set(meta.fields.filter((field) => field.type === 'reference').map((field) => field.ref))] : [], [meta]);
  const needsLabels = resource === 'programmes' ? ['institutions', 'courses'] : [];
  useEffect(() => {
    // Universities are searched on demand (see ReferenceSearch); only small reference lists are preloaded.
    const wanted = [...new Set([...refs, ...needsLabels])].filter((name) => name !== 'institutions');
    if (!wanted.length) return undefined;
    const controller = new AbortController();
    Promise.all(wanted.map((name) => request(`/${name}?limit=100&sort=name`, { signal: controller.signal }).then((data) => [name, data.items.map((item) => ({ value: item.slug, label: item.name }))])))
      .then((entries) => setRefOptions(Object.fromEntries(entries)))
      .catch(() => {});
    return () => controller.abort();
    // needsLabels is derived from `resource`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs, request, resource]);
  const refLabels = useMemo(() => Object.fromEntries(Object.entries(refOptions).map(([name, options]) => [name, Object.fromEntries(options.map((option) => [option.value, option.label]))])), [refOptions]);

  async function save(payload) {
    if (editor.mode === 'create') await request(`/${resource}`, { method: 'POST', body: payload });
    else await request(`/${resource}/${editor.item.id}`, { method: 'PATCH', body: payload });
    notify(`${capitalize(meta.singular)} ${editor.mode === 'create' ? 'created' : 'updated'}. Students see the change immediately.`);
    setEditor(null);
    if (startCreating) window.history.replaceState(window.history.state, '', window.location.pathname);
    load();
  }
  async function remove() {
    const item = confirm;
    setConfirm((previous) => ({ ...previous, busy: true }));
    try {
      await request(`/${resource}/${item.id}`, { method: 'DELETE' });
      setConfirm(null); notify(`${capitalize(meta.singular)} deleted.`);
      if (list.items.length === 1 && page > 1) setPage(page - 1); else load();
    } catch (failure) { setConfirm({ ...item, busy: false, error: failure.message }); }
  }
  async function toggleActive(item) {
    try {
      await request(`/${resource}/${item.id}`, { method: 'PATCH', body: { active: !item.active } });
      setList((previous) => ({ ...previous, items: previous.items.map((row) => row.id === item.id ? { ...row, active: !item.active } : row) }));
      notify(`${titleOf(item, columns, refLabels)} is now ${item.active ? 'hidden from' : 'visible to'} students.`);
    } catch (failure) { notify(failure.message, 'error'); }
  }

  if (metaError) return <div className={styles.errorBox} role="alert"><Icon name="shield" />{metaError}</div>;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const label = meta?.label || resource;

  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}><span className={styles.summaryIcon}><Icon name={resourceIcons[resource]} /></span><div><strong>{list.total.toLocaleString('en-IN')} {label.toLowerCase()}</strong><small>{search ? `matching “${search}”` : 'All records, including hidden ones'}</small></div></div>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search {label.toLowerCase()}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} maxLength={120} /></label>
      <button type="button" className="button button--primary" disabled={!meta} onClick={() => setEditor({ mode: 'create', item: null })}><Icon name="plus" />Add {meta?.singular || 'record'}</button>
    </div>

    <div className={styles.tableCard}>
      {list.error ? <div className={styles.errorBox} role="alert"><Icon name="shield" />{list.error}<button type="button" className="button button--outline" onClick={() => load()}>Retry</button></div> : <div className={styles.tableScroll}>
        <table className={styles.table} aria-busy={list.loading}>
          <thead><tr>{columns.map((column) => <th key={column.label} scope="col">{column.label}</th>)}<th scope="col" className={styles.actionsHead}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {list.loading && !list.items.length && Array.from({ length: 6 }, (_, index) => <tr key={index} className={styles.skeletonRow}>{columns.map((column) => <td key={column.label}><span /></td>)}<td><span /></td></tr>)}
            {list.items.map((item) => <tr key={item.id} data-hidden={item.active === false}>
              {columns.map((column) => <td key={column.label} data-label={column.label}>{renderCell(column, item, refLabels, () => toggleActive(item))}</td>)}
              <td className={styles.rowActions}>
                <button type="button" className={styles.iconButton} onClick={() => setEditor({ mode: 'edit', item })} aria-label={`Edit ${titleOf(item, columns, refLabels)}`} title="Edit"><Icon name="edit" /></button>
                <button type="button" className={styles.iconButton} data-tone="danger" onClick={() => setConfirm(item)} aria-label={`Delete ${titleOf(item, columns, refLabels)}`} title="Delete"><Icon name="trash" /></button>
              </td>
            </tr>)}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className={styles.empty}><Icon name={resourceIcons[resource]} /><p>{search ? `No ${label.toLowerCase()} match “${search}”.` : `No ${label.toLowerCase()} yet.`}</p>{!search && meta && <button type="button" className="button button--primary" onClick={() => setEditor({ mode: 'create', item: null })}><Icon name="plus" />Add the first {meta.singular}</button>}</div>}
      </div>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination">
        <span>Page {page} of {pages}</span>
        <div><button type="button" className={styles.iconButton} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="arrow" /></button><button type="button" className={styles.iconButton} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="arrow" /></button></div>
      </nav>}
    </div>

    <AdminDrawer open={Boolean(editor && meta)} onClose={() => setEditor(null)} title={editor?.mode === 'edit' ? `Edit ${meta?.singular}` : `New ${meta?.singular}`} subtitle={editor?.mode === 'edit' ? titleOf(editor.item, columns, refLabels) : `Add a ${meta?.singular} to the Gyaan Vidhya catalogue.`}>
      {editor && meta && <ResourceForm key={editor.item?.id || 'new'} meta={meta} mode={editor.mode} item={editor.item} refOptions={refOptions} onSubmit={save} onCancel={() => setEditor(null)} />}
    </AdminDrawer>

    <AdminDrawer open={Boolean(confirm)} onClose={() => setConfirm(null)} title={`Delete ${meta?.singular}?`} variant="confirm">
      {confirm && <div className={styles.confirm}>
        <p><strong>{titleOf(confirm, columns, refLabels)}</strong> will be removed permanently. Students will no longer see it.</p>
        <p className={styles.help}>To hide it temporarily instead, switch off “Visible to students”.</p>
        {confirm.error && <p className={styles.formError} role="alert"><Icon name="shield" />{confirm.error}</p>}
        <div className={styles.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className={`button ${styles.dangerButton}`} onClick={remove} disabled={confirm.busy}>{confirm.busy ? 'Deleting…' : 'Delete permanently'}</button></div>
      </div>}
    </AdminDrawer>

    {toast && <p className={styles.toast} data-tone={toast.tone} role="status"><Icon name={toast.tone === 'error' ? 'shield' : 'check'} />{toast.message}</p>}
  </div>;
}

const capitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1);
function titleOf(item, columns, refLabels) {
  const primary = columns.find((column) => column.primary);
  const value = item?.[primary.field];
  return (primary.labelField && item?.[primary.labelField]) || (primary.refLabel ? refLabels[primary.refLabel]?.[value] : null) || value || 'this record';
}
function renderCell(column, item, refLabels, onToggle) {
  const value = item[column.field];
  if (column.badge) return <button type="button" className={styles.badge} data-on={value !== false} onClick={onToggle} title="Toggle visibility">{value !== false ? 'Visible' : 'Hidden'}</button>;
  if (column.primary) {
    const title = (column.labelField && item[column.labelField]) || (column.refLabel ? refLabels[column.refLabel]?.[value] : null) || value;
    const secondary = column.secondary?.(item, refLabels);
    return <div className={styles.primaryCell}><strong>{title}</strong>{secondary && <small>{secondary}</small>}</div>;
  }
  const text = column.format ? column.format(value, item) : value;
  return text === null || text === undefined || text === '' ? <span className={styles.muted}>—</span> : String(text);
}

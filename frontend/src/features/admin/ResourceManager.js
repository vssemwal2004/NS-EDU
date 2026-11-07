'use client';
// The generic catalogue screen (/admin/[resource]): universities, programmes, courses, exams, scholarships,
// cities, states, career fields and counsellors. Server-paginated; the list endpoint returns only the
// table's columns and the editor loads the full record. URL: ?q= prefills the search, ?new=1 / ?add=1 opens "add".
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { resizedImage } from '@/lib/image-url';
import { useAdminSession } from './AdminSession';
import ConfirmDialog from './crm/ConfirmDialog';
import RowMenu from './crm/RowMenu';
import { Chip } from './crm/ui';
import { useToaster } from './crm/toast';
import { PageToolbar, StatStrip } from './ui/Page';
import Pagination from './table/Pagination';
import { useServerList } from './table/useServerList';
import CatalogueTable, { ACTIONS_COLUMN } from './catalogue/CatalogueTable';
import { BulkBar, EmptyState, ErrorState, FilterSelect, SearchBox, StatusDot, useDebounced } from './catalogue/CatalogueParts';
import RecordEditor from './catalogue/RecordEditor';
import { duplicable, extraFilterLabels, resourceColumns, resourceFilters, resourceIcons, sitePath, statStyle } from './resource-config';
import styles from './catalogue/Catalogue.module.css';

const PAGE_SIZES = [25, 50, 100];
// Summary-strip filters that have no select of their own but can be linked to.
const URL_FILTERS = ['source.kind', 'website', 'fees', 'imageUrl', 'popular', 'isMaster', 'verification'];
const VERIFICATION_TONES = { verified: ['good', 'Verified'], unverified: ['warn', 'Unverified'], rejected: ['bad', 'Rejected'] };

let metaPromise = null;
/** Field metadata for every resource this person may edit (one request per console visit). */
export function useResourceMeta(request) {
  const [state, setState] = useState({ meta: null, error: '' });
  const load = useCallback(() => {
    metaPromise ||= request('/resources').then((data) => data.resources).catch((failure) => { metaPromise = null; throw failure; });
    metaPromise.then((meta) => setState({ meta, error: '' })).catch((failure) => setState({ meta: null, error: failure.message }));
  }, [request]);
  useEffect(() => { load(); }, [load]);
  return { ...state, retry: load };
}

const capitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1);
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; } };
const sameQuery = (a, b) => {
  const clean = (value) => Object.entries(value).filter(([, item]) => item !== '' && item != null).sort(([x], [y]) => x.localeCompare(y));
  return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
};

/** Removes the given keys from the address bar without a navigation (Next keeps useSearchParams in sync). */
function dropParams(keys) {
  const url = new URL(window.location.href);
  if (!keys.some((key) => url.searchParams.has(key))) return;
  keys.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export default function ResourceManager({ resource }) {
  const { admin, request } = useAdminSession();
  const { meta: allMeta, error: metaError, retry: retryMeta } = useResourceMeta(request);
  const meta = allMeta?.[resource];
  const toast = useToaster();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q');
  const wantsCreate = searchParams.get('new') === '1' || searchParams.get('add') === '1';

  const [query, setQuery] = useState(urlQuery ?? '');
  // Filters can arrive in the URL too (e.g. ?source.kind=scrape from the data overview).
  const [filters, setFilters] = useState(() => Object.fromEntries([...(resourceFilters[resource] ?? []).map((filter) => filter.key), ...URL_FILTERS]
    .filter((key) => searchParams.get(key)).map((key) => [key, searchParams.get(key)])));
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'delete', item } | { kind: 'bulk', action }
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // The command palette (and other screens) link here with ?q=…; a new value replaces the search box.
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  if (urlQuery !== seenQuery) { setSeenQuery(urlQuery); if (urlQuery !== null) setQuery(urlQuery); }
  // "New" menu, dashboard shortcuts: ?new=1 (or ?add=1) opens the create form once the field metadata is in.
  const [seenCreate, setSeenCreate] = useState(false);
  if (wantsCreate && meta && !seenCreate) { setSeenCreate(true); setEditor({ mode: 'create', key: 'new' }); }
  if (!wantsCreate && seenCreate) setSeenCreate(false);

  const search = useDebounced(query.trim(), 300);
  const listKey = JSON.stringify([search, filters, limit]);
  const page = paging.key === listKey ? paging.page : 1;
  const setPage = (next) => setPaging({ key: listKey, page: next });
  // A selection belongs to one page of one search; it never silently carries over.
  const selectionKey = `${listKey}|${page}`;
  const [selectionFor, setSelectionFor] = useState(selectionKey);
  if (selectionFor !== selectionKey) { setSelectionFor(selectionKey); if (selected.length) setSelected([]); }

  const params = { page, limit, sort: resource === 'programmes' ? '-updatedAt' : 'order', q: search, ...filters };
  const list = useServerList(request, `/${resource}`, params, {
    scope: admin?.id ?? '',
    next: (data, current) => (Number(current.page) * Number(current.limit) < data.total ? { ...current, page: Number(current.page) + 1 } : null),
  });
  const statsList = useServerList(request, `/${resource}/stats`, {}, { scope: admin?.id ?? '' });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const stats = statsList.data;

  // Readable labels for reference slugs (programme → course, counsellor → career field). Small lists only:
  // universities are searched on demand and programmes carry their university's name.
  const [refOptions, setRefOptions] = useState({});
  const refs = useMemo(() => {
    const wanted = new Set((meta?.fields ?? []).filter((field) => field.type === 'reference').map((field) => field.ref));
    if (resource === 'programmes') wanted.add('courses');
    if (resource === 'counsellors') wanted.add('career_fields');
    wanted.delete('institutions');
    return [...wanted].sort().join(',');
  }, [meta, resource]);
  useEffect(() => {
    if (!refs) return undefined;
    const controller = new AbortController();
    Promise.all(refs.split(',').map((name) => request(`/${name}?limit=100&sort=name`, { signal: controller.signal })
      .then((data) => [name, data.items.map((item) => ({ value: item.slug, label: item.name || item.label || item.slug }))])))
      .then((entries) => setRefOptions(Object.fromEntries(entries)))
      .catch(() => {});
    return () => controller.abort();
  }, [refs, request]);
  const refLabels = useMemo(() => Object.fromEntries(Object.entries(refOptions).map(([name, options]) => [name, Object.fromEntries(options.map((option) => [option.value, option.label]))])), [refOptions]);

  const singular = meta?.singular ?? 'record';
  const label = (meta?.label ?? 'records').toLowerCase();
  const primary = resourceColumns[resource].find((column) => column.kind === 'primary');
  const titleOf = (item) => (primary.title?.(item, refLabels) ?? item?.[primary.key]) || 'this record';
  const hasVisibility = Boolean(meta?.fields.some((field) => field.name === 'active'));
  const refresh = () => { list.reload(); statsList.reload(); };

  const closeEditor = () => { setEditor(null); dropParams(['new', 'add']); };
  function onSaved(item, mode) {
    closeEditor();
    toast.success(mode === 'edit' ? `${titleOf(item)} saved.` : `${capitalize(singular)} “${titleOf(item)}” created.`);
    refresh();
  }

  async function setActive(item, next, { undo = true } = {}) {
    try {
      await request(`/${resource}/${item.id}`, { method: 'PATCH', body: { active: next } });
      toast.success(`${titleOf(item)} is now ${next ? 'visible to' : 'hidden from'} students.`, undo ? { action: { label: 'Undo', onClick: () => setActive(item, !next, { undo: false }) } } : undefined);
      refresh();
    } catch (failure) { toast.error(failure.message); }
  }

  async function duplicate(item) {
    try {
      const { item: full } = await request(`/${resource}/${item.id}`);
      const seed = { ...full, slug: '' };
      delete seed.id;
      for (const key of ['name', 'label']) if (seed[key]) seed[key] = `${seed[key]} (copy)`;
      setEditor({ mode: 'copy', seed, title: titleOf(item), key: `copy-${item.id}` });
    } catch (failure) { toast.error(failure.message); }
  }

  const copyText = async (text, what) => {
    try { await window.navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error('Copying is not available in this browser.'); }
  };

  async function runConfirm() {
    setBusy(true); setConfirmError('');
    try {
      if (confirm.kind === 'delete') {
        await request(`/${resource}/${confirm.item.id}`, { method: 'DELETE' });
        toast.success(`${titleOf(confirm.item)} deleted.`);
        if (items.length === 1 && page > 1) setPage(page - 1);
      } else {
        const result = await request(`/${resource}/bulk`, { method: 'POST', body: { ids: selected, action: confirm.action } });
        const verb = { publish: 'now visible to students', unpublish: 'now hidden from students', delete: 'deleted' }[confirm.action];
        const skipped = result.skipped?.length ? ` ${result.skipped.length} skipped: ${result.skipped.slice(0, 2).map((row) => `${row.title} (${row.reason})`).join(', ')}${result.skipped.length > 2 ? '…' : ''}.` : '';
        (result.skipped?.length ? toast.warn : toast.success)(`${result.modified.toLocaleString('en-IN')} ${result.modified === 1 ? singular : label} ${verb}.${skipped}`);
        setSelected([]);
        if (confirm.action === 'delete' && result.modified === items.length && page > 1) setPage(page - 1);
      }
      setConfirm(null);
      refresh();
    } catch (failure) { setConfirmError(failure.message); }
    setBusy(false);
  }

  const openRecord = (item) => setEditor({ mode: 'edit', id: item.id, title: titleOf(item), key: item.id });
  const menuFor = (item) => [
    { key: 'open', label: `Open ${singular}`, icon: 'edit', onSelect: () => openRecord(item) },
    { key: 'site', label: 'View on the site', icon: 'external', href: sitePath[resource]?.(item), hidden: !sitePath[resource] || item.active === false || !item.slug },
    { key: 'duplicate', label: 'Duplicate', icon: 'copy', onSelect: () => duplicate(item), hidden: !duplicable.has(resource) },
    { divider: true },
    { key: 'visibility', label: item.active === false ? 'Publish (show to students)' : 'Unpublish (hide)', icon: item.active === false ? 'eye' : 'eyeOff', onSelect: () => setActive(item, item.active === false), hidden: !hasVisibility },
    { key: 'copy-link', label: 'Copy student link', icon: 'link', onSelect: () => copyText(`${window.location.origin}${sitePath[resource](item)}`, 'Link'), hidden: !sitePath[resource] || !item.slug },
    { key: 'copy-id', label: item.slug ? 'Copy slug' : 'Copy ID', icon: 'copy', onSelect: () => copyText(item.slug || item.id, item.slug ? 'Slug' : 'ID') },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', onSelect: () => { setConfirmError(''); setConfirm({ kind: 'delete', item }); } },
  ];

  function renderCell(column, item) {
    const value = item[column.key];
    switch (column.kind) {
      case 'primary': {
        const sub = column.sub?.(item, refLabels);
        const title = titleOf(item);
        const host = resource === 'institutions' && item.website ? hostOf(item.website) : '';
        const second = [sub, host].filter(Boolean).join(' · ');
        return <div className={styles.primary}>
          <button type="button" className={styles.primaryButton} title={title} onClick={() => openRecord(item)}>{title}</button>
          {second && <span className={styles.sub} title={second}>{second}</span>}
        </div>;
      }
      case 'visibility': return value === false ? <StatusDot tone="neutral">Hidden</StatusDot> : <StatusDot tone="good">Visible</StatusDot>;
      case 'verification': {
        // The one pill a row may carry: an unverified record nobody can see yet is waiting for review.
        if ((value ?? 'unverified') === 'unverified' && item.active === false) return <Chip size="sm" tone="warn" icon="clock" title="Unverified and hidden until someone reviews it">Held for review</Chip>;
        const [tone, text] = VERIFICATION_TONES[value] ?? VERIFICATION_TONES.unverified;
        return <StatusDot tone={tone}>{text}</StatusDot>;
      }
      case 'image': return value
        ? <img className={styles.thumb} src={resizedImage(String(value), 96)} alt="" loading="lazy" width="44" height="28" />
        : <span className={styles.noPhoto}>None</span>;
      case 'link': return value ? <a className={`${styles.link} ${styles.truncate}`} href={value} target="_blank" rel="noopener noreferrer" title={value}>{hostOf(value)}</a> : <span className={styles.muted}>—</span>;
      default: {
        const text = column.format ? column.format(value, item, refLabels) : value;
        if (text === null || text === undefined || text === '') return <span className={styles.muted}>—</span>;
        return <span className={`${styles.truncate} ${column.kind === 'number' ? styles.num : ''}`} title={String(text)}>{String(text)}</span>;
      }
    }
  }

  const columns = [
    ...resourceColumns[resource].map((column) => ({ ...column, align: column.kind === 'number' ? 'end' : undefined, render: (item) => renderCell(column, item) })),
    { ...ACTIONS_COLUMN, render: (item) => <RowMenu label={`Actions for ${titleOf(item)}`} items={menuFor(item)} /> },
  ];

  const filterDefs = resourceFilters[resource] ?? [];
  const filtered = Object.values(filters).some(Boolean);
  const setFilter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value }));
  const statItems = (stats?.stats ?? meta?.stats?.map((stat) => ({ ...stat, value: 0 })) ?? []).slice(0, 6).map((stat) => {
    const active = sameQuery(filters, stat.query) && !(stat.key === 'total' && search);
    return {
      key: stat.key, label: stat.label, value: stat.value, icon: statStyle[stat.key]?.icon ?? (stat.key === 'total' ? resourceIcons[resource] : null), tone: statStyle[stat.key]?.tone,
      active: active && (stat.key !== 'total' || !filtered),
      onClick: () => setFilters(active && stat.key !== 'total' ? {} : { ...stat.query }),
    };
  });

  if (metaError && !meta) return <div className={styles.card}><ErrorState message={metaError} onRetry={retryMeta} /></div>;

  const emptyNode = search || filtered
    ? <EmptyState title={`No ${label} match${search ? ` “${search}”` : ' these filters'}.`} action={<button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); setFilters({}); dropParams(['q']); }}>Clear search and filters</button>} />
    : <EmptyState title={`No ${label} yet.`} action={meta && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setEditor({ mode: 'create', key: 'new' })}><Icon name="plus" />Add {singular}</button>} />;

  return <div className={styles.screen}>
    <PageToolbar start={<>
      <SearchBox label={`Search ${label}`} value={query} onChange={setQuery} placeholder={resource === 'institutions' ? 'Search name, city, state or slug…' : `Search ${label}…`} />
      {filterDefs.map((filter) => {
        const options = filter.options(meta, stats, refLabels);
        return <FilterSelect key={filter.key} label={filter.label} value={filters[filter.key] ?? ''} options={options} onChange={(value) => setFilter(filter.key, value)} />;
      })}
      {Object.entries(filters).filter(([key, value]) => value && !filterDefs.some((filter) => filter.key === key) && !statItems.some((stat) => stat.active)).map(([key, value]) => {
        const [name, describe] = extraFilterLabels[key] ?? [key, (text) => text];
        return <button key={key} type="button" className="adm-btn adm-btn--sm" onClick={() => setFilter(key, '')} aria-label={`Remove filter ${name}: ${describe(value)}`}>{name}: {describe(value)}<Icon name="close" /></button>;
      })}
      {(filtered || search) && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { setQuery(''); setFilters({}); dropParams(['q']); }}>Clear</button>}
    </>}>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon" onClick={refresh} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
      <button type="button" className="adm-btn adm-btn--primary" disabled={!meta} onClick={() => setEditor({ mode: 'create', key: 'new' })}><Icon name="plus" />Add {singular}</button>
    </PageToolbar>

    {statItems.length > 0 && <StatStrip label={`${meta?.label ?? 'Records'} summary`} loading={!stats} items={statItems} />}

    <div className={styles.card}>
      {selected.length > 0 && <BulkBar count={selected.length} onClear={() => setSelected([])}>
        {hasVisibility && <button type="button" className="adm-btn adm-btn--sm" onClick={() => { setConfirmError(''); setConfirm({ kind: 'bulk', action: 'publish' }); }}><Icon name="eye" />Publish</button>}
        {hasVisibility && <button type="button" className="adm-btn adm-btn--sm" onClick={() => { setConfirmError(''); setConfirm({ kind: 'bulk', action: 'unpublish' }); }}><Icon name="eyeOff" />Unpublish</button>}
        <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => { setConfirmError(''); setConfirm({ kind: 'bulk', action: 'delete' }); }}><Icon name="trash" />Delete…</button>
      </BulkBar>}
      <CatalogueTable caption={meta?.label} columns={columns} rows={items} loading={list.loading} busy={list.busy} error={list.error} onRetry={list.reload}
        pageSize={Math.min(limit, 15)} selectable selected={selected} onSelectionChange={setSelected} rowLabel={titleOf} onRowClick={openRecord}
        rowMuted={(item) => item.active === false} stickyOffset={selected.length ? 40 : 0} empty={emptyNode} />
      {(items.length > 0 || page > 1) && <Pagination page={page} pageSize={limit} pageSizes={PAGE_SIZES} total={total} rowCount={items.length} noun={label}
        hasNext={page * limit < total} hasPrevious={page > 1} disabled={list.busy} onPage={setPage} onPageSize={(size) => setLimit(size)} />}
    </div>

    <RecordEditor resource={resource} meta={meta} editor={editor} refOptions={refOptions} onClose={closeEditor} onSaved={onSaved} />

    <ConfirmDialog open={confirm?.kind === 'delete'} tone="danger" icon="trash" title={`Delete this ${singular}?`} confirmLabel="Delete permanently" busy={busy} error={confirmError}
      requireText={resource === 'institutions' ? 'DELETE' : undefined} onConfirm={runConfirm} onCancel={() => setConfirm(null)}>
      {confirm?.kind === 'delete' && <p><strong>{titleOf(confirm.item)}</strong> is removed permanently and students no longer see it.{hasVisibility ? ' To hide it for now instead, use Unpublish.' : ''}</p>}
    </ConfirmDialog>

    <ConfirmDialog open={confirm?.kind === 'bulk'} tone={confirm?.action === 'delete' ? 'danger' : 'primary'} icon={confirm?.action === 'delete' ? 'trash' : confirm?.action === 'publish' ? 'eye' : 'eyeOff'}
      title={confirm?.action === 'delete' ? `Delete ${selected.length} ${selected.length === 1 ? singular : label}?` : confirm?.action === 'publish' ? `Publish ${selected.length} ${selected.length === 1 ? singular : label}?` : `Unpublish ${selected.length} ${selected.length === 1 ? singular : label}?`}
      confirmLabel={confirm?.action === 'delete' ? 'Delete permanently' : confirm?.action === 'publish' ? 'Publish' : 'Unpublish'} busy={busy} error={confirmError}
      requireText={confirm?.action === 'delete' && (selected.length >= 5 || resource === 'institutions') ? 'DELETE' : undefined} onConfirm={runConfirm} onCancel={() => setConfirm(null)}>
      {confirm?.action === 'delete'
        ? <p>The selected records are removed permanently. Anything still in use (for example a {singular} with programmes) is skipped and listed afterwards.</p>
        : <p>{confirm?.action === 'publish' ? 'Students will see' : 'Students will no longer see'} the {selected.length} selected {selected.length === 1 ? singular : label}. You can change this back at any time.</p>}
    </ConfirmDialog>
  </div>;
}

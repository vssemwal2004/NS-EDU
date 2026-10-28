'use client';
/**
 * Admin leads list: status chips, search, filter drawer, column picker, download dialog, paging and bulk assign.
 *
 * Embeddable (e.g. the submissions of one school drive):
 *   <LeadsManager
 *     initial={searchParams}      // starting filters (the URL params on /admin/leads)
 *     fixedFilters={{ form: id }} // merged into every list/count/export request; hidden from the drawer, chips and URL
 *     syncUrl={false}             // default true: filters, page, rows per page and sort live in the /admin/leads URL
 *     formId={id}                 // scopes GET /leads/columns (adds that form's answer columns) and the saved column choice;
 *                                 // implies fixedFilters={{ form: id }} so answer columns always have their form in scope
 *     heading="Registrations" />  // toolbar title (default "All leads")
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { useAdminSession } from '@/features/admin/AdminSession';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import ActiveFilterChips from '@/features/admin/table/ActiveFilterChips';
import ColumnPicker from '@/features/admin/table/ColumnPicker';
import DataTable from '@/features/admin/table/DataTable';
import ExportDialog from '@/features/admin/table/ExportDialog';
import FilterDrawer, { splitList } from '@/features/admin/table/FilterDrawer';
import Pagination from '@/features/admin/table/Pagination';
import { useColumnPrefs } from '@/features/admin/table/useColumnPrefs';
import { toQuery, useServerList } from '@/features/admin/table/useServerList';
import { activeFilterCount, apiFilterParams, DRAWER_KEYS, EMPTY_FILTERS, leadFilterChips, leadFilterSections, readFilters, urlParams, withoutPaging } from './lead-filters';
import { channelLabel, channelOf, formatCount, isQuick, LEAD_PAGE_SIZES, LEAD_STATUSES, LEADS_QUERY_KEY, leadStatusLabel, statusTone } from './lead-format';
import styles from './Leads.module.css';

const NO_FILTERS = {};
const NOUN = { one: 'lead', many: 'leads' };
// Shown while /leads/columns loads so the skeleton has a familiar shape.
const PLACEHOLDER_COLUMNS = ['Reference', 'Submitted', 'Status', 'Source', 'Full name', 'Mobile'].map((label) => ({ key: label, label }));

// Prefetch target after a page loads: the next numbered page, or the next cursor page past the skip limit.
// Matches what Pagination asks for, so a click on Next is usually served from the cache.
function nextPage(data, params) {
  if (!data?.hasNext) return null;
  const page = Number(params.page || 1) + 1;
  const reachable = Math.floor(data.maxSkip / Number(params.limit || LEAD_PAGE_SIZES[0])) + 1;
  return page <= reachable ? { ...params, page, cursor: '', dir: '' } : { ...params, page, cursor: data.cursors?.last ?? '', dir: 'after' };
}

function renderCell(item, column) {
  const value = item.values?.[column.key];
  const blank = value === '' || value === null || value === undefined;
  switch (column.key) {
    case 'ref': return <><Link className={styles.refLink} href={`/admin/leads/${item.id}`}>{item.ref}</Link>{isQuick(item) && <span className={styles.mode} title="Submitted with the one-screen quick apply form">Quick</span>}</>;
    case 'status': return <span className={styles.status} data-tone={statusTone(item.status)}>{leadStatusLabel(item.status)}</span>;
    case 'channel': return <span className={styles.channel} data-channel={channelOf(item)}>{channelLabel(channelOf(item))}</span>;
    case 'fullName': return <strong>{item.applicant?.fullName || 'Not provided'}</strong>;
    case 'phone': return blank ? <span className={styles.none}>—</span> : <a className={styles.cellLink} href={`tel:${value}`}>{value}</a>;
    case 'assigned': return blank ? <small className={styles.unassigned}>Unassigned</small> : <small className={styles.assignees}>{value}</small>;
    default: return blank ? <span className={styles.none}>—</span> : String(value);
  }
}

export default function LeadsManager({ initial = NO_FILTERS, fixedFilters = NO_FILTERS, syncUrl = true, formId = '', heading = 'All leads' }) {
  const { admin, request } = useAdminSession();
  const isAdmin = admin?.role === 'admin';
  const scope = admin?.id ?? '';
  const fixedKey = toQuery({ ...(formId && { form: formId }), ...fixedFilters });
  const fixed = useMemo(() => Object.fromEntries(new URLSearchParams(fixedKey)), [fixedKey]);
  const hidden = useMemo(() => Object.keys(fixed), [fixed]);
  const scoped = hidden.length > 0;

  const [filters, setFilters] = useState(() => {
    const start = readFilters(initial);
    return { ...start, ...Object.fromEntries(hidden.map((key) => [key, ''])) };
  });
  const [query, setQuery] = useState(filters.q);
  const [panel, setPanel] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState([]);
  const [bulkState, setBulkState] = useState({ busy: false, error: '' });
  const [toast, setToast] = useState('');

  // A school drive chosen in the filters (or fixed by the embedding page) adds that form's answer columns.
  const columnsForm = fixed.form || formId || filters.form;
  const columnsInfo = useServerList(request, '/leads/columns', { form: columnsForm }, { scope });
  const options = useServerList(request, '/leads/filter-options', {}, { scope }).data;
  // Status counts exist for all leads or for one school drive; other fixed scopes hide them.
  const statsScoped = hidden.length === 1 && hidden[0] === 'form';
  const stats = useServerList(request, '/leads/stats', statsScoped ? { form: fixed.form } : {}, { scope, enabled: !scoped || statsScoped });
  const available = useMemo(() => columnsInfo.data?.items.map((column) => column.key) ?? [], [columnsInfo.data]);
  const defaults = useMemo(() => columnsInfo.data?.defaults ?? [], [columnsInfo.data]);
  const [visibleKeys, saveColumns] = useColumnPrefs(admin ? `gv-admin-cols:leads:${admin.id}${formId ? `:${formId}` : ''}` : '', available, defaults);
  const columnsReady = Boolean(columnsInfo.data) && !columnsInfo.busy && visibleKeys.length > 0;

  const filterParams = useMemo(() => apiFilterParams(filters, fixed), [filters, fixed]);
  const list = useServerList(request, '/leads', {
    ...filterParams, page: filters.page, limit: filters.limit, sort: filters.sort === 'newest' ? '' : filters.sort,
    cursor: filters.cursor, dir: filters.dir, columns: visibleKeys.join(','),
  }, { scope, enabled: columnsReady, next: nextPage });
  const data = list.data;
  const items = data?.items ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim();
      setFilters((current) => (current.q === q ? current : { ...withoutPaging(current), q }));
      setSelectedIds([]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Filters live in the URL (shareable, survive Back) and in session storage for the detail page's back link.
  useEffect(() => {
    if (!syncUrl) return;
    const search = toQuery(urlParams(filters));
    window.history.replaceState(null, '', `/admin/leads${search ? `?${search}` : ''}`);
    try { window.sessionStorage.setItem(LEADS_QUERY_KEY, search ? `?${search}` : ''); } catch { /* storage unavailable */ }
  }, [filters, syncUrl]);

  useEffect(() => {
    if (!isAdmin) return;
    request('/employees').then(({ items: rows }) => setEmployees(rows)).catch(() => {});
  }, [isAdmin, request]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const update = useCallback((patch, { keepPage = false } = {}) => {
    setFilters((current) => ({ ...(keepPage ? current : withoutPaging(current)), ...patch }));
    setSelectedIds([]);
  }, []);
  const countFor = useCallback((draft, signal) => request(`/leads?${toQuery({ ...apiFilterParams(draft, fixed), limit: LEAD_PAGE_SIZES[0] })}`, { signal }).then((result) => result.total), [fixed, request]);
  const close = () => setPanel('');
  function clearAll() {
    setQuery('');
    setFilters((current) => ({ ...readFilters({}), limit: current.limit, sort: current.sort }));
    setSelectedIds([]);
  }

  async function saveBulk() {
    setBulkState({ busy: true, error: '' });
    try {
      const { count } = await request('/leads/assignments/bulk', { method: 'POST', body: { applicationIds: selectedIds, employeeIds: bulkEmployeeIds } });
      setPanel(''); setSelectedIds([]); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' });
      setToast(`Employees added to ${count} ${count === 1 ? 'lead' : 'leads'}.`);
      list.reload(); stats.reload();
    } catch (failure) { setBulkState({ busy: false, error: failure.message }); }
  }

  const statuses = splitList(filters.status);
  const counts = new Map((stats.data?.byStatus ?? []).map((row) => [row.status, row.count]));
  const showCounts = (!scoped || statsScoped) && Boolean(stats.data);
  const sections = leadFilterSections({ options, employees, isAdmin, hidden });
  const chips = leadFilterChips({ filters, options, employees, hidden, onChange: (patch) => update(patch) });
  const filterCount = activeFilterCount(filters, hidden);
  const anyFilter = filterCount > 0 || Boolean(filters.q);
  const tableColumns = columnsInfo.data
    ? visibleKeys.map((key) => columnsInfo.data.items.find((column) => column.key === key)).filter(Boolean).map((column) => ({ ...column, className: column.key === 'ref' ? styles.refCell : undefined }))
    : PLACEHOLDER_COLUMNS;
  const totalText = !data ? 'Loading leads…' : data.total === null ? 'Many leads (count timed out)' : `${formatCount(data.total)} ${data.total === 1 ? 'lead' : 'leads'}`;
  const newToday = stats.data?.last14Days?.at(-1)?.count;

  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}>
        <span className={styles.summaryIcon}><Icon name="eligibility" /></span>
        <div><strong>{heading}</strong>
          <small aria-live="polite">{totalText}{(!scoped || statsScoped) && typeof newToday === 'number' ? ` · ${formatCount(newToday)} today` : ''}{!isAdmin && admin ? ' · assigned to you' : ''}</small></div>
      </div>
      <div className={styles.toolbarActions}>
        {isAdmin && selectedIds.length > 0 && <button type="button" className="button button--primary" onClick={() => { setPanel('assign'); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' }); }}><Icon name="people" />Assign {selectedIds.length}</button>}
        <button type="button" className="button button--outline" aria-haspopup="dialog" onClick={() => setPanel('filters')}>
          <Icon name="filter" />Filters{filterCount > 0 && <span className={styles.count} aria-label={`${filterCount} active`}>{filterCount}</span>}
        </button>
        <button type="button" className="button button--outline" aria-haspopup="dialog" disabled={!columnsInfo.data} onClick={() => setPanel('columns')}><Icon name="layers" />Columns</button>
        {isAdmin && <button type="button" className="button button--outline" aria-haspopup="dialog" disabled={!columnsInfo.data} onClick={() => setPanel('export')}><Icon name="document" />Download</button>}
      </div>
    </div>

    <div className={styles.chips} role="group" aria-label="Filter by status">
      <button type="button" aria-pressed={!statuses.length} onClick={() => update({ status: '' })}>All{showCounts && <span>{formatCount(stats.data.total)}</span>}</button>
      {LEAD_STATUSES.map((status) => <button key={status.value} type="button" aria-pressed={statuses.includes(status.value)} data-tone={statusTone(status.value)}
        onClick={() => update({ status: statuses.length === 1 && statuses[0] === status.value ? '' : status.value })}>
        {status.label}{showCounts && <span>{formatCount(counts.get(status.value) ?? 0)}</span>}
      </button>)}
    </div>

    <div className={styles.filterBar}>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search leads</span>
        <input type="search" value={query} maxLength={100} placeholder="Search ref, name, mobile or email…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className={styles.sort}><span className="sr-only">Sort</span>
        <select className={styles.select} value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
      </label>
    </div>
    <ActiveFilterChips chips={chips} onClearAll={anyFilter || statuses.length ? clearAll : null} />

    <div className={styles.tableCard}>
      <DataTable columns={tableColumns} rows={items} loading={list.loading} busy={list.busy || columnsInfo.busy} pageSize={filters.limit}
        caption={`Leads, ${filters.sort === 'oldest' ? 'oldest' : 'newest'} first`} scrollKey={`${filters.page}|${filters.cursor}`}
        error={columnsInfo.error || list.error} onRetry={columnsInfo.error ? columnsInfo.reload : list.reload}
        selectable={isAdmin} selectedIds={selectedIds} onSelectionChange={setSelectedIds} rowLabel={(item) => item.ref} renderCell={renderCell}
        empty={<><Icon name="eligibility" /><p>{anyFilter || statuses.length ? 'No leads match these filters.' : isAdmin ? 'No leads yet. They appear here when students apply, register at a school drive or ask for a callback.' : 'No leads are assigned to you yet.'}</p>
          {(anyFilter || statuses.length > 0) && <button type="button" className="button button--outline" onClick={clearAll}>Clear filters</button>}</>} />
      {data && !list.error && (items.length > 0 || filters.page > 1) && <Pagination page={filters.page} pageSize={filters.limit} pageSizes={LEAD_PAGE_SIZES}
        total={data.total} totalExact={data.totalExact} rowCount={items.length} hasNext={data.hasNext} hasPrevious={data.hasPrevious} maxSkip={data.maxSkip}
        disabled={list.busy} noun="leads"
        onPage={(page) => update({ page, cursor: '', dir: '' }, { keepPage: true })}
        onPageSize={(limit) => update({ limit })}
        onNext={() => update({ page: filters.page + 1, cursor: data.cursors?.last ?? '', dir: 'after' }, { keepPage: true })}
        onPrevious={() => update({ page: Math.max(1, filters.page - 1), cursor: data.cursors?.first ?? '', dir: 'before' }, { keepPage: true })} />}
    </div>

    <FilterDrawer open={panel === 'filters'} onClose={close} title="Filter leads" subtitle="Combine any filters; the count updates as you choose."
      sections={sections} value={filters} emptyValue={EMPTY_FILTERS} countFor={countFor} noun={NOUN}
      onApply={(draft) => { update(Object.fromEntries(DRAWER_KEYS.filter((key) => !hidden.includes(key)).map((key) => [key, draft[key] ?? '']))); close(); }} />
    {columnsInfo.data && <ColumnPicker open={panel === 'columns'} onClose={close} columns={columnsInfo.data.items} value={visibleKeys} defaults={defaults}
      onApply={(keys) => { saveColumns(keys.join(',') === defaults.join(',') ? null : keys); close(); }} />}
    {isAdmin && columnsInfo.data && <ExportDialog open={panel === 'export'} onClose={close} request={request} checkPath="/leads/export/check" downloadPath="/api/admin/leads/export"
      columns={columnsInfo.data.items} visibleKeys={visibleKeys} formats={columnsInfo.data.formats ?? []} params={filterParams} noun={NOUN} onDone={setToast} />}

    <AdminDrawer open={panel === 'assign'} onClose={close} title={`Assign ${selectedIds.length} ${selectedIds.length === 1 ? 'lead' : 'leads'}`}>
      <div className={drawerStyles.form}>
        <p className={drawerStyles.help}>Selected employees are added to every selected lead. Existing assignments stay in place.</p>
        {employees.map((employee) => <label className={drawerStyles.switch} key={employee.id}><input type="checkbox" checked={bulkEmployeeIds.includes(employee.id)} onChange={(event) => setBulkEmployeeIds((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} /><span /><span>{employee.email}</span></label>)}
        {!employees.length && <p className={drawerStyles.help}>Add an employee before assigning leads.</p>}
        {bulkState.error && <p className={drawerStyles.formError} role="alert">{bulkState.error}</p>}
        <div className={drawerStyles.formActions}><button type="button" className="button button--ghost" onClick={close}>Cancel</button><button type="button" className="button button--primary" disabled={bulkState.busy || !bulkEmployeeIds.length} onClick={saveBulk}>{bulkState.busy ? 'Saving…' : 'Assign employees'}</button></div>
      </div>
    </AdminDrawer>
    {toast && <p className={drawerStyles.toast} role="status"><Icon name="check" />{toast}</p>}
  </div>;
}

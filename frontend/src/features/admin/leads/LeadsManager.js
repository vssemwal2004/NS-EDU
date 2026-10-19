'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { useAdminSession } from '@/features/admin/AdminSession';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import UniversityCombobox from '@/features/apply/UniversityCombobox';
import { INDIAN_STATES } from '@/features/apply/apply-options';
import { api } from '@/lib/api/client';
import { courseText, FILTER_KEYS, formatDateTime, isQuick, LEAD_MODES, LEAD_STATUSES, LEADS_QUERY_KEY, leadStatusLabel, placeText, statusTone } from './lead-format';
import styles from './Leads.module.css';

const PAGE_SIZE = 20;
const ADVANCED = ['institution', 'course', 'state', 'mode', 'from', 'to', 'assignee'];

function readFilters(source) {
  const value = (key) => String((Array.isArray(source[key]) ? source[key][0] : source[key]) ?? '').trim().slice(0, 120);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, value(key)]));
  filters.page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  if (filters.status && !LEAD_STATUSES.some((item) => item.value === filters.status)) filters.status = '';
  if (filters.mode && !LEAD_MODES.some((item) => item.value === filters.mode)) filters.mode = '';
  return filters;
}
function toQuery(filters, { withPage = true, withNames = false } = {}) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (key === 'page' ? withPage && value > 1 : key === 'institutionName' ? withNames && filters.institution && value : value) params.set(key, String(value));
  }
  return params.toString();
}

export default function LeadsManager({ initial = {} }) {
  const { admin, request } = useAdminSession();
  const isAdmin = admin?.role === 'admin';
  const [filters, setFilters] = useState(() => readFilters(initial));
  const [query, setQuery] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(() => ADVANCED.some((key) => filters[key]));
  const [list, setList] = useState({ key: null, items: [], total: 0, error: '' });
  const [stats, setStats] = useState(null);
  const [version, setVersion] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState([]);
  const [bulkState, setBulkState] = useState({ busy: false, error: '' });
  const [toast, setToast] = useState('');

  const key = useMemo(() => toQuery(filters), [filters]);
  const loading = list.key !== key;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim();
      setFilters((current) => (current.q === q ? current : { ...current, q, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Filters live in the URL (shareable, survive Back) and in session storage for the detail page's back link.
  useEffect(() => {
    const search = toQuery(filters, { withNames: true });
    window.history.replaceState(null, '', `/admin/leads${search ? `?${search}` : ''}`);
    try { window.sessionStorage.setItem(LEADS_QUERY_KEY, search ? `?${search}` : ''); } catch { /* storage unavailable */ }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    request(`/leads?${key}${key ? '&' : ''}limit=${PAGE_SIZE}`, { signal: controller.signal })
      .then((data) => setList({ key, items: data.items, total: data.total, error: '' }))
      .catch((failure) => { if (failure.name !== 'AbortError') setList({ key, items: [], total: 0, error: failure.message }); });
    return () => controller.abort();
  }, [key, request, version]);

  useEffect(() => {
    const controller = new AbortController();
    request('/leads/stats', { signal: controller.signal }).then(setStats).catch(() => {});
    return () => controller.abort();
  }, [request, version]);
  useEffect(() => {
    if (!isAdmin) return;
    request('/employees').then(({ items }) => setEmployees(items)).catch(() => {});
  }, [isAdmin, request]);
  useEffect(() => {
    api('/catalog/courses').then(({ items }) => setCourses(items)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function change(patch) {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
    setSelectedIds([]);
  }
  function clearAll() {
    setQuery('');
    setFilters(readFilters({}));
    setSelectedIds([]);
  }

  async function saveBulk() {
    setBulkState({ busy: true, error: '' });
    try {
      const { count } = await request('/leads/assignments/bulk', { method: 'POST', body: { applicationIds: selectedIds, employeeIds: bulkEmployeeIds } });
      setBulkOpen(false); setSelectedIds([]); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' });
      setToast(`Employees added to ${count} ${count === 1 ? 'lead' : 'leads'}.`);
      setVersion((current) => current + 1);
    } catch (failure) { setBulkState({ busy: false, error: failure.message }); }
  }

  const employeeEmail = (id) => employees.find((employee) => employee.id === id)?.email;
  const counts = new Map((stats?.byStatus ?? []).map((row) => [row.status, row.count]));
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const allSelected = list.items.length > 0 && list.items.every((item) => selectedIds.includes(item.id));
  const activeFilters = ADVANCED.filter((name) => filters[name]).length;
  const exportQuery = toQuery(filters, { withPage: false });
  const newToday = stats?.last14Days?.at(-1)?.count ?? 0;

  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}>
        <span className={styles.summaryIcon}><Icon name="eligibility" /></span>
        <div><strong>{loading && list.key === null ? 'Loading leads…' : `${list.total.toLocaleString('en-IN')} ${list.total === 1 ? 'lead' : 'leads'}`}</strong>
          <small>{isAdmin ? `Applications from the Apply flow · ${newToday} today` : 'Leads assigned to you for follow-up'}</small></div>
      </div>
      {isAdmin && selectedIds.length > 0 && <button type="button" className="button button--primary" onClick={() => { setBulkOpen(true); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' }); }}><Icon name="people" />Assign {selectedIds.length}</button>}
      {isAdmin && <a className="button button--outline" href={`/api/admin/leads/export.csv${exportQuery ? `?${exportQuery}` : ''}`} download><Icon name="document" />Export CSV</a>}
    </div>

    <div className={styles.chips} role="group" aria-label="Filter by status">
      <button type="button" aria-pressed={!filters.status} onClick={() => change({ status: '' })}>All<span>{stats ? stats.total : '–'}</span></button>
      {LEAD_STATUSES.map((status) => <button key={status.value} type="button" aria-pressed={filters.status === status.value} data-tone={statusTone(status.value)} onClick={() => change({ status: status.value })}>
        {status.label}<span>{stats ? counts.get(status.value) ?? 0 : '–'}</span>
      </button>)}
    </div>

    <div className={styles.filterBar}>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search leads</span>
        <input type="search" value={query} maxLength={100} placeholder="Search ref, name, email or mobile…" onChange={(event) => { setQuery(event.target.value); setSelectedIds([]); }} />
      </label>
      <button type="button" className="button button--ghost" aria-expanded={showFilters} aria-controls="lead-filters" onClick={() => setShowFilters(!showFilters)}>
        <Icon name="filter" />Filters{activeFilters > 0 && <span className={styles.count}>{activeFilters}</span>}
      </button>
      {(activeFilters > 0 || filters.status || filters.q) && <button type="button" className={styles.textButton} onClick={clearAll}>Clear all</button>}
    </div>

    {showFilters && <div id="lead-filters" className={styles.filters}>
      <div className={styles.filterField} data-wide="true">
        <label htmlFor="lead-filter-university">University</label>
        <UniversityCombobox id="lead-filter-university" size="small" placeholder="Any university" value={filters.institution ? { id: filters.institution, name: filters.institutionName || filters.institution } : null}
          onSelect={(university) => change({ institution: university?.id ?? '', institutionName: university?.name ?? '' })} />
      </div>
      <div className={styles.filterField}>
        <label htmlFor="lead-filter-course">Course</label>
        <select id="lead-filter-course" className={drawerStyles.input} value={filters.course} onChange={(event) => change({ course: event.target.value })}>
          <option value="">Any course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
        </select>
      </div>
      <div className={styles.filterField}>
        <label htmlFor="lead-filter-state">Student’s state</label>
        <select id="lead-filter-state" className={drawerStyles.input} value={filters.state} onChange={(event) => change({ state: event.target.value })}>
          <option value="">Any state</option>{INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}
        </select>
      </div>
      <div className={styles.filterField}>
        <label htmlFor="lead-filter-mode">Form</label>
        <select id="lead-filter-mode" className={drawerStyles.input} value={filters.mode} onChange={(event) => change({ mode: event.target.value })}>
          <option value="">Any form</option>{LEAD_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
      </div>
      <div className={styles.filterField}>
        <label htmlFor="lead-filter-from">Submitted from</label>
        <input id="lead-filter-from" className={drawerStyles.input} type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => change({ from: event.target.value })} />
      </div>
      <div className={styles.filterField}>
        <label htmlFor="lead-filter-to">Submitted to</label>
        <input id="lead-filter-to" className={drawerStyles.input} type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => change({ to: event.target.value })} />
      </div>
      {isAdmin && <div className={styles.filterField}>
        <label htmlFor="lead-filter-assignee">Assigned to</label>
        <select id="lead-filter-assignee" className={drawerStyles.input} value={filters.assignee} onChange={(event) => change({ assignee: event.target.value })}>
          <option value="">Anyone</option><option value="unassigned">Unassigned</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.email}</option>)}
        </select>
      </div>}
    </div>}

    <div className={styles.tableCard}>
      {list.error ? <div className={styles.errorBox} role="alert"><Icon name="shield" /><p>{list.error}</p><button type="button" className="button button--outline" onClick={() => setVersion((current) => current + 1)}>Try again</button></div>
        : <table className={styles.table} aria-busy={loading}>
          <caption className="sr-only">Leads, newest first</caption>
          <thead><tr>
            {isAdmin && <th scope="col" className={styles.checkCell}><input type="checkbox" aria-label="Select all leads on this page" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? list.items.map((item) => item.id) : [])} /></th>}
            <th scope="col">Lead</th><th scope="col">Applicant</th><th scope="col">University &amp; course</th><th scope="col">Status</th>{isAdmin && <th scope="col">Assigned</th>}
          </tr></thead>
          <tbody>{list.items.map((item) => <tr key={item.id} data-selected={selectedIds.includes(item.id) || undefined}>
            {isAdmin && <td className={styles.checkCell}><input type="checkbox" aria-label={`Select ${item.ref}`} checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td>}
            <td data-label="Lead"><Link className={styles.refLink} href={`/admin/leads/${item.id}`}>{item.ref}</Link>{isQuick(item) && <span className={styles.mode} title="Submitted with the one-screen quick apply form">Quick</span>}<small>{formatDateTime(item.createdAt)}</small></td>
            <td data-label="Applicant"><strong>{item.applicant.fullName || 'Not provided'}</strong><small>{[item.applicant.phone, item.applicant.email].filter(Boolean).join(' · ') || 'Not provided'}</small><small>{placeText(item.applicant) || 'Location not provided'}</small></td>
            <td data-label="University"><strong>{item.preference.institutionName}</strong><small>{courseText(item.preference)} · {item.preference.intakeYear}</small></td>
            <td data-label="Status"><span className={styles.status} data-tone={statusTone(item.status)}>{leadStatusLabel(item.status)}</span></td>
            {isAdmin && <td data-label="Assigned">{item.assignedEmployeeIds.length ? <small className={styles.assignees}>{item.assignedEmployeeIds.map((id) => employeeEmail(id) || 'Employee').join(', ')}</small> : <small className={styles.unassigned}>Unassigned</small>}</td>}
          </tr>)}</tbody>
        </table>}
      {!list.error && !loading && !list.items.length && <div className={styles.empty}><Icon name="eligibility" /><p>{filters.q || filters.status || activeFilters ? 'No leads match these filters.' : isAdmin ? 'No applications yet. They appear here when students apply through /apply.' : 'No leads are assigned to you yet.'}</p></div>}
      {loading && list.key === null && <p className={styles.loadingRow} role="status">Loading leads…</p>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination">
        <span>Page {filters.page} of {pages}</span>
        <div>
          <button type="button" className={styles.pageButton} disabled={filters.page <= 1} onClick={() => { setFilters((current) => ({ ...current, page: current.page - 1 })); setSelectedIds([]); }} aria-label="Previous page"><Icon name="arrow" /></button>
          <button type="button" className={styles.pageButton} disabled={filters.page >= pages} onClick={() => { setFilters((current) => ({ ...current, page: current.page + 1 })); setSelectedIds([]); }} aria-label="Next page"><Icon name="arrow" /></button>
        </div>
      </nav>}
    </div>

    <AdminDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Assign ${selectedIds.length} ${selectedIds.length === 1 ? 'lead' : 'leads'}`}>
      <div className={drawerStyles.form}>
        <p className={drawerStyles.help}>Selected employees are added to every selected lead. Existing assignments stay in place.</p>
        {employees.map((employee) => <label className={drawerStyles.switch} key={employee.id}><input type="checkbox" checked={bulkEmployeeIds.includes(employee.id)} onChange={(event) => setBulkEmployeeIds((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} /><span /><span>{employee.email}</span></label>)}
        {!employees.length && <p className={drawerStyles.help}>Add an employee before assigning leads.</p>}
        {bulkState.error && <p className={drawerStyles.formError} role="alert">{bulkState.error}</p>}
        <div className={drawerStyles.formActions}><button type="button" className="button button--ghost" onClick={() => setBulkOpen(false)}>Cancel</button><button type="button" className="button button--primary" disabled={bulkState.busy || !bulkEmployeeIds.length} onClick={saveBulk}>{bulkState.busy ? 'Saving…' : 'Assign employees'}</button></div>
      </div>
    </AdminDrawer>
    {toast && <p className={drawerStyles.toast} role="status"><Icon name="check" />{toast}</p>}
  </div>;
}

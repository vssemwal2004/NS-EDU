'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import AdminDrawer from './AdminDrawer';
import styles from './ResourceManager.module.css';

const PAGE_SIZE = 20;
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const format = (value) => value ? dateTime.format(new Date(value)) : '—';
const filters = [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }];

export default function StudentsManager() {
  const { request } = useAdminSession();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, loading: true, error: '' });
  const [confirm, setConfirm] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [assignedIds, setAssignedIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState([]);
  const [bulkState, setBulkState] = useState({ busy: false, error: '' });
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    request('/employees').then(({ items }) => setEmployees(items)).catch(() => {});
  }, [request]);

  const load = useCallback(async (signal) => {
    setList((previous) => ({ ...previous, loading: true, error: '' }));
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    try { const data = await request(`/students?${params}`, { signal }); setList({ items: data.items, total: data.total, loading: false, error: '' }); } catch (failure) {
      if (failure.name !== 'AbortError') setList((previous) => ({ ...previous, loading: false, error: failure.message }));
    }
  }, [page, request, search, status]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function applyStatus() {
    const student = confirm;
    const next = student.status === 'blocked' ? 'active' : 'blocked';
    setConfirm({ ...student, busy: true });
    try {
      await request(`/students/${student.id}`, { method: 'PATCH', body: { status: next } });
      setConfirm(null);
      setToast(next === 'blocked' ? 'Student blocked. Their next request will be signed out.' : 'Student access restored.');
      load();
    } catch (failure) { setConfirm({ ...student, busy: false, error: failure.message }); }
  }

  async function saveAssignments() {
    if (!assigning) return;
    setAssigning((previous) => ({ ...previous, busy: true, error: '' }));
    try {
      const { item } = await request(`/students/${assigning.id}/assignments`, { method: 'PATCH', body: { employeeIds: assignedIds } });
      setList((previous) => ({ ...previous, items: previous.items.map((student) => student.id === item.id ? item : student) }));
      setAssigning(null);
      setToast('Employee assignments saved.');
    } catch (error) { setAssigning((previous) => ({ ...previous, busy: false, error: error.message })); }
  }

  async function saveBulkAssignments() {
    setBulkState({ busy: true, error: '' });
    try {
      const { count } = await request('/students/assignments/bulk', { method: 'POST', body: { studentIds: selectedIds, employeeIds: bulkEmployeeIds } });
      setBulkOpen(false); setSelectedIds([]); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' });
      setToast(`Employees assigned to ${count} students.`);
      load();
    } catch (error) { setBulkState({ busy: false, error: error.message }); }
  }

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const allVisibleSelected = list.items.length > 0 && list.items.every((student) => selectedIds.includes(student.id));
  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}><span className={styles.summaryIcon}><Icon name="people" /></span><div><strong>{list.total.toLocaleString('en-IN')} students</strong><small>Accounts are created on first one-time-code login</small></div></div>
      {selectedIds.length > 0 && <button type="button" className="button button--primary" onClick={() => { setBulkOpen(true); setBulkEmployeeIds([]); setBulkState({ busy: false, error: '' }); }}>Assign selected ({selectedIds.length})</button>}
      <div className={styles.segmented} role="group" aria-label="Filter by status">{filters.map((filter) => <button key={filter.label} type="button" aria-pressed={status === filter.value} onClick={() => { setStatus(filter.value); setPage(1); setSelectedIds([]); }}>{filter.label}</button>)}</div>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search students</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIds([]); }} placeholder="Search name, email or mobile…" maxLength={120} /></label>
    </div>
    <div className={styles.tableCard}>
      {list.error ? <div className={styles.errorBox} role="alert"><Icon name="shield" />{list.error}</div> : <div className={styles.tableScroll}>
        <table className={styles.table} aria-busy={list.loading}>
          <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all visible students" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? list.items.map((student) => student.id) : [])} /></th><th scope="col">Student</th><th scope="col">Contact</th><th scope="col">Joined</th><th scope="col">Last sign-in</th><th scope="col">Sign-ins</th><th scope="col">Assigned</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{list.items.map((student) => <tr key={student.id} data-hidden={student.status === 'blocked'}>
            <td><input type="checkbox" aria-label={`Select ${student.name || student.email || student.phone || student.id}`} checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((previous) => event.target.checked ? [...previous, student.id] : previous.filter((id) => id !== student.id))} /></td>
            <td><div className={styles.primaryCell}><strong>{student.name || 'Unnamed student'}</strong><small>ID {student.id.slice(-6)}</small></div></td>
            <td><div className={styles.primaryCell}>{student.email && <span>{student.email}</span>}{student.phone && <small>{student.phone}</small>}</div></td>
            <td>{format(student.createdAt)}</td>
            <td>{format(student.lastLoginAt)}</td>
            <td>{student.loginCount ?? 0}</td>
            <td>{student.assignedEmployeeIds?.length ?? 0}</td>
            <td><span className={styles.badge} data-on={student.status !== 'blocked'}>{student.status === 'blocked' ? 'Blocked' : 'Active'}</span></td>
            <td className={styles.rowActions}><button type="button" className="button button--outline" onClick={() => { setAssigning(student); setAssignedIds(student.assignedEmployeeIds ?? []); }}>Assign</button> <button type="button" className={`button ${student.status === 'blocked' ? 'button--outline' : 'button--ghost'}`} onClick={() => setConfirm(student)}>{student.status === 'blocked' ? 'Restore' : 'Block'}</button></td>
          </tr>)}</tbody>
        </table>
        {!list.loading && !list.items.length && <div className={styles.empty}><Icon name="people" /><p>{search || status ? 'No students match these filters.' : 'No students yet. They appear after their first login with an email or mobile code.'}</p></div>}
      </div>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination"><span>Page {page} of {pages}</span><div><button type="button" className={styles.iconButton} disabled={page <= 1} onClick={() => { setPage(page - 1); setSelectedIds([]); }} aria-label="Previous page"><Icon name="arrow" /></button><button type="button" className={styles.iconButton} disabled={page >= pages} onClick={() => { setPage(page + 1); setSelectedIds([]); }} aria-label="Next page"><Icon name="arrow" /></button></div></nav>}
    </div>
    <AdminDrawer open={Boolean(confirm)} onClose={() => setConfirm(null)} variant="confirm" title={confirm?.status === 'blocked' ? 'Restore access?' : 'Block this student?'}>
      {confirm && <div className={styles.confirm}>
        <p><strong>{confirm.name || confirm.email || confirm.phone}</strong> {confirm.status === 'blocked' ? 'will be able to log in again.' : 'will be signed out on their next request and cannot log in until restored.'}</p>
        {confirm.error && <p className={styles.formError} role="alert"><Icon name="shield" />{confirm.error}</p>}
        <div className={styles.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className={`button ${confirm.status === 'blocked' ? 'button--primary' : styles.dangerButton}`} onClick={applyStatus} disabled={confirm.busy}>{confirm.busy ? 'Saving…' : confirm.status === 'blocked' ? 'Restore access' : 'Block student'}</button></div>
      </div>}
    </AdminDrawer>
    <AdminDrawer open={Boolean(assigning)} onClose={() => setAssigning(null)} title={`Assign ${assigning?.name || assigning?.email || assigning?.phone || 'student'}`}>
      {assigning && <div className={styles.form}>
        <p className={styles.help}>Choose one or more employees. Each will see this student in View students and can add follow-up comments.</p>
        {employees.map((employee) => <label className={styles.switch} key={employee.id}><input type="checkbox" checked={assignedIds.includes(employee.id)} onChange={(event) => setAssignedIds((previous) => event.target.checked ? [...previous, employee.id] : previous.filter((id) => id !== employee.id))} /><span /><span>{employee.email}</span></label>)}
        {!employees.length && <p className={styles.help}>Add an employee before assigning students.</p>}
        {assigning.error && <p className={styles.formError} role="alert">{assigning.error}</p>}
        <div className={styles.formActions}><button type="button" className="button button--ghost" onClick={() => setAssigning(null)}>Cancel</button><button type="button" className="button button--primary" disabled={assigning.busy} onClick={saveAssignments}>{assigning.busy ? 'Saving…' : 'Save assignments'}</button></div>
      </div>}
    </AdminDrawer>
    <AdminDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Assign ${selectedIds.length} students`}>
      <div className={styles.form}>
        <p className={styles.help}>Select employees to add to every selected student. Existing assignments stay in place.</p>
        {employees.map((employee) => <label className={styles.switch} key={employee.id}><input type="checkbox" checked={bulkEmployeeIds.includes(employee.id)} onChange={(event) => setBulkEmployeeIds((previous) => event.target.checked ? [...previous, employee.id] : previous.filter((id) => id !== employee.id))} /><span /><span>{employee.email}</span></label>)}
        {!employees.length && <p className={styles.help}>Add an employee before assigning students.</p>}
        {bulkState.error && <p className={styles.formError} role="alert">{bulkState.error}</p>}
        <div className={styles.formActions}><button type="button" className="button button--ghost" onClick={() => setBulkOpen(false)}>Cancel</button><button type="button" className="button button--primary" disabled={bulkState.busy || !bulkEmployeeIds.length} onClick={saveBulkAssignments}>{bulkState.busy ? 'Saving…' : 'Assign employees'}</button></div>
      </div>
    </AdminDrawer>
    {toast && <p className={styles.toast} role="status"><Icon name="check" />{toast}</p>}
  </div>;
}

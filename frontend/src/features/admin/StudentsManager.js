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
  const [toast, setToast] = useState('');

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

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

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  return <div className={styles.manager}>
    <div className={styles.toolbar}>
      <div className={styles.summary}><span className={styles.summaryIcon}><Icon name="people" /></span><div><strong>{list.total.toLocaleString('en-IN')} students</strong><small>Accounts are created on first one-time-code login</small></div></div>
      <div className={styles.segmented} role="group" aria-label="Filter by status">{filters.map((filter) => <button key={filter.label} type="button" aria-pressed={status === filter.value} onClick={() => { setStatus(filter.value); setPage(1); }}>{filter.label}</button>)}</div>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search students</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or mobile…" maxLength={120} /></label>
    </div>
    <div className={styles.tableCard}>
      {list.error ? <div className={styles.errorBox} role="alert"><Icon name="shield" />{list.error}</div> : <div className={styles.tableScroll}>
        <table className={styles.table} aria-busy={list.loading}>
          <thead><tr><th scope="col">Student</th><th scope="col">Contact</th><th scope="col">Joined</th><th scope="col">Last sign-in</th><th scope="col">Sign-ins</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{list.items.map((student) => <tr key={student.id} data-hidden={student.status === 'blocked'}>
            <td><div className={styles.primaryCell}><strong>{student.name || 'Unnamed student'}</strong><small>ID {student.id.slice(-6)}</small></div></td>
            <td><div className={styles.primaryCell}>{student.email && <span>{student.email}</span>}{student.phone && <small>{student.phone}</small>}</div></td>
            <td>{format(student.createdAt)}</td>
            <td>{format(student.lastLoginAt)}</td>
            <td>{student.loginCount ?? 0}</td>
            <td><span className={styles.badge} data-on={student.status !== 'blocked'}>{student.status === 'blocked' ? 'Blocked' : 'Active'}</span></td>
            <td className={styles.rowActions}><button type="button" className={`button ${student.status === 'blocked' ? 'button--outline' : 'button--ghost'}`} onClick={() => setConfirm(student)}>{student.status === 'blocked' ? 'Restore' : 'Block'}</button></td>
          </tr>)}</tbody>
        </table>
        {!list.loading && !list.items.length && <div className={styles.empty}><Icon name="people" /><p>{search || status ? 'No students match these filters.' : 'No students yet. They appear after their first login with an email or mobile code.'}</p></div>}
      </div>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Pagination"><span>Page {page} of {pages}</span><div><button type="button" className={styles.iconButton} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><Icon name="arrow" /></button><button type="button" className={styles.iconButton} disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><Icon name="arrow" /></button></div></nav>}
    </div>
    <AdminDrawer open={Boolean(confirm)} onClose={() => setConfirm(null)} variant="confirm" title={confirm?.status === 'blocked' ? 'Restore access?' : 'Block this student?'}>
      {confirm && <div className={styles.confirm}>
        <p><strong>{confirm.name || confirm.email || confirm.phone}</strong> {confirm.status === 'blocked' ? 'will be able to log in again.' : 'will be signed out on their next request and cannot log in until restored.'}</p>
        {confirm.error && <p className={styles.formError} role="alert"><Icon name="shield" />{confirm.error}</p>}
        <div className={styles.formActions}><button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className={`button ${confirm.status === 'blocked' ? 'button--primary' : styles.dangerButton}`} onClick={applyStatus} disabled={confirm.busy}>{confirm.busy ? 'Saving…' : confirm.status === 'blocked' ? 'Restore access' : 'Block student'}</button></div>
      </div>}
    </AdminDrawer>
    {toast && <p className={styles.toast} role="status"><Icon name="check" />{toast}</p>}
  </div>;
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAdminSession } from './AdminSession';
import styles from './ReferenceStudentsManager.module.css';

const format = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function ReferenceStudentsManager() {
  const { admin, request } = useAdminSession();
  const [kind, setKind] = useState('reference');
  const [list, setList] = useState({ items: [], total: 0, page: 1, loading: true });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [followupTotal, setFollowupTotal] = useState(0);
  const [followupPage, setFollowupPage] = useState(1);
  const [comment, setComment] = useState('');
  const [employees, setEmployees] = useState([]);
  const [assignedIds, setAssignedIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ text: '', error: false });
  const detailRequest = useRef(0);

  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setList((previous) => ({ ...previous, page: 1 })); }, 250); return () => window.clearTimeout(timer); }, [query]);

  const load = useCallback(async (signal) => {
    try {
      const params = new URLSearchParams({ page: String(list.page), limit: '20' });
      if (search) params.set('q', search);
      const data = await request(`/${kind === 'account' ? 'account-students' : 'reference-students'}?${params}`, { signal });
      setList({ ...data, loading: false });
    } catch (error) {
      if (error.name !== 'AbortError') { setList((previous) => ({ ...previous, loading: false })); setMessage({ text: error.message, error: true }); }
    }
  }, [kind, list.page, request, search]);

  useEffect(() => { const controller = new AbortController(); Promise.resolve().then(() => { if (!controller.signal.aborted) load(controller.signal); }); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (admin?.role !== 'admin') return;
    request('/employees').then(({ items }) => setEmployees(items)).catch((error) => setMessage({ text: error.message, error: true }));
  }, [admin?.role, request]);

  async function openStudent(student) {
    const requestId = ++detailRequest.current;
    setSelected(student); setAssignedIds(student.assignedEmployeeIds); setFollowups([]); setFollowupTotal(0); setFollowupPage(1); setComment(''); setBusy(''); setMessage({ text: '', error: false });
    try {
      const { items, total } = await request(`/${kind === 'account' ? 'account-students' : 'reference-students'}/${student.id}/followups?limit=100`);
      if (requestId === detailRequest.current) { setFollowups(items); setFollowupTotal(total); }
    } catch (error) { if (requestId === detailRequest.current) setMessage({ text: error.message, error: true }); }
  }

  async function moreFollowups() {
    if (!selected) return;
    const requestId = detailRequest.current;
    setBusy('more');
    try {
      const { items, total } = await request(`/${kind === 'account' ? 'account-students' : 'reference-students'}/${selected.id}/followups?limit=100&page=${followupPage + 1}`);
      if (requestId !== detailRequest.current) return;
      setFollowups((previous) => [...previous, ...items.filter((item) => !previous.some((existing) => existing.id === item.id))]);
      setFollowupTotal(total); setFollowupPage((previous) => previous + 1); setBusy('');
    } catch (error) { if (requestId === detailRequest.current) { setBusy(''); setMessage({ text: error.message, error: true }); } }
  }

  async function saveAssignments() {
    if (!selected) return;
    const requestId = detailRequest.current;
    setBusy('assign'); setMessage({ text: '', error: false });
    try {
      const path = kind === 'account' ? `/students/${selected.id}/assignments` : `/reference-students/${selected.id}/assignments`;
      const { item } = await request(path, { method: 'PATCH', body: { employeeIds: assignedIds } });
      if (requestId !== detailRequest.current) return;
      setSelected(item); setList((previous) => ({ ...previous, items: previous.items.map((student) => student.id === item.id ? item : student) }));
      setBusy(''); setMessage({ text: 'Assignments saved.', error: false });
    } catch (error) { if (requestId === detailRequest.current) { setBusy(''); setMessage({ text: error.message, error: true }); } }
  }

  async function saveBulkAssignments() {
    setBusy('bulk'); setMessage({ text: '', error: false });
    try {
      const path = kind === 'account' ? '/students/assignments/bulk' : '/reference-students/assignments/bulk';
      const { count } = await request(path, { method: 'POST', body: { studentIds: selectedIds, employeeIds: bulkEmployeeIds } });
      detailRequest.current++; setSelected(null); setSelectedIds([]); setBulkEmployeeIds([]); setBulkOpen(false); setBusy('');
      setMessage({ text: `Employees assigned to ${count} students. Existing assignments were kept.`, error: false });
      load();
    } catch (error) { setBusy(''); setMessage({ text: error.message, error: true }); }
  }

  async function addFollowup(event) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    const requestId = detailRequest.current;
    setBusy('followup'); setMessage({ text: '', error: false });
    try {
      const { item } = await request(`/${kind === 'account' ? 'account-students' : 'reference-students'}/${selected.id}/followups`, { method: 'POST', body: { comment } });
      if (requestId !== detailRequest.current) return;
      setFollowups((previous) => [item, ...previous]); setFollowupTotal((previous) => previous + 1); setComment(''); setBusy(''); setMessage({ text: 'Follow-up saved.', error: false });
    } catch (error) { if (requestId === detailRequest.current) { setBusy(''); setMessage({ text: error.message, error: true }); } }
  }

  const employeeName = (id) => employees.find((employee) => employee.id === id)?.email || id;
  const pages = Math.max(1, Math.ceil(list.total / 20));
  const allVisibleSelected = list.items.length > 0 && list.items.every((student) => selectedIds.includes(student.id));
  return <div className={styles.layout}>
    <div className={styles.heading}><div><h2>View students</h2><p>{admin?.role === 'employee' ? 'Students assigned to you or added by you are shown here.' : 'View login accounts and reference students with their follow-ups.'}</p></div><div className={styles.headingActions}><span>{list.total} visible</span><Link className="button button--primary" href="/admin/reference-students/new">Add student</Link></div></div>
    {message.text && <p className={message.error ? styles.error : styles.success} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    <div className={styles.tabs} role="group" aria-label="Student type"><button type="button" aria-pressed={kind === 'reference'} onClick={() => { detailRequest.current++; setKind('reference'); setSelected(null); setSelectedIds([]); setBulkOpen(false); setBusy(''); setList({ items: [], total: 0, page: 1, loading: true }); }}>Reference students</button><button type="button" aria-pressed={kind === 'account'} onClick={() => { detailRequest.current++; setKind('account'); setSelected(null); setSelectedIds([]); setBulkOpen(false); setBusy(''); setList({ items: [], total: 0, page: 1, loading: true }); }}>Login accounts</button></div>
    <section className={styles.card}>
        <div className={styles.listHeading}><h3>{kind === 'account' ? 'Login accounts' : 'Reference students'}</h3><input type="search" aria-label="Search students" placeholder="Search name, email or mobile" maxLength={120} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedIds([]); setBulkOpen(false); }} /></div>
        {admin?.role === 'admin' && <div className={styles.bulkBar}><label><input type="checkbox" aria-label="Select all visible students" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? list.items.map((student) => student.id) : [])} /> Select all visible</label><span>{selectedIds.length} selected</span><button type="button" className="button button--primary" disabled={!selectedIds.length} onClick={() => { setBulkEmployeeIds([]); setBulkOpen(true); }}>Assign selected</button></div>}
        {bulkOpen && <div className={styles.bulkPanel}><h4>Assign {selectedIds.length} students</h4><p className={styles.hint}>Employees you select will be added to every selected student. Existing assignments stay in place.</p><div className={styles.checks}>{employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={bulkEmployeeIds.includes(employee.id)} onChange={(event) => setBulkEmployeeIds((previous) => event.target.checked ? [...previous, employee.id] : previous.filter((id) => id !== employee.id))} />{employee.email}</label>)}</div><div className={styles.bulkActions}><button type="button" className="button button--ghost" onClick={() => setBulkOpen(false)}>Cancel</button><button type="button" className="button button--primary" disabled={busy === 'bulk' || !bulkEmployeeIds.length} onClick={saveBulkAssignments}>{busy === 'bulk' ? 'Saving…' : 'Assign employees'}</button></div></div>}
        <div className={styles.list} aria-busy={list.loading}>{list.items.map((student) => <div className={styles.studentRow} key={student.id}>{admin?.role === 'admin' && <input type="checkbox" aria-label={`Select ${student.name || student.email || student.phone || student.id}`} checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((previous) => event.target.checked ? [...previous, student.id] : previous.filter((id) => id !== student.id))} />}<button className={styles.student} data-active={selected?.id === student.id} type="button" onClick={() => openStudent(student)}>
          <strong>{student.name || student.email || student.phone || 'Unnamed student'}</strong><span>{student.email || student.phone}</span><small>{kind === 'account' ? `${student.assignedEmployeeIds.length} assigned · Last sign-in ${format(student.lastLoginAt)}` : admin?.role === 'admin' ? `${student.assignedEmployeeIds.length} assigned · Added by ${student.createdByEmail}` : `Added ${format(student.createdAt)}`}</small>
        </button></div>)}{list.loading && <p className={styles.hint}>Loading students…</p>}{!list.loading && !list.items.length && <p className={styles.hint}>No {kind === 'account' ? 'assigned login accounts' : 'reference students'} found.</p>}</div>
        {pages > 1 && <div className={styles.pages}><button type="button" disabled={list.page <= 1} onClick={() => { setList((previous) => ({ ...previous, page: previous.page - 1 })); setSelectedIds([]); setBulkOpen(false); }}>Previous</button><span>Page {list.page} of {pages}</span><button type="button" disabled={list.page >= pages} onClick={() => { setList((previous) => ({ ...previous, page: previous.page + 1 })); setSelectedIds([]); setBulkOpen(false); }}>Next</button></div>}
    </section>
    {selected && <section className={styles.card}>
      <div className={styles.detailHeading}><div><h3>{selected.name || selected.email || selected.phone || 'Unnamed student'}</h3><p>{selected.email || 'No email'} · {selected.phone || 'No mobile'}</p><small>{kind === 'account' ? `Login account · Last sign-in ${format(selected.lastLoginAt)}` : `Added by ${selected.createdByEmail} · ${format(selected.createdAt)}`}</small></div><button type="button" className="button button--ghost" onClick={() => { detailRequest.current++; setSelected(null); }}>Close</button></div>
      {admin?.role === 'admin' && <div className={styles.assignments}><h4>Assign employees</h4><p className={styles.hint}>Select one or more employees. Each can add their own follow-up comments.</p><div className={styles.checks}>{employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={assignedIds.includes(employee.id)} onChange={(event) => setAssignedIds((previous) => event.target.checked ? [...previous, employee.id] : previous.filter((id) => id !== employee.id))} />{employee.email}</label>)}</div><button className="button button--primary" type="button" disabled={Boolean(busy)} onClick={saveAssignments}>{busy === 'assign' ? 'Saving…' : 'Save assignments'}</button></div>}
      {admin?.role === 'employee' && <p className={styles.hint}>Visible to you for follow-up.</p>}
      {admin?.role === 'admin' && selected.assignedEmployeeIds.length > 0 && <p className={styles.hint}>Assigned: {selected.assignedEmployeeIds.map(employeeName).join(', ')}</p>}
      <div className={styles.followups}><h4>Follow-up comments</h4><form onSubmit={addFollowup}><label htmlFor="followup-comment">Add a comment</label><textarea id="followup-comment" required maxLength={2000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Record the conversation or next step…" /><button className="button button--primary" disabled={Boolean(busy)} type="submit">{busy === 'followup' ? 'Saving…' : 'Save follow-up'}</button></form><div className={styles.comments}>{followups.map((item) => <article key={item.id}><p>{item.comment}</p><small>{item.authorEmail} · {format(item.createdAt)}</small></article>)}{!followups.length && <p className={styles.hint}>No follow-up comments yet.</p>}</div>{followups.length < followupTotal && <button type="button" className="button button--ghost" disabled={Boolean(busy)} onClick={moreFollowups}>{busy === 'more' ? 'Loading…' : 'Load older comments'}</button>}</div>
    </section>}
  </div>;
}

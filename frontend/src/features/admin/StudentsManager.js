'use client';
// Student sign-in accounts (created on a student's first one-time-code login): block / restore access
// and assign staff for follow-up. Server-paged; search and the status filter run on the server.
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import ConfirmDialog from './crm/ConfirmDialog';
import RowMenu from './crm/RowMenu';
import { useToaster } from './crm/toast';
import { formatWhen, StatusDot } from './catalogue/CatalogueParts';
import { formatCount, formatDate, formatDateTime } from './leads/lead-format';
import Pagination from './table/Pagination';
import { useServerList } from './table/useServerList';
import { PageToolbar } from './ui/Page';
import t from './table/Table.module.css';
import { AssignDrawer, Assignees, contactOf, StudentDrawer, studentName, studentRights, useAssignees } from './students-ui';
import styles from './ReferenceStudentsManager.module.css';

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }];

export default function StudentsManager() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const rights = studentRights(admin);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '', page: 1, limit: 25 });
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [assignState, setAssignState] = useState({ busy: false, error: '' });
  const [blocking, setBlocking] = useState(null);
  const [working, setWorking] = useState(false);
  const staff = useAssignees(request, rights.manage);

  const list = useServerList(request, '/students', { q: filters.q, status: filters.status, page: filters.page > 1 ? filters.page : '', limit: filters.limit },
    { scope: admin?.id ?? '', enabled: Boolean(admin) && rights.manage });
  const data = list.data;
  const rows = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const update = (patch) => { setSelected([]); setFilters((current) => ({ ...current, page: 1, ...patch })); };

  async function setStatus(student, status) {
    try {
      await request(`/students/${student.id}`, { method: 'PATCH', body: { status } });
      list.reload();
      return true;
    } catch (failure) { toast.error(failure.message); return false; }
  }
  async function block() {
    setWorking(true);
    const student = blocking;
    if (await setStatus(student, 'blocked')) {
      setBlocking(null);
      toast.success(`${studentName(student)} blocked. Their next request signs them out.`, { action: { label: 'Undo', onClick: () => setStatus(student, 'active') } });
    }
    setWorking(false);
  }
  async function restore(student) {
    if (await setStatus(student, 'active')) toast.success(`${studentName(student)} can sign in again.`, { action: { label: 'Undo', onClick: () => setStatus(student, 'blocked') } });
  }

  async function saveAssign(employeeIds) {
    setAssignState({ busy: true, error: '' });
    try {
      if (assigning.bulk) {
        const { count } = await request('/students/assignments/bulk', { method: 'POST', body: { studentIds: assigning.ids, employeeIds } });
        toast.success(`Staff assigned to ${formatCount(count)} ${count === 1 ? 'student' : 'students'}. Earlier assignments were kept.`);
        setSelected([]);
      } else {
        await request(`/students/${assigning.student.id}/assignments`, { method: 'PATCH', body: { employeeIds } });
        toast.success(`Assignment saved for ${studentName(assigning.student)}.`);
        setOpen(null);
      }
      setAssigning(null); setAssignState({ busy: false, error: '' });
      list.reload();
    } catch (failure) { setAssignState({ busy: false, error: failure.message }); }
  }

  if (admin && !rights.manage) return <p className={`adm-panel ${styles.notice}`} role="alert"><Icon name="lock" />Student accounts need the “Student accounts” permission.</p>;

  const menuFor = (student) => [
    { key: 'open', label: 'Open notes', icon: 'note', onSelect: () => setOpen(student) },
    { key: 'assign', label: 'Assign staff…', icon: 'userPlus', onSelect: () => setAssigning({ student }) },
    { divider: true },
    student.status === 'blocked'
      ? { key: 'restore', label: 'Restore access', icon: 'undo', onSelect: () => restore(student) }
      : { key: 'block', label: 'Block sign-in…', icon: 'ban', tone: 'danger', onSelect: () => setBlocking(student) },
  ];
  const ids = rows.map((row) => row.id);
  const allChosen = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someChosen = ids.some((id) => selected.includes(id));
  const openRow = (event, student) => { if (!event.target.closest('a, button, input, label')) setOpen(student); };
  const filtered = Boolean(filters.q || filters.status);

  return <div className={styles.screen}>
    <PageToolbar start={<>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search students</span>
        <input type="search" value={query} maxLength={120} placeholder="Name, email or mobile" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className={styles.inlineSelect}><span className="sr-only">Status</span>
        <select className="adm-select" value={filters.status} onChange={(event) => update({ status: event.target.value })}>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </>} />

    <section className={`adm-panel ${styles.tablePanel}`} aria-label="Student accounts">
      {selected.length > 0 && <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
        <strong>{formatCount(selected.length)} selected</strong>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => setAssigning({ bulk: true, ids: selected })}><Icon name="userPlus" />Assign staff</button>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSelected([])}>Clear selection</button>
      </div>}
      {list.error ? <div className={t.state} role="alert"><Icon name="alert" /><p>{list.error}</p><button type="button" className="adm-btn adm-btn--sm" onClick={list.reload}>Try again</button></div>
        : <div className={t.scroll} data-busy={list.busy || undefined}>
          <table className={`${t.table} ${styles.table}`} aria-busy={list.loading || list.busy}>
            <caption className="sr-only">Student accounts</caption>
            <thead><tr>
              <th scope="col" className={t.checkCell}><input type="checkbox" aria-label="Select all students on this page" checked={allChosen} disabled={!ids.length}
                ref={(node) => { if (node) node.indeterminate = someChosen && !allChosen; }}
                onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} /></th>
              <th scope="col">Student</th>
              <th scope="col" className={styles.optional}>Contact</th>
              <th scope="col" style={{ width: 96 }}>Status</th>
              <th scope="col" style={{ width: '17%' }}>Assigned to</th>
              <th scope="col" className={styles.optional} style={{ width: 136 }}>Last sign-in</th>
              <th scope="col" className={`${styles.num} ${styles.optional}`} style={{ width: 76 }}>Sign-ins</th>
              <th scope="col" className={styles.optional} style={{ width: 110 }}>Joined</th>
              <th scope="col" className={styles.menuCell}><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              {list.loading && !rows.length ? Array.from({ length: 10 }, (_, index) => <tr key={index} className={t.skeletonRow} aria-hidden="true">
                {Array.from({ length: 9 }, (_, cell) => <td key={cell} className={cell === 0 ? t.checkCell : undefined}><span style={{ width: '65%' }} /></td>)}
              </tr>) : rows.map((student) => <tr key={student.id} className={styles.clickRow} data-selected={selected.includes(student.id) || undefined} data-muted={student.status === 'blocked' || undefined} onClick={(event) => openRow(event, student)}>
                <td className={t.checkCell}><input type="checkbox" aria-label={`Select ${studentName(student)}`} checked={selected.includes(student.id)}
                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)))} /></td>
                <td className={styles.mainCell}><button type="button" className={styles.rowLink} title={studentName(student)} onClick={() => setOpen(student)}>{student.name || <span className={styles.muted}>No name yet</span>}</button></td>
                <td data-label="Contact" className={styles.optional}><span className={styles.clip} title={contactOf(student)}>{contactOf(student) || '—'}</span></td>
                <td data-label="Status">{student.status === 'blocked' ? <StatusDot tone="bad">Blocked</StatusDot> : <StatusDot tone="good">Active</StatusDot>}</td>
                <td data-label="Assigned to" className={styles.assignCell}><Assignees people={student.assignees} /></td>
                <td data-label="Last sign-in" className={styles.optional} title={student.lastLoginAt ? formatDateTime(student.lastLoginAt) : undefined}>{student.lastLoginAt ? formatWhen(student.lastLoginAt) : <span className={styles.muted}>—</span>}</td>
                <td data-label="Sign-ins" className={`${styles.num} ${styles.optional} crm-tabnum`}>{formatCount(student.loginCount ?? 0)}</td>
                <td data-label="Joined" className={styles.optional}>{formatDate(student.createdAt)}</td>
                <td className={styles.menuCell}><RowMenu label={`Actions for ${studentName(student)}`} items={menuFor(student)} /></td>
              </tr>)}
            </tbody>
          </table>
          {data && !rows.length && <div className={styles.emptyLine}>
            {filtered ? <><span>No accounts match.</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); update({ q: '', status: '' }); }}>Clear filters</button></>
              : <span title="Accounts are created on a student’s first sign-in with an email or mobile code.">No student accounts yet.</span>}
          </div>}
        </div>}
      {data && data.total > 0 && <Pagination page={filters.page} pageSize={filters.limit} total={data.total} rowCount={rows.length} noun="accounts"
        hasNext={filters.page * filters.limit < data.total} hasPrevious={filters.page > 1} disabled={list.busy}
        onPage={(page) => { setSelected([]); setFilters((current) => ({ ...current, page })); }} onPageSize={(limit) => update({ limit })} />}
    </section>

    <StudentDrawer key={open?.id ?? 'none'} student={open} base="/account-students" request={request} toast={toast} canAssign
      meta={open && `Joined ${formatDate(open.createdAt)} · last sign-in ${open.lastLoginAt ? formatWhen(open.lastLoginAt) : 'never'}`}
      onAssign={() => setAssigning({ student: open })} onClose={() => setOpen(null)} />
    <AssignDrawer open={Boolean(assigning)} staff={staff} mode={assigning?.bulk ? 'add' : 'replace'} busy={assignState.busy} error={assignState.error}
      initial={assigning?.student?.assignedEmployeeIds ?? []}
      title={assigning?.bulk ? `Assign ${formatCount(assigning.ids.length)} students` : 'Assign staff'} subtitle={assigning?.student ? studentName(assigning.student) : undefined}
      onSave={saveAssign} onClose={() => { setAssigning(null); setAssignState({ busy: false, error: '' }); }} />
    <ConfirmDialog open={Boolean(blocking)} tone="danger" busy={working} icon="ban" title={blocking ? `Block ${studentName(blocking)}?` : ''} confirmLabel="Block sign-in"
      onConfirm={block} onCancel={() => setBlocking(null)}>
      They are signed out on their next request and cannot sign in until you restore access. Their saved data stays.
    </ConfirmDialog>
  </div>;
}

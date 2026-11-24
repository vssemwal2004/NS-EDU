'use client';
// Student sign-in accounts (created on a student's first one-time-code login): rename, block / restore access,
// assign staff for follow-up and delete — per row (⋮) or for ticked rows (bulk bar). Every action is hidden
// unless the signed-in person holds its permission (accounts.edit / accounts.assign / accounts.delete).
// Server-paged; search and the status filter run on the server.
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import AdminDrawer from './AdminDrawer';
import BulkBar from './crm/BulkBar';
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
import { useStickyState } from './ui/useStickyState';

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }];
const plural = (count, one, many) => `${formatCount(count)} ${count === 1 ? one : many}`;

/** Rename an account. Email and mobile are the sign-in identity, so they are shown but not editable. */
function EditAccount({ student, request, toast, onSaved, onClose }) {
  const [name, setName] = useState(student.name ?? '');
  const [state, setState] = useState({ busy: false, error: '', fields: {} });
  async function save(event) {
    event.preventDefault();
    setState({ busy: true, error: '', fields: {} });
    try {
      // The validator requires `status` on every PATCH, so the current one is sent with the new name.
      const { item } = await request(`/students/${student.id}`, { method: 'PATCH', body: { status: student.status, name: name.trim() } });
      toast.success(`${studentName(item ?? { ...student, name })} updated.`);
      onSaved();
    } catch (failure) { setState({ busy: false, error: failure.message, fields: failure.fields ?? {} }); }
  }
  return <form className={styles.form} onSubmit={save} noValidate>
    <label className="adm-label" htmlFor="edit-account-name">Name
      <input id="edit-account-name" className="adm-input" value={name} maxLength={80} autoComplete="off" aria-invalid={state.fields.name ? true : undefined} onChange={(event) => setName(event.target.value)} />
      {state.fields.name && <span className="adm-error">{state.fields.name}</span>}
    </label>
    <dl className={styles.facts}>
      <div><dt>Email</dt><dd>{student.email || <span className={styles.muted}>—</span>}</dd></div>
      <div><dt>Mobile</dt><dd className="crm-tabnum">{student.phone || <span className={styles.muted}>—</span>}</dd></div>
    </dl>
    <p className="adm-hint">Email and mobile are how the student signs in, so they cannot be changed here.</p>
    {state.error && <p className={styles.formError} role="alert"><Icon name="alert" />{state.error}</p>}
    <div className={styles.drawerFooter}>
      <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy || name.trim() === (student.name ?? '')}>{state.busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

export default function StudentsManager() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const rights = studentRights(admin);
  const [filters, setFilters] = useStickyState('student-accounts', { q: '', status: '', page: 1, limit: 25 });
  const [query, setQuery] = useState(filters.q);
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [assignState, setAssignState] = useState({ busy: false, error: '' });
  const [blocking, setBlocking] = useState(null);
  // { student } for one account, { ids } for the ticked ones; `error` keeps the last failure inside the dialog.
  const [removing, setRemoving] = useState(null);
  const [working, setWorking] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const staff = useAssignees(request, rights.accountsAssign);

  const list = useServerList(request, '/students', { q: filters.q, status: filters.status, page: filters.page > 1 ? filters.page : '', limit: filters.limit },
    { scope: admin?.id ?? '', enabled: Boolean(admin) && rights.accountsView });
  const data = list.data;
  const rows = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query, setFilters]);
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

  // Block or restore every ticked account. Undo only flips back the ones this action changed.
  async function bulkStatus(status) {
    const ids = [...selected];
    const changed = rows.filter((row) => ids.includes(row.id) && row.status !== status).map((row) => row.id);
    const send = (body) => request('/students/bulk', { method: 'POST', body });
    setBulkBusy(true);
    try {
      const { modified } = await send({ ids, status });
      setSelected([]);
      list.reload();
      const undo = changed.length ? { label: 'Undo', onClick: () => send({ ids: changed, status: status === 'blocked' ? 'active' : 'blocked' }).then(list.reload, (failure) => toast.error(failure.message)) } : undefined;
      toast.success(status === 'blocked'
        ? `${plural(modified, 'account', 'accounts')} blocked${modified < ids.length ? ` (${formatCount(ids.length - modified)} already blocked)` : ''}. They are signed out on their next request.`
        : `${plural(modified, 'account', 'accounts')} can sign in again${modified < ids.length ? ` (${formatCount(ids.length - modified)} already active)` : ''}.`, { action: undo });
    } catch (failure) { toast.error(failure.message); } finally { setBulkBusy(false); }
  }

  async function remove() {
    setWorking(true);
    try {
      if (removing.student) {
        await request(`/students/${removing.student.id}`, { method: 'DELETE' });
        toast.success(`${studentName(removing.student)}’s account deleted.`);
        setSelected((current) => current.filter((id) => id !== removing.student.id));
        if (open?.id === removing.student.id) setOpen(null);
      } else {
        const { requested, deleted } = await request('/students/bulk-delete', { method: 'POST', body: { ids: removing.ids } });
        toast.success(`${plural(deleted, 'account', 'accounts')} deleted${deleted < requested ? `; ${formatCount(requested - deleted)} no longer existed` : ''}.`);
        setSelected([]);
        if (open && removing.ids.includes(open.id)) setOpen(null);
      }
      setRemoving(null);
      list.reload();
    } catch (failure) { setRemoving((current) => current && { ...current, error: failure.message }); } finally { setWorking(false); }
  }

  async function saveAssign(employeeIds) {
    setAssignState({ busy: true, error: '' });
    try {
      if (assigning.bulk) {
        const { count } = await request('/students/assignments/bulk', { method: 'POST', body: { studentIds: assigning.ids, employeeIds } });
        toast.success(`Staff assigned to ${plural(count, 'student', 'students')}. Earlier assignments were kept.`);
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

  if (admin && !rights.accountsView) return <p className={`adm-panel ${styles.notice}`} role="alert"><Icon name="lock" />Student accounts need the “See student accounts” permission.</p>;

  const menuFor = (student) => [
    { key: 'open', label: 'Open notes', icon: 'note', onSelect: () => setOpen(student) },
    { key: 'edit', label: 'Edit details…', icon: 'edit', hidden: !rights.accountsEdit, onSelect: () => setEditing(student) },
    { key: 'assign', label: 'Assign staff…', icon: 'userPlus', hidden: !rights.accountsAssign, onSelect: () => setAssigning({ student }) },
    student.status === 'blocked'
      ? { key: 'restore', label: 'Restore access', icon: 'undo', hidden: !rights.accountsEdit, onSelect: () => restore(student) }
      : { key: 'block', label: 'Block sign-in…', icon: 'ban', tone: 'danger', hidden: !rights.accountsEdit, onSelect: () => setBlocking(student) },
    { divider: true },
    { key: 'delete', label: 'Delete account…', icon: 'trash', tone: 'danger', hidden: !rights.accountsDelete, onSelect: () => setRemoving({ student }) },
  ];
  const canSelect = rights.accountsAssign || rights.accountsEdit || rights.accountsDelete;
  const columns = canSelect ? 9 : 8;
  const ids = rows.map((row) => row.id);
  const allChosen = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someChosen = ids.some((id) => selected.includes(id));
  const openRow = (event, student) => { if (!event.target.closest('a, button, input, label')) setOpen(student); };
  const filtered = Boolean(filters.q || filters.status);
  const bulkAssign = () => setAssigning({ bulk: true, ids: selected });
  const removingCount = removing?.student ? 1 : removing?.ids?.length ?? 0;

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
      {canSelect && <BulkBar count={selected.length} noun={['account', 'accounts']} busy={bulkBusy} onClear={() => setSelected([])}
        quick={[{ key: 'assign', label: 'Assign staff', icon: 'userPlus', hidden: !rights.accountsAssign, onSelect: bulkAssign }]}
        menu={[
          { key: 'assign', label: 'Assign staff…', icon: 'userPlus', hidden: !rights.accountsAssign, onSelect: bulkAssign },
          { key: 'block', label: 'Block sign-in', icon: 'ban', hidden: !rights.accountsEdit, disabled: bulkBusy, onSelect: () => bulkStatus('blocked') },
          { key: 'restore', label: 'Restore access', icon: 'undo', hidden: !rights.accountsEdit, disabled: bulkBusy, onSelect: () => bulkStatus('active') },
          { divider: true },
          { key: 'delete', label: 'Delete accounts…', icon: 'trash', tone: 'danger', hidden: !rights.accountsDelete, disabled: bulkBusy, onSelect: () => setRemoving({ ids: [...selected] }) },
        ]} />}
      {list.error ? <div className={t.state} role="alert"><Icon name="alert" /><p>{list.error}</p><button type="button" className="adm-btn adm-btn--sm" onClick={list.reload}>Try again</button></div>
        : <div className={t.scroll} data-busy={list.busy || undefined}>
          <table className={`${t.table} ${styles.table}`} aria-busy={list.loading || list.busy}>
            <caption className="sr-only">Student accounts</caption>
            <thead><tr>
              {canSelect && <th scope="col" className={t.checkCell}><input type="checkbox" aria-label="Select all students on this page" checked={allChosen} disabled={!ids.length}
                ref={(node) => { if (node) node.indeterminate = someChosen && !allChosen; }}
                onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} /></th>}
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
                {Array.from({ length: columns }, (_, cell) => <td key={cell} className={canSelect && cell === 0 ? t.checkCell : undefined}><span style={{ width: '65%' }} /></td>)}
              </tr>) : rows.map((student) => <tr key={student.id} className={styles.clickRow} data-selected={selected.includes(student.id) || undefined} data-muted={student.status === 'blocked' || undefined} onClick={(event) => openRow(event, student)}>
                {canSelect && <td className={t.checkCell}><input type="checkbox" aria-label={`Select ${studentName(student)}`} checked={selected.includes(student.id)}
                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)))} /></td>}
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

    <StudentDrawer key={open?.id ?? 'none'} student={open} base="/account-students" request={request} toast={toast} canAssign={rights.accountsAssign}
      meta={open && `Joined ${formatDate(open.createdAt)} · last sign-in ${open.lastLoginAt ? formatWhen(open.lastLoginAt) : 'never'}`}
      onAssign={() => setAssigning({ student: open })} onClose={() => setOpen(null)} />
    <AdminDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit account" subtitle={editing ? studentName(editing) : ''}>
      {editing && <EditAccount key={editing.id} student={editing} request={request} toast={toast} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setOpen(null); list.reload(); }} />}
    </AdminDrawer>
    <AssignDrawer open={Boolean(assigning)} staff={staff} mode={assigning?.bulk ? 'add' : 'replace'} busy={assignState.busy} error={assignState.error}
      initial={assigning?.student?.assignedEmployeeIds ?? []}
      title={assigning?.bulk ? `Assign ${plural(assigning.ids.length, 'student', 'students')}` : 'Assign staff'} subtitle={assigning?.student ? studentName(assigning.student) : undefined}
      onSave={saveAssign} onClose={() => { setAssigning(null); setAssignState({ busy: false, error: '' }); }} />
    <ConfirmDialog open={Boolean(blocking)} tone="danger" busy={working} icon="ban" title={blocking ? `Block ${studentName(blocking)}?` : ''} confirmLabel="Block sign-in"
      onConfirm={block} onCancel={() => setBlocking(null)}>
      They are signed out on their next request and cannot sign in until you restore access. Their saved data stays.
    </ConfirmDialog>
    <ConfirmDialog open={Boolean(removing)} tone="danger" requireText="DELETE" busy={working} error={removing?.error}
      title={removing?.student ? `Delete ${studentName(removing.student)}’s account?` : removing ? `Delete ${plural(removingCount, 'account', 'accounts')}?` : ''}
      confirmLabel={removingCount === 1 ? 'Delete account' : 'Delete accounts'} onConfirm={remove} onCancel={() => setRemoving(null)}>
      {removingCount === 1
        ? 'The sign-in account is removed for good, with its review, staff follow-up notes and pending sign-in codes. Leads this student sent stay with the institutions, no longer linked to an account.'
        : `All ${formatCount(removingCount)} sign-in accounts are removed for good, with their reviews, staff follow-up notes and pending sign-in codes. Leads these students sent stay with the institutions, no longer linked to an account.`}
      {' '}Signing in again later creates a new, empty account. This cannot be undone.
    </ConfirmDialog>
  </div>;
}

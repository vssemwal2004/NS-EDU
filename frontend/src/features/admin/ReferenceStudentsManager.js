'use client';
// Reference students (and the login accounts assigned to this person): a dense, server-paged table with
// search, an assignee filter, row menus, bulk assignment and a drawer for contact details and follow-up notes.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import AdminDrawer from './AdminDrawer';
import ConfirmDialog from './crm/ConfirmDialog';
import RowMenu from './crm/RowMenu';
import { useToaster } from './crm/toast';
import { formatWhen } from './catalogue/CatalogueParts';
import { formatCount, formatDate, formatDateTime } from './leads/lead-format';
import Pagination from './table/Pagination';
import { useServerList } from './table/useServerList';
import { PageToolbar, ViewTabs } from './ui/Page';
import t from './table/Table.module.css';
import { AssignDrawer, Assignees, contactOf, StudentDrawer, studentName, studentRights, useAssignees } from './students-ui';
import styles from './ReferenceStudentsManager.module.css';

const KINDS = {
  reference: { path: '/reference-students', assign: (id) => `/reference-students/${id}/assignments`, bulk: '/reference-students/assignments/bulk', noun: 'reference students' },
  account: { path: '/account-students', assign: (id) => `/students/${id}/assignments`, bulk: '/students/assignments/bulk', noun: 'login accounts' },
};

function EditDrawer({ student, request, toast, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({ name: student.name, email: student.email, phone: student.phone }));
  const [state, setState] = useState({ busy: false, error: '', fields: {} });
  async function save(event) {
    event.preventDefault();
    setState({ busy: true, error: '', fields: {} });
    try {
      const { item } = await request(`/reference-students/${student.id}`, { method: 'PATCH', body: form });
      toast.success(`${studentName(item)} updated.`);
      onSaved();
    } catch (failure) { setState({ busy: false, error: failure.message, fields: failure.fields ?? {} }); }
  }
  const field = (name, label, input) => <label className="adm-label" htmlFor={`edit-student-${name}`}>{label}
    <input id={`edit-student-${name}`} className="adm-input" value={form[name]} aria-invalid={state.fields[name] ? true : undefined} onChange={(event) => setForm({ ...form, [name]: event.target.value })} {...input} />
    {state.fields[name] && <span className="adm-error">{state.fields[name]}</span>}
  </label>;
  return <form className={styles.form} onSubmit={save} noValidate>
    {field('name', 'Name', { required: true, maxLength: 100, autoComplete: 'off' })}
    {field('email', 'Email', { type: 'email', maxLength: 254, autoComplete: 'off' })}
    {field('phone', 'Mobile number', { type: 'tel', inputMode: 'tel', maxLength: 16, autoComplete: 'off' })}
    <p className="adm-hint">An email or a mobile number is required.</p>
    {state.error && <p className={styles.formError} role="alert"><Icon name="alert" />{state.error}</p>}
    <div className={styles.drawerFooter}>
      <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

export default function ReferenceStudentsManager() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const rights = studentRights(admin);
  const [kind, setKind] = useState('reference');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ q: '', assignee: '', page: 1, limit: 25 });
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [assignState, setAssignState] = useState({ busy: false, error: '' });
  const [removing, setRemoving] = useState(null);
  const [working, setWorking] = useState(false);
  const config = KINDS[kind];
  const staff = useAssignees(request, rights.manage);

  const list = useServerList(request, config.path, {
    q: filters.q, assignee: kind === 'reference' ? filters.assignee : '', page: filters.page > 1 ? filters.page : '', limit: filters.limit,
  }, { scope: admin?.id ?? '', enabled: Boolean(admin) });
  const data = list.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  // Login accounts come without names for assignees; map them from the staff list when it is loaded.
  const staffNames = useMemo(() => new Map(staff.items.map((person) => [person.id, person.name || person.email])), [staff.items]);
  const rows = useMemo(() => items.map((item) => (item.assignees ? item : { ...item, assignees: (item.assignedEmployeeIds ?? []).map((id) => ({ id, name: staffNames.get(id) ?? (id === admin?.id ? 'You' : 'Staff member') })) })), [items, staffNames, admin?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === query.trim() ? current : { ...current, q: query.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const update = (patch) => { setSelected([]); setFilters((current) => ({ ...current, page: 1, ...patch })); };
  const switchKind = (next) => { setKind(next); setSelected([]); setOpen(null); setQuery(''); setFilters({ q: '', assignee: '', page: 1, limit: filters.limit }); };
  const mayChange = (student) => kind === 'reference' && (rights.manage || student.createdById === admin?.id);
  const filtered = Boolean(filters.q || filters.assignee);

  async function saveAssign(employeeIds) {
    setAssignState({ busy: true, error: '' });
    try {
      if (assigning.bulk) {
        const { count } = await request(config.bulk, { method: 'POST', body: { studentIds: assigning.ids, employeeIds } });
        toast.success(`Staff assigned to ${formatCount(count)} ${count === 1 ? 'student' : 'students'}. Earlier assignments were kept.`);
        setSelected([]);
      } else {
        await request(config.assign(assigning.student.id), { method: 'PATCH', body: { employeeIds } });
        toast.success(`Assignment saved for ${studentName(assigning.student)}.`);
        setOpen(null);
      }
      setAssigning(null); setAssignState({ busy: false, error: '' });
      list.reload();
    } catch (failure) { setAssignState({ busy: false, error: failure.message }); }
  }

  async function remove() {
    setWorking(true);
    try {
      const { followupsDeleted } = await request(`/reference-students/${removing.id}`, { method: 'DELETE' });
      toast.success(`${studentName(removing)} deleted${followupsDeleted ? ` with ${formatCount(followupsDeleted)} ${followupsDeleted === 1 ? 'note' : 'notes'}` : ''}.`);
      setRemoving(null); setOpen(null); setSelected((current) => current.filter((id) => id !== removing.id));
      list.reload();
    } catch (failure) { setRemoving((current) => current && { ...current, error: failure.message }); } finally { setWorking(false); }
  }

  const menuFor = (student) => [
    { key: 'open', label: 'Open notes', icon: 'note', onSelect: () => setOpen(student) },
    { key: 'edit', label: 'Edit details', icon: 'edit', hidden: !mayChange(student), onSelect: () => setEditing(student) },
    { key: 'assign', label: 'Assign staff…', icon: 'userPlus', hidden: !rights.manage, onSelect: () => setAssigning({ student }) },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !mayChange(student), onSelect: () => setRemoving(student) },
  ];
  const ids = rows.map((row) => row.id);
  const allChosen = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someChosen = ids.some((id) => selected.includes(id));
  const columns = rights.manage ? 7 : 6;
  const openRow = (event, student) => { if (!event.target.closest('a, button, input, label')) setOpen(student); };

  return <div className={styles.screen}>
    <PageToolbar start={<>
      <span className={styles.kindTabs}><ViewTabs label="Student list" value={kind} onChange={switchKind} items={[
        { key: 'reference', label: 'Reference students', count: kind === 'reference' ? data?.total : undefined },
        { key: 'account', label: rights.manage ? 'Login accounts' : 'Assigned login accounts', count: kind === 'account' ? data?.total : undefined },
      ]} /></span>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search students</span>
        <input type="search" value={query} maxLength={120} placeholder="Name, email or mobile" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {rights.manage && kind === 'reference' && <label className={styles.inlineSelect}><span className="sr-only">Assigned to</span>
        <select className="adm-select" value={filters.assignee} onChange={(event) => update({ assignee: event.target.value })}>
          <option value="">Anyone assigned</option>
          <option value="none">Unassigned</option>
          {staff.items.map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
        </select>
      </label>}
    </>}>
      {rights.create && kind === 'reference' && <Link className="adm-btn adm-btn--primary" href="/admin/reference-students/new"><Icon name="userPlus" />Add students</Link>}
    </PageToolbar>

    <section className={`adm-panel ${styles.tablePanel}`} aria-label={config.noun}>
      {selected.length > 0 && <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
        <strong>{formatCount(selected.length)} selected</strong>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => setAssigning({ bulk: true, ids: selected })}><Icon name="userPlus" />Assign staff</button>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSelected([])}>Clear selection</button>
      </div>}
      {list.error ? <div className={t.state} role="alert"><Icon name="alert" /><p>{list.error}</p><button type="button" className="adm-btn adm-btn--sm" onClick={list.reload}>Try again</button></div>
        : <div className={t.scroll} data-busy={list.busy || undefined}>
          <table className={`${t.table} ${styles.table}`} aria-busy={list.loading || list.busy}>
            <caption className="sr-only">{config.noun}</caption>
            <thead><tr>
              {rights.manage && <th scope="col" className={t.checkCell}><input type="checkbox" aria-label="Select all students on this page" checked={allChosen} disabled={!ids.length}
                ref={(node) => { if (node) node.indeterminate = someChosen && !allChosen; }}
                onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} /></th>}
              <th scope="col">Student</th>
              <th scope="col" className={styles.optional}>Contact</th>
              <th scope="col" style={{ width: '20%' }}>Assigned to</th>
              <th scope="col" className={styles.optional} style={{ width: '18%' }}>{kind === 'reference' ? 'Added by' : 'Last sign-in'}</th>
              <th scope="col" style={{ width: 110 }}>{kind === 'reference' ? 'Added' : 'Joined'}</th>
              <th scope="col" className={styles.menuCell}><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              {list.loading && !rows.length ? Array.from({ length: 10 }, (_, index) => <tr key={index} className={t.skeletonRow} aria-hidden="true">
                {Array.from({ length: columns }, (_, cell) => <td key={cell} className={rights.manage && cell === 0 ? t.checkCell : undefined}><span style={{ width: '65%' }} /></td>)}
              </tr>) : rows.map((student) => <tr key={student.id} className={styles.clickRow} data-selected={selected.includes(student.id) || undefined} onClick={(event) => openRow(event, student)}>
                {rights.manage && <td className={t.checkCell}><input type="checkbox" aria-label={`Select ${studentName(student)}`} checked={selected.includes(student.id)}
                  onChange={(event) => setSelected((current) => (event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id)))} /></td>}
                <td className={styles.mainCell}><button type="button" className={styles.rowLink} title={studentName(student)} onClick={() => setOpen(student)}>{studentName(student)}</button></td>
                <td data-label="Contact" className={styles.optional}><span className={styles.clip} title={contactOf(student)}>{contactOf(student) || '—'}</span></td>
                <td data-label="Assigned to" className={styles.assignCell}><Assignees people={student.assignees} /></td>
                <td data-label={kind === 'reference' ? 'Added by' : 'Last sign-in'} className={styles.optional}>
                  {kind === 'reference' ? <span className={styles.clip} title={student.createdByEmail}>{student.createdById === admin?.id ? 'You' : student.createdByEmail}</span>
                    : <span title={student.lastLoginAt ? formatDateTime(student.lastLoginAt) : undefined}>{student.lastLoginAt ? formatWhen(student.lastLoginAt) : <span className={styles.muted}>—</span>}</span>}
                </td>
                <td data-label={kind === 'reference' ? 'Added' : 'Joined'} title={formatDateTime(student.createdAt)}>{formatDate(student.createdAt)}</td>
                <td className={styles.menuCell}><RowMenu label={`Actions for ${studentName(student)}`} items={menuFor(student)} /></td>
              </tr>)}
            </tbody>
          </table>
          {data && !rows.length && <div className={styles.emptyLine}>
            {filtered ? <><span>No students match.</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => { setQuery(''); update({ q: '', assignee: '' }); }}>Clear filters</button></>
              : kind === 'account' ? <span title="Accounts appear here when a manager assigns them to you.">No login accounts are assigned to you.</span>
                : <><span>{rights.manage ? 'No reference students yet.' : 'None assigned to you or added by you yet.'}</span>
                  {rights.create && <Link className="adm-btn adm-btn--sm" href="/admin/reference-students/new"><Icon name="userPlus" />Add students</Link>}</>}
          </div>}
        </div>}
      {data && data.total > 0 && <Pagination page={filters.page} pageSize={filters.limit} total={data.total} rowCount={rows.length} noun="students"
        hasNext={filters.page * filters.limit < data.total} hasPrevious={filters.page > 1} disabled={list.busy}
        onPage={(page) => { setSelected([]); setFilters((current) => ({ ...current, page })); }} onPageSize={(limit) => update({ limit })} />}
    </section>

    <StudentDrawer key={open?.id ?? 'none'} student={open} base={config.path} request={request} toast={toast} canAssign={rights.manage}
      meta={open && (kind === 'reference' ? `Added by ${open.createdById === admin?.id ? 'you' : open.createdByEmail} · ${formatDate(open.createdAt)}` : `Login account · last sign-in ${open.lastLoginAt ? formatWhen(open.lastLoginAt) : 'never'}`)}
      onAssign={() => setAssigning({ student: open })} onClose={() => setOpen(null)} />
    <AdminDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit student" subtitle={editing ? studentName(editing) : ''}>
      {editing && <EditDrawer key={editing.id} student={editing} request={request} toast={toast} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setOpen(null); list.reload(); }} />}
    </AdminDrawer>
    <AssignDrawer open={Boolean(assigning)} staff={staff} mode={assigning?.bulk ? 'add' : 'replace'} busy={assignState.busy} error={assignState.error}
      initial={assigning?.student?.assignedEmployeeIds ?? []}
      title={assigning?.bulk ? `Assign ${formatCount(assigning.ids.length)} students` : 'Assign staff'} subtitle={assigning?.student ? studentName(assigning.student) : undefined}
      onSave={saveAssign} onClose={() => { setAssigning(null); setAssignState({ busy: false, error: '' }); }} />
    <ConfirmDialog open={Boolean(removing)} tone="danger" requireText="DELETE" busy={working} error={removing?.error}
      title={removing ? `Delete ${studentName(removing)}?` : ''} confirmLabel="Delete student" onConfirm={remove} onCancel={() => setRemoving(null)}>
      The student and all their follow-up notes are removed for good. This cannot be undone.
    </ConfirmDialog>
  </div>;
}


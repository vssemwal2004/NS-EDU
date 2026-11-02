'use client';
// Members: the staff table (or org chart), with search, role/status filters, row menus, bulk actions and
// the staff drawer. Staff lists are small (one row per employee), so they load once and filter here.
import { useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { can } from '@/features/admin/crm/meta';
import RowMenu from '@/features/admin/crm/RowMenu';
import { Avatar } from '@/features/admin/crm/ui';
import { dateTimeOf, displayName } from '@/features/admin/crm/format';
import { PageToolbar } from '@/features/admin/ui/Page';
import { copyText, shortDateTime, staffBlocks } from './access-model';
import { Segmented, StatusDot } from './AccessParts';
import OrgChart from './OrgChart';
import StaffDrawer from './StaffDrawer';
import { AssignDialog, PasswordDialog, RemoveDialog, SuspendDialog, nameOf } from './StaffDialogs';
import access from './Access.module.css';
import styles from './Team.module.css';

const number = (value) => value.toLocaleString('en-IN');

export default function TeamTab({ admin, request, data, reload, notify, onViewActivity, params, setParams }) {
  const { staff, roles, catalogue } = data;
  const canManage = can(admin, 'team.manage');
  const canAudit = can(admin, 'audit.view');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const dialogCount = useRef(0);

  // `?add=1` (from the shell's New menu) opens the Add staff drawer; closing it removes the parameter.
  const addAsked = params.get('add') === '1' && canManage;
  const openDrawer = drawer ?? (addAsked ? { mode: 'add' } : null);
  const closeDrawer = () => { setDrawer(null); if (params.get('add')) setParams({ add: null }); };

  const active = staff.filter((person) => person.status === 'active').length;
  const byId = useMemo(() => new Map(staff.map((person) => [person.id, person])), [staff]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((person) => (!role || person.roleId === role) && (!status || person.status === status)
      && (!needle || `${person.name} ${person.email} ${person.title}`.toLowerCase().includes(needle)));
  }, [staff, query, role, status]);
  const filtering = Boolean(query || role || status);
  const clearFilters = () => { setQuery(''); setRole(''); setStatus(''); };
  const chosen = selected.map((id) => byId.get(id)).filter(Boolean);
  const visibleIds = rows.map((person) => person.id);
  const allChosen = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someChosen = visibleIds.some((id) => selected.includes(id));

  // ---- Actions ------------------------------------------------------------------------------------------------------
  const ask = (kind, people) => {
    const reasonFor = { role: 'role', suspend: 'suspend', remove: 'remove', password: 'password' }[kind];
    const skipped = [];
    const ok = people.filter((person) => kind !== 'suspend' || person.status !== 'suspended').filter((person) => {
      const reason = reasonFor ? staffBlocks(admin, person, staff)[reasonFor] : '';
      if (reason) skipped.push({ person, reason });
      return !reason;
    });
    if (!ok.length) { notify(skipped[0]?.reason ?? 'Nothing to change.', 'error'); return; }
    dialogCount.current += 1;
    setDialogError('');
    setDialog({ id: dialogCount.current, kind, people: ok, skipped });
  };
  const closeDialog = () => { if (!busy) { setDialog(null); setDialogError(''); } };

  // Runs one PATCH per person (staff batches are small); reports partial failures instead of hiding them.
  async function patchEach(people, body, describe) {
    setBusy(true); setDialogError('');
    const failed = [];
    for (const person of people) {
      try { await request(`/access/staff/${person.id}`, { method: 'PATCH', body: typeof body === 'function' ? body(person) : body }); }
      catch (problem) { failed.push(`${nameOf(person)}: ${problem.message}`); }
    }
    await reload();
    setBusy(false);
    if (failed.length === people.length) { setDialogError(failed.join(' · ')); return false; }
    setDialog(null); setSelected([]);
    const done = people.length - failed.length;
    if (failed.length) notify(`${describe(done)} ${failed.length} not changed: ${failed.join(' · ')}`, 'error');
    return done;
  }
  const undo = (people, bodyOf, message) => ({ action: { label: 'Undo', onClick: async () => {
    try { for (const person of people) await request(`/access/staff/${person.id}`, { method: 'PATCH', body: bodyOf(person) }); await reload(); notify(message); }
    catch (problem) { notify(problem.message, 'error'); }
  } } });

  async function confirmAssign(value) {
    const { kind, people } = dialog;
    if (kind === 'role') {
      const roleName = roles.find((item) => item.slug === value)?.name ?? value;
      const targets = people.filter((person) => person.roleId !== value);
      if (!targets.length) { setDialog(null); return; }
      const done = await patchEach(targets, { roleId: value }, (count) => `${count} moved to ${roleName}.`);
      if (done) notify(done === 1 ? `${nameOf(targets[0])} is now ${roleName}.` : `${done} people are now ${roleName}.`, 'success',
        undo(targets, (person) => ({ roleId: person.roleId }), 'Role change undone.'));
    } else {
      const mentor = value ? byId.get(value) : null;
      const targets = people.filter((person) => (person.managerId ?? null) !== (value ?? null));
      if (!targets.length) { setDialog(null); return; }
      const done = await patchEach(targets, { managerId: value }, (count) => `${count} updated.`);
      if (done) notify(mentor ? `${done === 1 ? nameOf(targets[0]) : `${done} people`} now report${done === 1 ? 's' : ''} to ${nameOf(mentor)}.` : `Mentor removed for ${done === 1 ? nameOf(targets[0]) : `${done} people`}.`, 'success',
        undo(targets, (person) => ({ managerId: person.managerId ?? null }), 'Mentor change undone.'));
    }
  }
  async function confirmSuspend() {
    const { people } = dialog;
    const done = await patchEach(people, { status: 'suspended' }, (count) => `${count} suspended.`);
    if (done) notify(done === 1 ? `${nameOf(people[0])} was suspended and signed out.` : `${done} people were suspended and signed out.`, 'success',
      undo(people, () => ({ status: 'active' }), 'Reactivated.'));
  }
  async function reactivate(person) {
    try {
      await request(`/access/staff/${person.id}`, { method: 'PATCH', body: { status: 'active' } });
      await reload();
      notify(`${nameOf(person)} can sign in again.`);
    } catch (problem) { notify(problem.message, 'error'); }
  }
  async function confirmRemove() {
    const person = dialog.people[0];
    setBusy(true); setDialogError('');
    try {
      await request(`/access/staff/${person.id}`, { method: 'DELETE' });
      setDialog(null); setDrawer(null); setSelected((current) => current.filter((id) => id !== person.id));
      await reload();
      notify(`${nameOf(person)} was removed.`);
    } catch (problem) { setDialogError(problem.message); } finally { setBusy(false); }
  }
  async function confirmPassword(password) {
    const person = dialog.people[0];
    setBusy(true); setDialogError('');
    try {
      await request(`/access/staff/${person.id}/password`, { method: 'POST', body: { password } });
      setDialog(null);
      await reload();
      notify(`Password reset for ${nameOf(person)}. They must choose a new one at next sign-in.`);
    } catch (problem) { setDialogError(problem.fields?.password || problem.message); } finally { setBusy(false); }
  }
  async function copyEmail(person) {
    const ok = await copyText(person.email);
    notify(ok ? `Copied ${person.email}.` : 'Could not copy. Select the email and copy it by hand.', ok ? 'success' : 'error');
  }

  const menuItems = (person) => {
    const blocks = staffBlocks(admin, person, staff);
    const suspended = person.status === 'suspended';
    return [
      { key: 'open', label: canManage ? 'Open and edit' : 'Open', icon: canManage ? 'edit' : 'eye', onSelect:() => setDrawer({ mode: 'view', id: person.id }) },
      { key: 'role', label: 'Change role…', icon: 'key', hidden: !canManage, disabled: Boolean(blocks.role), reason: blocks.role, onSelect: () => ask('role', [person]) },
      { key: 'mentor', label: 'Set mentor…', icon: 'people', hidden: !canManage, onSelect: () => ask('mentor', [person]) },
      { key: 'password', label: 'Reset password…', icon: 'lock', hidden: !canManage, disabled: Boolean(blocks.password), reason: blocks.password, onSelect: () => ask('password', [person]) },
      { divider: true },
      { key: 'copy', label: 'Copy email', icon: 'copy', onSelect: () => copyEmail(person) },
      { key: 'activity', label: 'View activity', icon: 'history', hidden: !canAudit, onSelect: () => onViewActivity(person.email) },
      { divider: true },
      suspended
        ? { key: 'reactivate', label: 'Reactivate', icon: 'play', hidden: !canManage, onSelect: () => reactivate(person) }
        : { key: 'suspend', label: 'Suspend…', icon: 'pause', hidden: !canManage, disabled: Boolean(blocks.suspend), reason: blocks.suspend, onSelect: () => ask('suspend', [person]) },
      { key: 'remove', label: 'Remove…', icon: 'trash', tone: 'danger', hidden: !canManage, disabled: Boolean(blocks.remove), reason: blocks.remove, onSelect: () => ask('remove', [person]) },
    ];
  };

  const openRow = (event, person) => {
    if (event.target.closest('button, a, input, label, select')) return;
    setDrawer({ mode: 'view', id: person.id });
  };
  const toggle = (id, on) => setSelected((current) => (on ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  const toggleAll = (on) => setSelected((current) => (on ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id))));

  const summary = <><strong className="crm-tabnum">{number(staff.length)}</strong> staff · {number(active)} active{staff.length - active > 0 ? ` · ${number(staff.length - active)} suspended` : ''}</>;
  return <>
    <PageToolbar summary={summary} start={view === 'list' && <>
      <label className={access.search}><Icon name="search" /><span className="sr-only">Search staff</span>
        <input type="search" className="adm-input" value={query} placeholder="Search name, email or title" onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="sr-only" htmlFor="team-role">Role</label>
      <select id="team-role" className={`adm-select ${access.compactSelect}`} value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="">All roles</option>{roles.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="team-status">Status</label>
      <select id="team-status" className={`adm-select ${access.compactSelect}`} value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
      </select>
    </>}>
      <Segmented label="View" value={view} onChange={setView} options={[{ value: 'list', label: 'List', icon: 'menu' }, { value: 'chart', label: 'Org chart', icon: 'people' }]} />
      {canManage && <button type="button" className="adm-btn adm-btn--primary" onClick={() => setDrawer({ mode: 'add' })}><Icon name="userPlus" />Add staff</button>}
    </PageToolbar>

    {view === 'chart' ? <OrgChart staff={staff} onOpen={(person) => setDrawer({ mode: 'view', id: person.id })} />
      : <div className={`adm-panel ${access.tablePanel}`}>
        {canManage && chosen.length > 0 && <div className={styles.bulk} role="region" aria-label="Bulk actions">
          <span><strong className="crm-tabnum">{chosen.length}</strong> selected</span>
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => ask('role', chosen)}><Icon name="key" />Change role</button>
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => ask('mentor', chosen)}><Icon name="people" />Set mentor</button>
          <button type="button" className="adm-btn adm-btn--sm" disabled={!chosen.some((person) => person.status === 'active')} onClick={() => ask('suspend', chosen)}><Icon name="pause" />Suspend</button>
          <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => setSelected([])}>Clear</button>
        </div>}
        {rows.length ? <div className={access.scroll} tabIndex={0} role="region" aria-label="Staff">
          <table className={`${access.table} ${styles.table}`}>
            <thead><tr>
              {canManage && <th scope="col" className={access.check}><input type="checkbox" aria-label="Select all shown staff" checked={allChosen}
                ref={(node) => { if (node) node.indeterminate = someChosen && !allChosen; }} onChange={(event) => toggleAll(event.target.checked)} /></th>}
              <th scope="col">Person</th><th scope="col" className={styles.colRole}>Role</th><th scope="col" className={styles.colMentor}>Mentor</th><th scope="col" className={`${access.num} ${styles.colReports}`}>Reports</th>
              <th scope="col" className={styles.colStatus}>Status</th><th scope="col" className={styles.colSeen}>Last sign-in</th><th scope="col" className={access.menuCell}><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{rows.map((person) => {
              const isSelected = selected.includes(person.id);
              return <tr key={person.id} data-selected={isSelected || undefined} data-suspended={person.status === 'suspended' || undefined} onClick={(event) => openRow(event, person)}>
                {canManage && <td className={access.check}><input type="checkbox" aria-label={`Select ${nameOf(person)}`} checked={isSelected} onChange={(event) => toggle(person.id, event.target.checked)} /></td>}
                <td className={styles.personCell}>
                  <span className={styles.person}>
                    <Avatar name={person.name} email={person.email} size={24} />
                    <span className={styles.personText}>
                      <button type="button" className={styles.nameButton} onClick={() => setDrawer({ mode: 'view', id: person.id })}>{nameOf(person)}</button>
                      {person.id === admin.id && <span className={styles.you}>(you)</span>}
                      <small className={access.truncate} title={[person.title, person.email].filter(Boolean).join(' · ')}>{person.title ? `${person.title} · ` : ''}{person.email}</small>
                    </span>
                  </span>
                </td>
                <td className={styles.roleCell}><span className={access.truncate} title={person.roleName}>{person.roleName || <span className={access.muted}>—</span>}</span></td>
                <td className={styles.mentorCell}>{person.managerName ? <span className={styles.mentor} title={person.managerName}><Avatar name={person.managerName} size={20} /><span className={access.truncate}>{displayName(person.managerName)}</span></span> : <span className={access.muted}>—</span>}</td>
                <td className={`${access.num} ${styles.reportsCell}`}>{person.directReports ? number(person.directReports) : <span className={access.muted}>—</span>}</td>
                <td className={styles.statusCell}><StatusDot status={person.status} /></td>
                <td className={styles.seenCell} title={person.lastLoginAt ? dateTimeOf(person.lastLoginAt) : undefined}>{person.lastLoginAt ? shortDateTime(person.lastLoginAt) : <span className={access.muted}>Never</span>}</td>
                <td className={`${access.menuCell} ${styles.menuCell}`}><RowMenu label={`Actions for ${nameOf(person)}`} items={menuItems(person)} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
          : <div className={access.empty}>
            <p>{filtering ? 'No one matches these filters.' : 'No staff yet.'}</p>
            {filtering ? <button type="button" className="adm-btn adm-btn--sm" onClick={clearFilters}>Clear filters</button>
              : canManage && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setDrawer({ mode: 'add' })}><Icon name="userPlus" />Add staff</button>}
          </div>}
      </div>}

    <StaffDrawer target={openDrawer} admin={admin} roles={roles} staff={staff} catalogue={catalogue} request={request} notify={notify} canManage={canManage}
      onChanged={reload} onClose={closeDrawer} onAction={(kind, person) => (kind === 'reactivate' ? reactivate(person) : ask(kind, [person]))} />
    <AssignDialog key={`assign-${dialog?.id ?? 0}`} state={dialog} admin={admin} roles={roles} staff={staff} catalogue={catalogue} busy={busy} error={dialogError} onCancel={closeDialog} onConfirm={confirmAssign} />
    <SuspendDialog state={dialog} busy={busy} error={dialogError} onCancel={closeDialog} onConfirm={confirmSuspend} />
    <RemoveDialog state={dialog} busy={busy} error={dialogError} onCancel={closeDialog} onConfirm={confirmRemove} />
    <PasswordDialog key={`password-${dialog?.id ?? 0}`} state={dialog} busy={busy} error={dialogError} notify={notify} onCancel={closeDialog} onConfirm={confirmPassword} />
  </>;
}

'use client';
// The staff drawer: "Add staff", or one person's details (view for everyone, edit for staff managers).
// Account actions (reset password, suspend, remove) open the shared dialogs owned by the Members tab.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { Avatar } from '@/features/admin/crm/ui';
import { dateTimeOf, displayName } from '@/features/admin/crm/format';
import { assignableRole, effectiveKeys, generatePassword, passwordProblem, reachWords, shortDateTime, staffBlocks } from './access-model';
import { Field, StatusDot } from './AccessParts';
import { PasswordBox, nameOf } from './StaffDialogs';
import access from './Access.module.css';
import styles from './StaffDrawer.module.css';

function RoleSelect({ id, value, onChange, roles, admin, catalogue, disabled, error }) {
  return <select id={id} className="adm-select" value={value} disabled={disabled} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)}>
    {roles.map((role) => {
      const why = role.slug === value ? '' : assignableRole(admin, role, catalogue);
      return <option key={role.slug} value={role.slug} disabled={Boolean(why)} title={role.description || undefined}>{role.name}{why ? ` (${why.replace(/\.$/, '').toLowerCase()})` : ''}</option>;
    })}
  </select>;
}
// A data line, not a paragraph: what the chosen role can see. The description is the option's tooltip.
const roleHint = (role, catalogue) => (role ? `Sees ${reachWords(effectiveKeys(role.permissions, catalogue)).replace(/^./, (c) => c.toLowerCase())}` : '');

/** People who can mentor `person`: active staff, never themselves or anyone below them. */
function mentorOptions(staff, person) {
  const below = new Set(person ? [person.id] : []);
  let grew = Boolean(person);
  while (grew) { grew = false; for (const other of staff) if (other.managerId && below.has(other.managerId) && !below.has(other.id)) { below.add(other.id); grew = true; } }
  return staff.filter((other) => !below.has(other.id) && (other.status === 'active' || other.id === person?.managerId)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}

// ---- Add --------------------------------------------------------------------------------------------------------------

function AddForm({ admin, roles, staff, catalogue, request, notify, onDone, onClose }) {
  const defaultRole = roles.find((role) => role.slug === 'executive' && !assignableRole(admin, role, catalogue)) ?? roles.find((role) => !assignableRole(admin, role, catalogue));
  const [form, setForm] = useState(() => ({ email: '', phone: '', name: '', title: '', roleId: defaultRole?.slug ?? '', managerId: '', password: generatePassword() }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [created, setCreated] = useState(null);
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const role = roles.find((candidate) => candidate.slug === form.roleId);
  const mentors = useMemo(() => mentorOptions(staff, null), [staff]);

  async function submit(event) {
    event.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) { setFields({ password: problem }); setError('Fix the highlighted field.'); return; }
    setBusy(true); setError(''); setFields({});
    try {
      const body = { email: form.email.trim(), phone: form.phone.trim(), password: form.password, roleId: form.roleId, name: form.name.trim(), title: form.title.trim() };
      if (form.managerId) body.managerId = form.managerId;
      const { item } = await request('/access/staff', { method: 'POST', body });
      setCreated({ ...item, password: form.password });
      await onDone(`${nameOf(item)} was added as ${item.roleName}.`);
    } catch (problem) { setError(problem.message); setFields(problem.fields ?? {}); } finally { setBusy(false); }
  }

  if (created) {
    return <div className={styles.created}>
      <p className={styles.createdHead}><Icon name="check" /><strong>{nameOf(created)} can now sign in</strong></p>
      <p className={access.note}>Share these privately. The password is not shown again after you close this panel.</p>
      <dl className={access.sheet}>
        <dt>Email</dt><dd>{created.email}</dd>
        <dt>Temporary password</dt><dd><PasswordBox id="created-password" value={created.password} readOnly notify={notify} /></dd>
      </dl>
      <div className={styles.footer}><button type="button" className="adm-btn adm-btn--primary" onClick={onClose}>Done</button></div>
    </div>;
  }
  return <form className={styles.form} onSubmit={submit} noValidate>
    {error && <p className={access.formError} role="alert"><Icon name="alert" />{error}</p>}
    <section className={styles.group} aria-labelledby="add-person">
      <h3 id="add-person" className={access.sectionLabel}>Person</h3>
      <div className={styles.two}>
        <Field label="Name" htmlFor="staff-name" error={fields.name}><input id="staff-name" className="adm-input" value={form.name} maxLength={80} autoComplete="off" onChange={(event) => set({ name: event.target.value })} /></Field>
        <Field label="Job title" htmlFor="staff-title" error={fields.title}><input id="staff-title" className="adm-input" value={form.title} maxLength={80} placeholder="e.g. Senior counsellor" onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="Work email" htmlFor="staff-email" required error={fields.email}><input id="staff-email" className="adm-input" type="email" autoComplete="off" required value={form.email} aria-invalid={Boolean(fields.email)} onChange={(event) => set({ email: event.target.value })} /></Field>
        <Field label="Mobile number" htmlFor="staff-phone" required error={fields.phone}><input id="staff-phone" className="adm-input" type="tel" inputMode="tel" autoComplete="off" required placeholder="+91 98765 43210" title="10 to 15 digits, optionally starting with +" value={form.phone} aria-invalid={Boolean(fields.phone)} onChange={(event) => set({ phone: event.target.value })} /></Field>
      </div>
    </section>
    <section className={styles.group} aria-labelledby="add-access">
      <h3 id="add-access" className={access.sectionLabel}>Access</h3>
      <div className={styles.two}>
        <Field label="Role" htmlFor="staff-role" required error={fields.roleId} hint={roleHint(role, catalogue)}>
          <RoleSelect id="staff-role" value={form.roleId} roles={roles} admin={admin} catalogue={catalogue} error={fields.roleId} onChange={(roleId) => set({ roleId })} />
        </Field>
        <Field label="Mentor" htmlFor="staff-mentor" error={fields.managerId}>
          <select id="staff-mentor" className="adm-select" value={form.managerId} title="The team lead who sees and supports this person’s leads" onChange={(event) => set({ managerId: event.target.value })}>
            <option value="">No mentor</option>
            {mentors.map((person) => <option key={person.id} value={person.id}>{nameOf(person)} · {person.roleName}</option>)}
          </select>
        </Field>
      </div>
    </section>
    <section className={styles.group} aria-labelledby="add-signin">
      <h3 id="add-signin" className={access.sectionLabel}>Sign-in</h3>
      <Field label="Temporary password" htmlFor="staff-password" required error={fields.password} hint="They choose their own at first sign-in.">
        <PasswordBox id="staff-password" value={form.password} onChange={(password) => set({ password })} error={fields.password} notify={notify} />
      </Field>
    </section>
    <div className={styles.footer}>
      <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || !form.email.trim() || !form.phone.trim() || !form.roleId}>{busy ? 'Adding…' : 'Add staff member'}</button>
    </div>
  </form>;
}

// ---- View / edit ------------------------------------------------------------------------------------------------------

function PersonView({ admin, person, roles, staff, catalogue, request, onDone, onClose, canManage, onAction }) {
  const blocks = staffBlocks(admin, person, staff);
  const [form, setForm] = useState({ name: person.name, title: person.title, phone: person.phone, roleId: person.roleId, managerId: person.managerId ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const role = roles.find((candidate) => candidate.slug === form.roleId);
  const mentors = useMemo(() => mentorOptions(staff, person), [staff, person]);
  const reports = staff.filter((other) => other.managerId === person.id);
  const suspended = person.status === 'suspended';

  const changes = {};
  if (form.name.trim() !== person.name) changes.name = form.name.trim();
  if (form.title.trim() !== person.title) changes.title = form.title.trim();
  if (form.phone.trim() !== person.phone) changes.phone = form.phone.trim();
  if (form.roleId !== person.roleId) changes.roleId = form.roleId;
  if ((form.managerId || null) !== person.managerId) changes.managerId = form.managerId || null;
  const dirty = Object.keys(changes).length > 0;

  async function save(event) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true); setError(''); setFields({});
    try {
      await request(`/access/staff/${person.id}`, { method: 'PATCH', body: changes });
      await onDone(`${nameOf(person)} was updated.`);
    } catch (problem) { setError(problem.message); setFields(problem.fields ?? {}); } finally { setBusy(false); }
  }

  const when = (value) => (value ? <span title={dateTimeOf(value)}>{shortDateTime(value)}</span> : <span className={access.muted}>Never</span>);
  const facts = <dl className={access.sheet}>
    {!canManage && <><dt>Role</dt><dd>{person.roleName || <span className={access.muted}>—</span>}</dd></>}
    {!canManage && <><dt>Mentor</dt><dd>{person.managerName ? displayName(person.managerName) : <span className={access.muted}>—</span>}</dd></>}
    {!canManage && <><dt>Mobile</dt><dd>{person.phone || <span className={access.muted}>—</span>}</dd></>}
    <dt>Status</dt><dd><StatusDot status={person.status} />{person.mustChangePassword && <span className={styles.pending} title="They have not replaced the temporary password yet"><Icon name="key" />Temporary password</span>}</dd>
    <dt>Reports</dt><dd>{reports.length ? <span className={access.truncate} title={reports.map(nameOf).join(', ')}>{reports.map(nameOf).join(', ')}</span> : <span className={access.muted}>—</span>}</dd>
    <dt>Last sign-in</dt><dd>{when(person.lastLoginAt)}</dd>
    {person.createdAt && <><dt>Added</dt><dd>{when(person.createdAt)}</dd></>}
  </dl>;

  const who = <div className={styles.who}>
    <Avatar name={person.name} email={person.email} size={36} />
    <div>
      <strong>{nameOf(person)}{person.id === admin.id && <span className={styles.you}> (you)</span>}</strong>
      <span>{person.title ? `${person.title} · ` : ''}{person.email}</span>
    </div>
  </div>;

  if (!canManage) {
    return <div className={styles.view}>
      {who}
      {facts}
      <p className={access.note}><Icon name="eye" />View only. People who manage staff can change these details.</p>
    </div>;
  }
  const accountRow = (label, value, button, reason) => <><dt>{label}</dt><dd className={styles.accountValue}>
    <span className={reason ? access.muted : undefined}>{reason || value}</span>{button}
  </dd></>;
  return <form className={`${styles.view} ${styles.form}`} onSubmit={save} noValidate aria-label={`Details of ${nameOf(person)}`}>
    {who}
    {facts}
    {error && <p className={access.formError} role="alert"><Icon name="alert" />{error}</p>}
    <section className={styles.group} aria-labelledby="person-details">
      <h3 id="person-details" className={access.sectionLabel}>Details</h3>
      <div className={styles.two}>
        <Field label="Name" htmlFor="edit-name" error={fields.name}><input id="edit-name" className="adm-input" value={form.name} maxLength={80} onChange={(event) => set({ name: event.target.value })} /></Field>
        <Field label="Job title" htmlFor="edit-title" error={fields.title}><input id="edit-title" className="adm-input" value={form.title} maxLength={80} onChange={(event) => set({ title: event.target.value })} /></Field>
        <Field label="Mobile number" htmlFor="edit-phone" error={fields.phone}><input id="edit-phone" className="adm-input" type="tel" inputMode="tel" value={form.phone} aria-invalid={Boolean(fields.phone)} onChange={(event) => set({ phone: event.target.value })} /></Field>
      </div>
    </section>
    <section className={styles.group} aria-labelledby="person-access">
      <h3 id="person-access" className={access.sectionLabel}>Access</h3>
      <div className={styles.two}>
        <Field label="Role" htmlFor="edit-role" error={fields.roleId} hint={blocks.role || roleHint(role, catalogue)}>
          <RoleSelect id="edit-role" value={form.roleId} roles={roles} admin={admin} catalogue={catalogue} disabled={Boolean(blocks.role)} error={fields.roleId} onChange={(roleId) => set({ roleId })} />
        </Field>
        <Field label="Mentor" htmlFor="edit-mentor" error={fields.managerId}>
          <select id="edit-mentor" className="adm-select" value={form.managerId} title="Mentors see, assign and follow up their team’s leads" onChange={(event) => set({ managerId: event.target.value })}>
            <option value="">No mentor</option>
            {mentors.map((other) => <option key={other.id} value={other.id}>{nameOf(other)} · {other.roleName}{other.status === 'suspended' ? ' (suspended)' : ''}</option>)}
          </select>
        </Field>
      </div>
    </section>
    <section className={styles.group} aria-labelledby="person-account">
      <h3 id="person-account" className={access.sectionLabel}>Account</h3>
      <dl className={access.sheet}>
        {accountRow('Password', person.mustChangePassword ? 'Temporary, not changed yet' : 'Set by them',
          <button type="button" className="adm-btn adm-btn--sm" disabled={Boolean(blocks.password)} onClick={() => onAction('password', person)}><Icon name="lock" />Reset</button>, blocks.password)}
        {accountRow('Sign-in', suspended ? 'Blocked' : 'Allowed',
          suspended ? <button type="button" className="adm-btn adm-btn--sm" onClick={() => onAction('reactivate', person)}><Icon name="play" />Reactivate</button>
            : <button type="button" className="adm-btn adm-btn--sm" disabled={Boolean(blocks.suspend)} title="Signs them out at once and blocks sign-in. Their data is kept." onClick={() => onAction('suspend', person)}><Icon name="pause" />Suspend</button>, suspended ? '' : blocks.suspend)}
        {accountRow('Remove', 'Deletes the sign-in for good',
          <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" disabled={Boolean(blocks.remove)} onClick={() => onAction('remove', person)}><Icon name="trash" />Remove</button>, blocks.remove)}
      </dl>
    </section>
    <div className={styles.footer}>
      {dirty && <span className={styles.dirty}>Unsaved changes</span>}
      <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>{dirty ? 'Cancel' : 'Close'}</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

export default function StaffDrawer({ target, admin, roles, staff, catalogue, request, notify, canManage, onChanged, onClose, onAction }) {
  const person = target?.mode === 'view' ? staff.find((candidate) => candidate.id === target.id) : null;
  const add = target?.mode === 'add';
  const title = add ? 'Add staff' : person ? (canManage ? 'Edit staff member' : 'Staff member') : '';
  const subtitle = '';
  // After a save the list refreshes first, then the drawer closes (add stays open to show the password).
  const done = async (message, close = true) => { await onChanged(); notify(message); if (close) onClose(); };
  return <AdminDrawer open={add || Boolean(person)} onClose={onClose} title={title} subtitle={subtitle}>
    {add && <AddForm admin={admin} roles={roles} staff={staff} catalogue={catalogue} request={request} notify={notify} onDone={(message) => done(message, false)} onClose={onClose} />}
    {person && <PersonView key={`${person.id}-${person.status}-${person.roleId}-${person.managerId}-${person.name}-${person.title}-${person.phone}`} admin={admin} person={person} roles={roles} staff={staff}
      catalogue={catalogue} request={request} canManage={canManage} onDone={done} onClose={onClose} onAction={onAction} />}
  </AdminDrawer>;
}

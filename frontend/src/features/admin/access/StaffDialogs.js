'use client';
// Small confirm-style dialogs for staff actions, used from row menus, the bulk bar and the staff drawer:
// change role, set mentor, suspend, remove and reset password. Each works for one person or several.
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { displayName } from '@/features/admin/crm/format';
import { assignableRole, copyText, generatePassword, passwordProblem } from './access-model';
import { ConfirmDialog, Field } from './AccessParts';
import styles from './Team.module.css';

export const nameOf = (person) => person.name || displayName(person.email);
const list = (people) => (people.length === 1 ? nameOf(people[0]) : `${people.length} people`);

export function PasswordBox({ id, value, onChange, error, notify, readOnly = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyText(value);
    setCopied(ok);
    notify(ok ? 'Password copied.' : 'Could not copy. Select the password and copy it by hand.', ok ? 'success' : 'error');
    window.setTimeout(() => setCopied(false), 2500);
  };
  return <div className={styles.passwordRow}>
    <input id={id} className={`adm-input ${styles.mono}`} value={value} readOnly={readOnly} autoComplete="off" spellCheck={false} aria-invalid={Boolean(error)} onChange={(event) => onChange?.(event.target.value)} />
    {!readOnly && <button type="button" className="adm-btn" onClick={() => onChange(generatePassword())}><Icon name="refresh" />New</button>}
    <button type="button" className="adm-btn" onClick={copy} disabled={!value}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy'}</button>
  </div>;
}

/** Everyone below `ids` in the mentor tree (they cannot become mentors of `ids`: that would make a loop). */
function below(staff, ids) {
  const out = new Set(ids);
  let grew = true;
  while (grew) { grew = false; for (const other of staff) if (other.managerId && out.has(other.managerId) && !out.has(other.id)) { out.add(other.id); grew = true; } }
  return out;
}

export function AssignDialog({ state, admin, roles, staff, catalogue, busy, error, onCancel, onConfirm }) {
  const open = state?.kind === 'role' || state?.kind === 'mentor';
  const people = useMemo(() => state?.people ?? [], [state]);
  const role = state?.kind === 'role';
  const first = people[0];
  const [value, setValue] = useState(() => (role ? (people.length === 1 ? first.roleId : '') : (people.length === 1 ? first.managerId ?? '' : '')));
  const mentors = useMemo(() => {
    if (role || !open) return [];
    const blocked = below(staff, people.map((person) => person.id));
    return staff.filter((other) => !blocked.has(other.id) && other.status === 'active').sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [role, open, staff, people]);
  const unchanged = people.length === 1 && value === (role ? first.roleId : first.managerId ?? '');
  const valid = role ? Boolean(value) : true;

  return <ConfirmDialog open={open} tone="primary" icon={role ? 'key' : 'people'} busy={busy} error={error}
    title={role ? `Change role for ${list(people)}` : `Set mentor for ${list(people)}`} confirmLabel={role ? 'Change role' : 'Set mentor'}
    onCancel={onCancel} onConfirm={() => { if (valid && !unchanged) onConfirm(value || null); }}>
    {role ? <Field label="New role" htmlFor="assign-role" hint={roles.find((item) => item.slug === value)?.description}>
      <select id="assign-role" className="adm-select" value={value} onChange={(event) => setValue(event.target.value)} required>
        {people.length > 1 && <option value="" disabled>Choose a role</option>}
        {roles.map((item) => { const why = assignableRole(admin, item, catalogue); return <option key={item.slug} value={item.slug} disabled={Boolean(why)}>{item.name}{why ? ` (${why.replace(/\.$/, '').toLowerCase()})` : ''}</option>; })}
      </select>
    </Field>
      : <Field label="Mentor" htmlFor="assign-mentor">
        <select id="assign-mentor" className="adm-select" value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">No mentor</option>
          {mentors.map((other) => <option key={other.id} value={other.id}>{nameOf(other)} · {other.roleName}</option>)}
        </select>
      </Field>}
    <SkipNote skipped={state?.skipped} />
    {unchanged && <p className="adm-hint">Choose a different {role ? 'role' : 'mentor'} to make a change.</p>}
  </ConfirmDialog>;
}

/** Bulk actions leave out people they cannot apply to (yourself, the last owner) and say so. */
function SkipNote({ skipped = [] }) {
  if (!skipped.length) return null;
  return <p className={styles.skipNote}><Icon name="alert" /><span>Left out: {skipped.map(({ person, reason }) => `${nameOf(person)} (${reason.replace(/\.$/, '')})`).join('; ')}.</span></p>;
}

export function SuspendDialog({ state, busy, error, onCancel, onConfirm }) {
  const people = state?.kind === 'suspend' ? state.people : [];
  return <ConfirmDialog open={state?.kind === 'suspend'} tone="danger" icon="pause" busy={busy} error={error}
    title={`Suspend ${list(people)}?`} confirmLabel={people.length > 1 ? `Suspend ${people.length}` : 'Suspend'} onCancel={onCancel} onConfirm={onConfirm}>
    <p>{people.length > 1 ? 'They are signed out at once and cannot sign in until someone reactivates their accounts.' : 'They are signed out at once and cannot sign in until someone reactivates the account.'}</p>
    <p className="adm-hint">Leads, notes and history stay as they are. You can reactivate at any time.</p>
    <SkipNote skipped={state?.skipped} />
  </ConfirmDialog>;
}

export function RemoveDialog({ state, busy, error, onCancel, onConfirm }) {
  const person = state?.kind === 'remove' ? state.people[0] : null;
  return <ConfirmDialog open={Boolean(person)} tone="danger" icon="trash" busy={busy} error={error} requireText={person ? person.email : undefined}
    title={`Remove ${person ? nameOf(person) : ''}?`} confirmLabel="Remove for good" onCancel={onCancel} onConfirm={onConfirm}>
    <p>Their sign-in is deleted and cannot be restored. Past actions stay in the activity log under their email.</p>
    <p className="adm-hint">Anyone who reports to them, and any leads or follow-ups assigned to them, must be moved first. To keep the account but block sign-in, suspend instead.</p>
  </ConfirmDialog>;
}

export function PasswordDialog({ state, busy, error, notify, onCancel, onConfirm }) {
  const person = state?.kind === 'password' ? state.people[0] : null;
  const [password, setPassword] = useState(() => generatePassword());
  const [problem, setProblem] = useState('');
  const confirm = () => { const why = passwordProblem(password); setProblem(why); if (!why) onConfirm(password); };
  return <ConfirmDialog open={Boolean(person)} tone="primary" icon="key" busy={busy} error={error}
    title={`Reset password for ${person ? nameOf(person) : ''}?`} confirmLabel="Reset password" onCancel={onCancel} onConfirm={confirm}>
    <p>Their current password stops working at once. Share the new one privately; they must change it at next sign-in.</p>
    <Field label="New temporary password" htmlFor="reset-password" error={problem} hint="At least 8 characters with upper-case, lower-case and a special character.">
      <PasswordBox id="reset-password" value={password} onChange={setPassword} error={problem} notify={notify} />
    </Field>
  </ConfirmDialog>;
}

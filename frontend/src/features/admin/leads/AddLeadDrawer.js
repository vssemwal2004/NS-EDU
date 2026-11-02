'use client';
// "Add lead": a drawer form for a lead that came in by phone, walk-in or referral (channel "Added by staff").
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import { PRIORITIES, PRIORITY_ORDER } from '@/features/admin/crm/meta';
import { isIndianMobile } from './lead-format';
import { personName } from './lead-views';
import styles from './LeadForms.module.css';

const BLANK = { fullName: '', phone: '', email: '', city: '', state: '', courseName: '', institutionName: '', message: '', source: '', priority: 'normal' };

function Field({ id, label, required, error, hint, wide, children }) {
  return <div className={drawerStyles.formField} data-wide={wide || undefined}>
    <label className={`adm-label ${styles.label}`} htmlFor={id}>{label}{required && <span className={styles.req} aria-hidden="true">*</span>}</label>
    {children}
    {hint && !error && <span className="adm-hint" id={`${id}-hint`}>{hint}</span>}
    {error && <span className="adm-error" id={`${id}-error`} role="alert">{error}</span>}
  </div>;
}

function Form({ request, admin, states, assignees, canAssign, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [assignee, setAssignee] = useState(admin.id);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: '', duplicate: null });
  const set = (key) => (event) => { setForm((current) => ({ ...current, [key]: event.target.value })); setErrors((current) => ({ ...current, [key]: '' })); };
  const input = (key, extra = {}) => ({
    id: `add-lead-${key}`, className: key === 'state' || key === 'priority' ? 'adm-select' : key === 'message' ? 'adm-textarea' : 'adm-input', value: form[key], onChange: set(key), 'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `add-lead-${key}-error` : undefined, ...extra,
  });
  const people = assignees.some((person) => person.id === admin.id) ? assignees : [{ id: admin.id, email: admin.email, name: admin.name }, ...assignees];

  async function submit(event, force = false) {
    event?.preventDefault();
    if (state.busy) return;
    const problems = {};
    if (form.fullName.trim().length < 2) problems.fullName = 'Enter the full name.';
    if (!isIndianMobile(form.phone)) problems.phone = 'Enter a 10-digit Indian mobile number.';
    if (Object.keys(problems).length) { setErrors(problems); return; }
    setState({ busy: true, error: '', duplicate: null });
    try {
      const body = { ...form, ...(canAssign && assignee !== admin.id && { assigneeIds: [assignee] }), ...(force && { force: true }) };
      const { item } = await request('/crm/leads', { method: 'POST', body });
      onCreated(item);
    } catch (failure) {
      if (failure.status === 409 && failure.details?.duplicateId) {
        setState({ busy: false, error: '', duplicate: { id: failure.details.duplicateId, ref: failure.details.duplicateRef } });
      } else {
        setErrors(failure.fields ?? {});
        setState({ busy: false, error: failure.fields ? 'Check the highlighted fields.' : failure.message, duplicate: null });
      }
    }
  }

  return <form className={drawerStyles.form} onSubmit={submit} noValidate>
    <fieldset className={styles.section}>
      <legend className={styles.sectionTitle}>Student</legend>
      <div className={drawerStyles.formGrid}>
        <Field id="add-lead-fullName" label="Full name" required error={errors.fullName} wide><input {...input('fullName', { maxLength: 80, autoComplete: 'off', autoFocus: true, required: true })} /></Field>
        <Field id="add-lead-phone" label="Mobile" required error={errors.phone}><input {...input('phone', { type: 'tel', inputMode: 'tel', maxLength: 18, autoComplete: 'off', placeholder: '98765 43210', required: true, title: '10-digit Indian mobile number, with or without +91' })} /></Field>
        <Field id="add-lead-email" label="Email" error={errors.email}><input {...input('email', { type: 'email', maxLength: 200, autoComplete: 'off' })} /></Field>
        <Field id="add-lead-city" label="City" error={errors.city}><input {...input('city', { maxLength: 80, autoComplete: 'off' })} /></Field>
        <Field id="add-lead-state" label="State" error={errors.state}>
          <select {...input('state')}><option value="">Not known</option>{states.map((name) => <option key={name} value={name}>{name}</option>)}</select>
        </Field>
      </div>
    </fieldset>
    <fieldset className={styles.section}>
      <legend className={styles.sectionTitle}>Interest</legend>
      <div className={drawerStyles.formGrid}>
        <Field id="add-lead-courseName" label="Course" error={errors.courseName}><input {...input('courseName', { maxLength: 120, placeholder: 'e.g. B.Tech CSE' })} /></Field>
        <Field id="add-lead-institutionName" label="Institution" error={errors.institutionName}><input {...input('institutionName', { maxLength: 160 })} /></Field>
        <Field id="add-lead-message" label="Message" error={errors.message} wide><textarea {...input('message', { maxLength: 500, rows: 3, placeholder: 'What the student asked for' })} /></Field>
      </div>
    </fieldset>
    <fieldset className={styles.section}>
      <legend className={styles.sectionTitle}>Handling</legend>
      <div className={drawerStyles.formGrid}>
        <Field id="add-lead-source" label="Source" error={errors.source}><input {...input('source', { maxLength: 80, placeholder: 'e.g. Walk-in, referral' })} /></Field>
        <Field id="add-lead-priority" label="Priority" error={errors.priority}>
          <select {...input('priority')}>{PRIORITY_ORDER.map((key) => <option key={key} value={key}>{PRIORITIES[key].label}</option>)}</select>
        </Field>
        <Field id="add-lead-assignee" label="Assign to" wide>
          <select id="add-lead-assignee" className="adm-select" value={assignee} disabled={!canAssign} title={canAssign ? undefined : 'The lead is assigned to you'} onChange={(event) => setAssignee(event.target.value)}>
            {people.map((person) => <option key={person.id} value={person.id}>{person.id === admin.id ? `Me (${personName(person)})` : personName(person)}</option>)}
          </select>
        </Field>
      </div>
    </fieldset>
    {state.duplicate && <div className={styles.duplicate} role="alert">
      <Icon name="alert" />
      <div>
        <strong>A lead with this number already exists: {state.duplicate.ref}</strong>
        <p>Open the existing lead to avoid a double entry, or add this one anyway.</p>
        <div className={styles.duplicateActions}>
          <Link className="adm-btn adm-btn--sm" href={`/admin/leads/${state.duplicate.id}`}>Open the existing lead</Link>
          <button type="button" className="adm-btn adm-btn--sm" disabled={state.busy} onClick={() => submit(null, true)}>{state.busy ? 'Adding…' : 'Add anyway'}</button>
        </div>
      </div>
    </div>}
    {state.error && <p className={drawerStyles.formError} role="alert"><Icon name="shield" />{state.error}</p>}
    <div className={drawerStyles.formActions}>
      <button type="button" className="adm-btn" onClick={onClose}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy}>{state.busy && !state.duplicate ? 'Adding…' : 'Add lead'}</button>
    </div>
  </form>;
}

export default function AddLeadDrawer({ open, onClose, ...props }) {
  return <AdminDrawer open={open} onClose={onClose} title="Add a lead" subtitle="A student who called, walked in or was referred. Added as New.">
    {open && <Form onClose={onClose} {...props} />}
  </AdminDrawer>;
}

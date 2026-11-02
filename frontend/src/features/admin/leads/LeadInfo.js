'use client';
// Lead 360 right column: contact details (edited in a drawer), what the lead asked for, the application,
// assignment, consent and source, and the danger zone.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { Avatar } from '@/features/admin/crm/ui';
import { can } from '@/features/admin/crm/meta';
import { displayName } from '@/features/admin/crm/format';
import { useToaster } from '@/features/admin/crm/toast';
import { Panel } from '@/features/admin/ui/Page';
import { GENDERS, labelOf, QUALIFICATIONS, STUDY_MODES } from '@/features/apply/apply-options';
import { answerText, channelOf, classLabel, formatDate, formatDateTime, isIndianMobile, isQuick, streamLabel } from './lead-format';
import { formatWhen, Person } from './lead-bits';
import { personName } from './lead-views';
import forms from './LeadForms.module.css';
import styles from './LeadPanel.module.css';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function age(dateOfBirth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const today = new Date();
  return today.getFullYear() - y - (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d) ? 1 : 0);
}
const blank = (value) => value === '' || value === null || value === undefined || value === false;

// rows: [label, value, key?]; empty rows are left out unless `showEmpty` (then they read "—").
function Facts({ rows, showEmpty = false }) {
  const shown = rows.filter(([, value]) => showEmpty || !blank(value));
  if (!shown.length) return <p className={styles.panelEmpty}>Nothing recorded.</p>;
  return <dl className={styles.facts}>{shown.map(([label, value, key]) => <div key={key ?? label}><dt>{label}</dt><dd data-empty={blank(value) || undefined}>{blank(value) ? '—' : value}</dd></div>)}</dl>;
}
const Verified = ({ on }) => (on ? <span className={styles.verified} title="Matches the address or number the student signed in with"><Icon name="check" />verified</span> : null);

export const APPLICANT_FIELDS = [
  { key: 'fullName', label: 'Full name', maxLength: 80, required: true, wide: true },
  { key: 'phone', label: 'Mobile', type: 'tel', maxLength: 18, required: true, hint: '10-digit Indian mobile number.' },
  { key: 'email', label: 'Email', type: 'email', maxLength: 200 },
  { key: 'city', label: 'City / town', maxLength: 80 },
  { key: 'state', label: 'State', select: true },
];
export const PROGRAMME_FIELDS = [
  { key: 'courseName', label: 'Course', maxLength: 120, wide: true },
  { key: 'institutionName', label: 'University / institution', maxLength: 160, wide: true },
  { key: 'message', label: 'Message / notes', textarea: true, maxLength: 500, wide: true },
];

/** The fields of one group, in a drawer. Saves with PATCH /crm/leads/:id/details; a duplicate mobile asks before saving anyway. */
function EditForm({ fields, values, states, request, leadId, onSaved, onCancel }) {
  const [draft, setDraft] = useState(values);
  const [state, setState] = useState({ busy: false, error: '', fields: {}, duplicate: null });
  const set = (key) => (event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setState((current) => ({ ...current, fields: { ...current.fields, [key]: '' } })); };

  async function save(event, force = false) {
    event?.preventDefault();
    if (state.busy) return;
    const problems = {};
    if (fields.some((field) => field.key === 'fullName') && draft.fullName.trim().length < 2) problems.fullName = 'Enter at least 2 characters.';
    if (fields.some((field) => field.key === 'phone') && !isIndianMobile(draft.phone)) problems.phone = 'Enter a 10-digit Indian mobile number.';
    if (Object.keys(problems).length) { setState({ busy: false, error: 'Check the highlighted fields.', fields: problems, duplicate: null }); return; }
    setState({ busy: true, error: '', fields: {}, duplicate: null });
    try {
      const { item } = await request(`/crm/leads/${leadId}/details`, { method: 'PATCH', body: { ...Object.fromEntries(fields.map((field) => [field.key, draft[field.key] ?? ''])), ...(force && { force: true }) } });
      onSaved(item);
    } catch (failure) {
      if (failure.status === 409 && failure.details?.duplicateId) setState({ busy: false, error: '', fields: {}, duplicate: { id: failure.details.duplicateId, ref: failure.details.duplicateRef } });
      else setState({ busy: false, error: failure.fields ? 'Check the highlighted fields.' : failure.message, fields: failure.fields ?? {}, duplicate: null });
    }
  }

  return <form className={drawerStyles.form} onSubmit={save} noValidate>
    <div className={drawerStyles.formGrid}>
      {fields.map((field) => {
        const id = `edit-${field.key}`;
        const error = state.fields[field.key];
        const common = { id, className: 'adm-input', value: draft[field.key] ?? '', onChange: set(field.key), 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-error` : field.hint ? `${id}-hint` : undefined };
        return <div key={field.key} className={drawerStyles.formField} data-wide={field.wide || undefined}>
          <label className={`adm-label ${forms.label}`} htmlFor={id}>{field.label}{field.required && <span className={forms.req} aria-hidden="true">*</span>}</label>
          {field.select ? <select {...common} className="adm-select"><option value="">Not known</option>{[...new Set([...states, draft[field.key]].filter(Boolean))].map((name) => <option key={name} value={name}>{name}</option>)}</select>
            : field.textarea ? <textarea {...common} className="adm-textarea" rows={3} maxLength={field.maxLength} />
              : <input {...common} type={field.type ?? 'text'} maxLength={field.maxLength} autoComplete="off" />}
          {field.hint && !error && <span className="adm-hint" id={`${id}-hint`}>{field.hint}</span>}
          {error && <span id={`${id}-error`} className="adm-error" role="alert">{error}</span>}
        </div>;
      })}
    </div>
    {state.duplicate && <div className={forms.duplicate} role="alert"><Icon name="alert" /><div>
      <strong>Another lead already uses this number: {state.duplicate.ref}</strong>
      <div className={forms.duplicateActions}>
        <Link className="adm-btn adm-btn--sm" href={`/admin/leads/${state.duplicate.id}`}>Open it</Link>
        <button type="button" className="adm-btn adm-btn--sm adm-btn--primary" disabled={state.busy} onClick={() => save(null, true)}>Save anyway</button>
      </div>
    </div></div>}
    {state.error && <p className="adm-error" role="alert">{state.error}</p>}
    <div className={drawerStyles.formActions}>
      <button type="button" className="adm-btn" onClick={onCancel}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

/** `editing` is '', 'applicant' or 'programme'. */
export function EditDrawer({ item, editing, states, request, onClose, onSaved }) {
  const applicant = item.applicant ?? {};
  const preference = item.preference ?? {};
  const programme = editing === 'programme';
  return <AdminDrawer open={Boolean(editing)} onClose={onClose} title={programme ? 'Edit course and university' : 'Edit contact details'} subtitle={`${applicant.fullName || 'Lead'} · ${item.ref}`}>
    {editing && <EditForm key={editing} fields={programme ? PROGRAMME_FIELDS : APPLICANT_FIELDS} states={states} request={request} leadId={item.id} onSaved={onSaved} onCancel={onClose}
      values={programme ? { courseName: preference.courseName ?? '', institutionName: preference.institutionName ?? '', message: preference.message ?? '' }
        : { fullName: applicant.fullName ?? '', phone: applicant.phone ?? '', email: applicant.email ?? '', city: applicant.city ?? '', state: applicant.state ?? '' }} />}
  </AdminDrawer>;
}

const editButton = (label, onClick) => <button type="button" className={`adm-btn adm-btn--sm adm-btn--ghost ${styles.groupEdit}`} onClick={onClick} aria-label={label}><Icon name="edit" />Edit</button>;

/** One titled group inside the Details panel; groups are separated by a hairline, not by boxes. */
function Group({ title, action, children }) {
  return <section className={styles.group}>
    <header className={styles.groupHead}><h3>{title}</h3>{action}</header>
    {children}
  </section>;
}

/** Contact details, what the lead asked for, the application (web leads) and consent & source, in one panel. */
export function DetailPanels({ item, admin, onEdit }) {
  const canEdit = can(admin, 'leads.edit');
  const channel = channelOf(item);
  const web = channel === 'web-apply';
  const quick = isQuick(item);
  const applicant = item.applicant ?? {};
  const academics = item.academics ?? {};
  const preference = item.preference ?? {};
  const school = item.school ?? {};
  const callback = item.callback ?? {};
  const answers = item.answers ?? [];
  const consent = item.consent ?? {};
  const source = item.source ?? {};
  const exams = item.exams ?? [];
  const years = age(applicant.dateOfBirth);
  const hasScore = academics.score !== null && academics.score !== undefined && academics.score !== '';
  const utm = [['Source', source.utmSource], ['Medium', source.utmMedium], ['Campaign', source.utmCampaign], ['Term', source.utmTerm], ['Content', source.utmContent]].filter(([, value]) => value);
  // The exact consent wording shown at submit time, whatever keys that form stored it under.
  const consentTexts = Object.entries(consent.text ?? {}).filter(([, text]) => typeof text === 'string' && text.trim());
  const formText = web ? (quick ? 'Quick apply (one screen)' : 'Detailed form') : channel === 'school-drive' ? 'School drive registration (QR form)' : channel === 'manual' ? 'Added by staff' : 'Counsellor callback request';
  const showProgramme = web || channel === 'manual' || preference.institutionName || preference.courseName;
  const consentSummary = consentTexts.length ? `${consentTexts.length} statement${consentTexts.length === 1 ? '' : 's'} accepted` : channel === 'manual' ? 'Not recorded online' : 'Agreed to be contacted';

  return <Panel title="Details">
    <Group title={channel === 'school-drive' ? 'Student' : 'Contact'} action={canEdit && editButton('Edit contact details', () => onEdit('applicant'))}>
      <Facts showEmpty rows={[
        ['Mobile', applicant.phone && <><a className="crm-tabnum" href={`tel:${applicant.phone}`}>{applicant.phone}</a><Verified on={item.contactVerified?.phone} /></>],
        ['Email', applicant.email && <><a href={`mailto:${applicant.email}`} title={applicant.email}>{applicant.email}</a><Verified on={item.contactVerified?.email} /></>],
        ['Location', [applicant.city, applicant.state].filter(Boolean).join(', ')],
        ...(web ? [
          ['Date of birth', applicant.dateOfBirth && `${formatDate(`${applicant.dateOfBirth}T12:00:00Z`)}${years !== null ? ` (${years} y)` : ''}`],
          ['Gender', labelOf(GENDERS, applicant.gender)],
          ['PIN code', applicant.pincode],
          ['Guardian', [applicant.guardianName, applicant.guardianPhone].filter(Boolean).join(' · ')],
        ] : []),
      ]} />
    </Group>

    {channel === 'school-drive' && <Group title="School drive">
      <Facts rows={[
        ['School', school.name], ['Place', [school.city, school.district, school.state].filter(Boolean).join(', ')],
        ['Class', classLabel(academics.classLevel)], ['Stream', streamLabel(academics.schoolStream)],
        ...answers.map((answer, index) => [answer.label || `Question ${index + 1}`, answerText(answer.value), answer.id || index]),
      ]} />
    </Group>}
    {channel === 'callback' && <Group title="Callback request">
      <Facts rows={[['Career field', item.careerField?.name], ['Preferred time', callback.preferredTime], ['Message', callback.message && <span className={styles.message}>{callback.message}</span>]]} />
    </Group>}
    {showProgramme && <Group title="Course and university" action={canEdit && editButton('Edit course and university', () => onEdit('programme'))}>
      <Facts rows={[
        ['Course', [preference.courseName, preference.programmeName].filter(Boolean).join(' · ')],
        ['University', preference.institutionName],
        ['Location', [preference.city, preference.state].filter(Boolean).join(', ')],
        ...(web ? [['Intake', preference.intakeYear], ['Study mode', labelOf(STUDY_MODES, preference.studyMode)],
          ['Hostel', preference.hostelRequired === true ? 'Needed' : preference.hostelRequired === false ? 'Not needed' : ''],
          ['Budget / year', preference.budgetPerYearInr !== null && preference.budgetPerYearInr !== undefined ? inr.format(preference.budgetPerYearInr) : '']] : []),
        ['Message', preference.message && <span className={styles.message}>{preference.message}</span>],
      ]} />
    </Group>}
    {web && <Group title="Academics">
      <Facts rows={[
        ['Qualification', labelOf(QUALIFICATIONS, academics.highestQualification)],
        ['Board', academics.board], ['Passing year', academics.passingYear],
        ['Result', hasScore ? `${academics.score}${academics.scoreType === 'cgpa' ? ' CGPA' : '%'}` : ''],
        ['Subjects', (academics.stream ?? []).join(', ')],
        ['Class 12', academics.class12 && `${academics.class12.board} · ${academics.class12.year} · ${academics.class12.percentage}%`],
        ['Exams', exams.length ? exams.map((exam) => [exam.name, exam.year, exam.scoreOrRank].filter(Boolean).join(' ')).join('; ') : ''],
      ]} />
    </Group>}
    <Group title="Source and consent">
      <Facts rows={[
        ['Form', formText],
        ...(channel === 'manual' ? [['Source note', source.note]] : [['Came from', source.path && <span className={styles.clip} title={source.path}>{source.path}</span>]]),
        ...utm.map(([label, value]) => [`UTM ${label.toLowerCase()}`, value]),
        ['Consent', <details key="consent" className={styles.consent}>
          <summary>{consentSummary}</summary>
          <ul>
            {consentTexts.length ? consentTexts.map(([key, text]) => <li key={key}>{text}</li>)
              : channel === 'manual' ? <li>Added by staff. Confirm the student agrees to be contacted.</li>
                : <><li>Agreed to be contacted by Gyaan Vidhya’s team.</li><li>Accepted the privacy terms.</li></>}
          </ul>
        </details>],
        ['Consent at', consent.at ? <span title={`${formatDateTime(consent.at)} · wording ${consent.version || 'unknown'}`}>{formatWhen(consent.at)}{consent.version ? <span className={styles.faint}> · v{consent.version}</span> : ''}</span> : ''],
        ...(consent.userAgent ? [['Browser', <span key="ua" className={styles.clip} title={consent.userAgent}>{consent.userAgent}</span>]] : []),
      ]} />
    </Group>
  </Panel>;
}
/** Who holds this lead. Editing needs `leads.assign`; people come from crm/meta (a mentor's team). */
export function AssignmentPanel({ item, admin, assignees, request, onSaved }) {
  const toast = useToaster();
  const canAssign = can(admin, 'leads.assign') && assignees.length > 0;
  const current = (item.assignedEmployees ?? []).filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(item.assignedEmployeeIds ?? []);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  // People already on the lead but outside the viewer's list stay visible, so saving never drops them silently.
  const extra = current.filter((person) => !assignees.some((candidate) => candidate.id === person.id));
  const everyone = [...assignees.map((person) => ({ id: person.id, name: personName(person), email: person.email })), ...extra.map((person) => ({ id: person.id, name: displayName(person.email), email: person.email, outside: true }))];
  const matching = everyone.filter((person) => !filter || `${person.name} ${person.email}`.toLowerCase().includes(filter.toLowerCase()));
  const changed = selected.length !== (item.assignedEmployeeIds ?? []).length || selected.some((id) => !(item.assignedEmployeeIds ?? []).includes(id));

  async function save() {
    setBusy(true);
    try {
      const { item: next } = await request(`/leads/${item.id}/assignments`, { method: 'PATCH', body: { employeeIds: selected } });
      onSaved(next); setSelected(next.assignedEmployeeIds); setEditing(false);
      toast.success('Assignment saved.');
    } catch (failure) { toast.error(failure.message); }
    setBusy(false);
  }

  return <Panel title="Assigned to" actions={canAssign && !editing && <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => setEditing(true)}><Icon name="userPlus" />Change</button>}>
    {editing ? <div className={styles.assignEdit}>
      {everyone.length > 6 && <input className="adm-input" type="search" value={filter} placeholder="Find a colleague" aria-label="Find a colleague" onChange={(event) => setFilter(event.target.value)} />}
      <div className={styles.assignList}>{matching.map((person) => <label key={person.id}>
        <input type="checkbox" checked={selected.includes(person.id)} onChange={(event) => setSelected((list) => (event.target.checked ? [...list, person.id] : list.filter((id) => id !== person.id)))} />
        <Avatar name={person.name} email={person.email} size={20} /><span>{person.name}{person.outside && <small> · outside your team</small>}</span>
      </label>)}</div>
      <div className={styles.inlineActions}>
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => { setEditing(false); setSelected(item.assignedEmployeeIds ?? []); }}>Cancel</button>
        <button type="button" className="adm-btn adm-btn--sm adm-btn--primary" disabled={busy || !changed} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div> : current.length ? <ul className={styles.people}>{current.map((person) => <li key={person.id} title={person.email}><Person name={displayName(person.email)} email={person.email} /></li>)}</ul>
      : <p className={styles.panelEmpty}>Unassigned</p>}
  </Panel>;
}

export function DangerZone({ item, admin, request, onDeleted, open, setOpen }) {
  const [state, setState] = useState({ busy: false, error: '' });
  if (!can(admin, 'leads.delete')) return null;
  async function remove() {
    setState({ busy: true, error: '' });
    try { await request(`/crm/leads/${item.id}`, { method: 'DELETE' }); onDeleted(); } catch (failure) { setState({ busy: false, error: failure.message }); }
  }
  // Delete lives in the header's ⋯ menu; this renders only the confirmation.
  return <>
    <ConfirmDialog open={open} tone="danger" title={`Delete ${item.applicant?.fullName || item.ref}?`} confirmLabel="Delete lead" busy={state.busy} error={state.error} onConfirm={remove} onCancel={() => { setOpen(false); setState({ busy: false, error: '' }); }}>
      {item.ref} moves to the <strong>Lead bin</strong>. Its notes and follow-ups are kept, and an owner can restore the lead from the bin.
    </ConfirmDialog>
  </>;
}

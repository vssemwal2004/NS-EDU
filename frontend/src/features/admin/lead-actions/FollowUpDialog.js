'use client';
// Schedule a new follow-up for a lead (mode "create") or move an existing one (mode "reschedule").
//   <FollowUpDialog open mode="reschedule" task={task} onClose={…} onSaved={(task) => …} />
//   <FollowUpDialog open mode="create" lead={{ id, name, phone }} onClose={…} onSaved={({ item, lead }) => …} />
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import DialogShell from './DialogShell';
import { useAdminSession } from '@/features/admin/AdminSession';
import { TASK_KINDS } from '@/features/admin/crm/meta';
import { dateTimeOf } from '@/features/admin/crm/format';
import WhenPicker, { initialWhen, whenIso } from './WhenPicker';
import styles from './LeadActions.module.css';

function Form({ mode, lead, task, onClose, onSaved }) {
  const { request } = useAdminSession();
  const [when, setWhen] = useState(() => initialWhen({ choice: mode === 'create' ? 'tomorrow' : 'in-2h' }));
  const [kind, setKind] = useState(task?.kind ?? 'call');
  const [title, setTitle] = useState('');
  const [state, setState] = useState({ busy: false, error: '', fields: {} });

  async function submit(event) {
    event.preventDefault();
    const dueAt = whenIso(when);
    if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) { setState({ busy: false, error: '', fields: { dueAt: 'Choose a date and time.' } }); return; }
    if (mode === 'create' && new Date(dueAt) <= new Date()) { setState({ busy: false, error: '', fields: { dueAt: 'Choose a time in the future.' } }); return; }
    setState({ busy: true, error: '', fields: {} });
    try {
      const result = mode === 'create'
        ? await request(`/crm/leads/${lead.id}/tasks`, { method: 'POST', body: { kind, dueAt, ...(title.trim() && { title: title.trim() }) } })
        : await request(`/crm/tasks/${task.id}`, { method: 'PATCH', body: { dueAt } });
      onSaved(result);
      onClose();
    } catch (error) { setState({ busy: false, error: error.message, fields: error.fields ?? {} }); }
  }

  const person = lead ?? { name: task?.leadName, phone: task?.leadPhone };
  return <form className={styles.form} onSubmit={submit} noValidate>
    <p className={styles.who}><strong>{person.name || 'Lead'}</strong>{person.phone && <span>{person.phone}</span>}{task && <span>{task.title} · was due {dateTimeOf(task.dueAt)}</span>}</p>
    {mode === 'create' && <>
      <fieldset className={styles.field}>
        <legend className={styles.label}>What is the follow-up</legend>
        <div className={styles.options} role="radiogroup" aria-label="Follow-up type">
          {Object.entries(TASK_KINDS).map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={kind === key} className={styles.option} onClick={() => setKind(key)}>{label}</button>)}
        </div>
      </fieldset>
      <label className={styles.field}>
        <span className={styles.label}>Title <small>optional</small></span>
        <input className={styles.input} value={title} maxLength={120} placeholder={`e.g. ${TASK_KINDS[kind]} about fees`} onChange={(event) => setTitle(event.target.value)} />
        {state.fields.title && <span className={styles.fieldError}>{state.fields.title}</span>}
      </label>
    </>}
    <WhenPicker value={when} onChange={setWhen} legend={mode === 'create' ? 'When' : 'New time'} error={state.fields.dueAt} />
    {state.error && <p className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>
      <button type="submit" className={styles.primary} disabled={state.busy}>{state.busy ? 'Saving…' : mode === 'create' ? 'Schedule follow-up' : 'Save new time'}</button>
    </div>
  </form>;
}

export default function FollowUpDialog({ open, mode = 'create', lead, task, onClose, onSaved }) {
  return <DialogShell open={open} onClose={onClose} title={mode === 'create' ? 'Schedule a follow-up' : 'Reschedule follow-up'}>
    {open && <Form mode={mode} lead={lead} task={task} onClose={onClose} onSaved={onSaved} />}
  </DialogShell>;
}

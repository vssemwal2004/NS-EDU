'use client';
// Edit a follow-up's title and due date/time (PATCH /crm/tasks/:id, leads.notes). Reschedule (presets
// only) stays in the shared FollowUpDialog; this one is for fixing the wording or setting an exact time.
//   <EditFollowUpDialog open task={task} onClose={…} onSaved={({ item }) => …} />
import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { TASK_KINDS } from '@/features/admin/crm/meta';
import { isoFromLocalInput, localInputValue } from '@/features/admin/crm/format';
import DialogShell from '@/features/admin/lead-actions/DialogShell';
import styles from '@/features/admin/lead-actions/LeadActions.module.css';

function Form({ task, onClose, onSaved }) {
  const { request } = useAdminSession();
  const id = useId();
  const [title, setTitle] = useState(task.title ?? '');
  const [due, setDue] = useState(() => (task.dueAt ? localInputValue(new Date(task.dueAt)) : localInputValue()));
  const [state, setState] = useState({ busy: false, error: '', fields: {} });

  async function submit(event) {
    event.preventDefault();
    const fields = {};
    if (!title.trim()) fields.title = 'Enter what the follow-up is about.';
    const dueAt = isoFromLocalInput(due);
    if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) fields.dueAt = 'Choose a date and time.';
    if (Object.keys(fields).length) { setState({ busy: false, error: '', fields }); return; }
    const body = {
      ...(title.trim() !== task.title && { title: title.trim() }),
      ...(new Date(dueAt).getTime() !== new Date(task.dueAt).getTime() && { dueAt }),
    };
    if (!Object.keys(body).length) { onClose(); return; }
    setState({ busy: true, error: '', fields: {} });
    try {
      const result = await request(`/crm/tasks/${task.id}`, { method: 'PATCH', body });
      onSaved(result);
      onClose();
    } catch (error) { setState({ busy: false, error: error.message, fields: error.fields ?? {} }); }
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <p className={styles.who}><strong>{task.leadName || 'Lead'}</strong>{task.leadPhone && <span>{task.leadPhone}</span>}<span>{TASK_KINDS[task.kind] ?? 'Follow-up'}</span></p>
    <label className={styles.field} htmlFor={`${id}-title`}>
      <span className={styles.label}>Title</span>
      <input id={`${id}-title`} className={styles.input} value={title} maxLength={120} autoFocus aria-invalid={state.fields.title ? 'true' : undefined} onChange={(event) => setTitle(event.target.value)} />
      {state.fields.title && <span className={styles.fieldError} role="alert">{state.fields.title}</span>}
    </label>
    <label className={styles.field} htmlFor={`${id}-due`}>
      <span className={styles.label}>Due date and time</span>
      <input id={`${id}-due`} type="datetime-local" className={styles.input} value={due} aria-invalid={state.fields.dueAt ? 'true' : undefined} onChange={(event) => setDue(event.target.value)} />
      {state.fields.dueAt && <span className={styles.fieldError} role="alert">{state.fields.dueAt}</span>}
    </label>
    {state.error && <p className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>
      <button type="submit" className={styles.primary} disabled={state.busy}>{state.busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </form>;
}

export default function EditFollowUpDialog({ open, task, onClose, onSaved }) {
  return <DialogShell open={open} onClose={onClose} icon="edit" title="Edit follow-up">
    {open && task && <Form key={task.id} task={task} onClose={onClose} onSaved={onSaved} />}
  </DialogShell>;
}

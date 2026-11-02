'use client';
// "Log call" dialog: one place to record what happened, finish the follow-up it belongs to and plan the next one.
//   <LogCallDialog open lead={{ id, name, phone }} task={task|null} onClose={…} onLogged={({ lead, taskDone, followUpAt }) => …} />
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import DialogShell from './DialogShell';
import { useAdminSession } from '@/features/admin/AdminSession';
import { ACTIVITY, OUTCOMES } from '@/features/admin/crm/meta';
import WhenPicker, { initialWhen, whenIso } from './WhenPicker';
import styles from './LeadActions.module.css';

const KINDS = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'note'];
const SOON = { 'no-answer': 'in-2h', busy: 'in-2h', 'callback-requested': 'tomorrow' };

function Form({ lead, task, onClose, onLogged }) {
  const { request } = useAdminSession();
  const [kind, setKind] = useState(ACTIVITY[task?.kind] && task.kind !== 'note' ? task.kind : 'call');
  const [outcome, setOutcome] = useState('');
  const [text, setText] = useState('');
  const [when, setWhen] = useState(() => initialWhen({ allowNone: true }));
  const [touched, setTouched] = useState(false);
  const [markDone, setMarkDone] = useState(true);
  const [state, setState] = useState({ busy: false, error: '', fields: {} });

  const chooseOutcome = (value) => {
    const next = outcome === value ? '' : value;
    setOutcome(next);
    if (!touched && SOON[next]) setWhen((current) => ({ ...current, choice: SOON[next] }));
  };

  async function submit(event) {
    event.preventDefault();
    const followUpAt = whenIso(when);
    const fields = {};
    if (kind === 'note' && !text.trim() && !outcome) fields.text = 'Write a short note.';
    if (when.choice !== 'none' && (!followUpAt || new Date(followUpAt) <= new Date())) fields.followUpAt = 'Choose a time in the future.';
    if (Object.keys(fields).length) { setState({ busy: false, error: '', fields }); return; }
    setState({ busy: true, error: '', fields: {} });
    let logged;
    try {
      logged = await request(`/crm/leads/${lead.id}/activities`, { method: 'POST', body: {
        kind, ...(outcome && kind !== 'note' && { outcome }), ...(text.trim() && { text: text.trim() }),
        ...(followUpAt && { followUpAt, followUpTitle: `Follow up: ${ACTIVITY[kind].label.toLowerCase()} ${lead.name}`.slice(0, 120) }),
      } });
    } catch (error) { setState({ busy: false, error: error.message, fields: error.fields ?? {} }); return; }
    let taskDone = false;
    let warning = '';
    if (task && markDone) {
      try { await request(`/crm/tasks/${task.id}`, { method: 'PATCH', body: { done: true } }); taskDone = true; } catch (error) { warning = `The ${ACTIVITY[kind].label.toLowerCase()} was saved, but the follow-up could not be marked done: ${error.message}`; }
    }
    onLogged({ lead: logged.lead, taskDone, followUpAt, warning });
    onClose();
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <p className={styles.who}><strong>{lead.name || 'Lead'}</strong>{lead.phone && <span>{lead.phone}</span>}{task && <span>Follow-up: {task.title}</span>}</p>
    <fieldset className={styles.field}>
      <legend className={styles.label}>What happened</legend>
      <div className={styles.options} role="radiogroup" aria-label="Type of contact">
        {KINDS.map((key) => <button key={key} type="button" role="radio" aria-checked={kind === key} className={`crm-tone ${styles.option}`} data-tone={ACTIVITY[key].tone} onClick={() => setKind(key)}><Icon name={ACTIVITY[key].icon} />{ACTIVITY[key].label}</button>)}
      </div>
    </fieldset>
    {kind !== 'note' && <fieldset className={styles.field}>
      <legend className={styles.label}>Outcome <small>optional</small></legend>
      <div className={styles.options} role="group" aria-label="Outcome">
        {Object.entries(OUTCOMES).map(([key, item]) => <button key={key} type="button" role="checkbox" aria-checked={outcome === key} className={`crm-tone ${styles.option}`} data-tone={item.tone} onClick={() => chooseOutcome(key)}>{item.label}</button>)}
      </div>
    </fieldset>}
    <label className={styles.field}>
      <span className={styles.label}>Note {kind !== 'note' && <small>optional</small>}</span>
      <textarea className={styles.textarea} value={text} maxLength={2000} placeholder="What did they say? Course interest, budget, documents, next step…" aria-invalid={state.fields.text ? 'true' : undefined} onChange={(event) => setText(event.target.value)} />
      {state.fields.text && <span className={styles.fieldError} role="alert">{state.fields.text}</span>}
    </label>
    <div onClickCapture={() => setTouched(true)}>
      <WhenPicker value={when} onChange={setWhen} allowNone legend="Plan the next follow-up" error={state.fields.followUpAt} />
    </div>
    {task && <label className={styles.check}><input type="checkbox" checked={markDone} onChange={(event) => setMarkDone(event.target.checked)} />Mark “{task.title}” as done</label>}
    {state.error && <p className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
    <div className={styles.actions}>
      <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>
      <button type="submit" className={styles.primary} disabled={state.busy}>{state.busy ? 'Saving…' : kind === 'note' ? 'Save note' : 'Save log'}</button>
    </div>
  </form>;
}

export default function LogCallDialog({ open, lead, task = null, onClose, onLogged }) {
  return <DialogShell open={open} onClose={onClose} title="Log a call">
    {open && lead && <Form lead={lead} task={task} onClose={onClose} onLogged={onLogged} />}
  </DialogShell>;
}

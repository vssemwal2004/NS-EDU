'use client';
// Lead 360 activity: the "Log activity" composer, the timeline, the follow-ups panel and the "Schedule follow-up" drawer.
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { ACTIVITY, OPEN_STAGES, OUTCOMES, STAGES, TASK_KINDS, can } from '@/features/admin/crm/meta';
import { dateTimeOf, displayName, followUpPresets, isoFromLocalInput, localInputValue, relativeTime } from '@/features/admin/crm/format';
import { useToaster } from '@/features/admin/crm/toast';
import { Panel } from '@/features/admin/ui/Page';
import { FollowUpText, formatWhen } from './lead-bits';
import styles from './LeadPanel.module.css';

const KINDS = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'note'];
const MAX_TEXT = 2000;

/** Open follow-ups, derived from the timeline: a created task (id "t<taskId>") without a matching done entry ("d<taskId>"). */
export function openTasks(items) {
  const done = new Set(items.filter((entry) => entry.type === 'task-done').map((entry) => entry.id.slice(1)));
  return items.filter((entry) => entry.type === 'task-created' && !done.has(entry.id.slice(1)))
    .map((entry) => ({ id: entry.id.slice(1), title: entry.title, kind: entry.kind, dueAt: entry.dueAt, by: entry.by }))
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

/** Preset buttons plus a custom date; value is a datetime-local string. */
function WhenPicker({ value, onChange, idPrefix }) {
  const presets = followUpPresets();
  return <div className={styles.when}>
    <div className={styles.presets} role="group" aria-label="Quick times">
      {presets.map((preset) => <button key={preset.key} type="button" className="adm-btn adm-btn--sm" aria-pressed={value === localInputValue(preset.date)} onClick={() => onChange(localInputValue(preset.date))}>{preset.label}</button>)}
    </div>
    <label htmlFor={`${idPrefix}-when`} className="sr-only">Date and time</label>
    <input id={`${idPrefix}-when`} className="adm-input" type="datetime-local" value={value} min={localInputValue(new Date())} onChange={(event) => onChange(event.target.value)} />
  </div>;
}

/** Log a call, WhatsApp, email, meeting, visit or note; optionally book the next follow-up in the same step. */
export function Composer({ item, request, onSaved, textRef }) {
  const toast = useToaster();
  const [kind, setKind] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [text, setText] = useState('');
  const [follow, setFollow] = useState(false);
  const [when, setWhen] = useState(() => localInputValue(followUpPresets()[1].date));
  const [state, setState] = useState({ busy: false, error: '', fields: {} });
  const contact = kind !== 'note';
  const open = OPEN_STAGES.includes(item.status);

  async function submit(event) {
    event.preventDefault();
    if (state.busy) return;
    if (!contact && !text.trim()) { setState({ busy: false, error: '', fields: { text: 'Write the note first.' } }); return; }
    setState({ busy: true, error: '', fields: {} });
    try {
      const body = { kind, ...(contact && outcome && { outcome }), text: text.trim(), ...(follow && when && { followUpAt: isoFromLocalInput(when) }) };
      const { lead } = await request(`/crm/leads/${item.id}/activities`, { method: 'POST', body });
      const moved = lead.status !== item.status ? ` Moved to ${STAGES[lead.status]?.label ?? lead.status} automatically.` : '';
      setText(''); setOutcome(''); setFollow(false);
      setState({ busy: false, error: '', fields: {} });
      toast.success(`${ACTIVITY[kind].label} logged${follow ? ' and follow-up booked' : ''}.${moved}`);
      onSaved(lead);
    } catch (failure) {
      setState({ busy: false, error: failure.fields ? '' : failure.message, fields: failure.fields ?? {} });
    }
  }

  return <Panel title="Log activity" className={styles.composerPanel}>
    <form id="log" className={styles.composer} onSubmit={submit} noValidate>
      <div className={styles.composerTop}>
        <div className={styles.kinds} role="radiogroup" aria-label="Activity type">
          {KINDS.map((key) => <button key={key} type="button" role="radio" aria-checked={kind === key} onClick={() => setKind(key)}>
            <Icon name={ACTIVITY[key].icon} />{ACTIVITY[key].label}
          </button>)}
        </div>
        {contact && <label className={styles.outcome}><span className="sr-only">Outcome</span>
          <select className="adm-select" value={outcome} onChange={(event) => setOutcome(event.target.value)} aria-invalid={state.fields.outcome ? 'true' : undefined}>
            <option value="">Outcome: not recorded</option>
            {Object.entries(OUTCOMES).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
          </select>
        </label>}
      </div>
      <label className="sr-only" htmlFor="lead-composer">{contact ? 'What was discussed' : 'Note'}</label>
      <textarea ref={textRef} id="lead-composer" className="adm-textarea" rows={3} maxLength={MAX_TEXT} value={text} aria-invalid={state.fields.text ? 'true' : undefined} aria-describedby="lead-composer-help"
        placeholder={contact ? 'What you discussed and the next step (optional)' : 'Write the note (required)'} onChange={(event) => setText(event.target.value)} />
      {(state.fields.text || state.fields.outcome) && <span className="adm-error" role="alert">{state.fields.text || state.fields.outcome}</span>}
      {follow && <WhenPicker value={when} onChange={setWhen} idPrefix="log" />}
      {state.fields.followUpAt && <span className="adm-error" role="alert">{state.fields.followUpAt}</span>}
      {state.error && <p className="adm-error" role="alert">{state.error}</p>}
      <div className={styles.composerFoot}>
        <label className={styles.check} title={open ? undefined : 'Closed leads have no follow-ups'}>
          <input type="checkbox" checked={follow} disabled={!open} onChange={(event) => setFollow(event.target.checked)} />Book the next follow-up
        </label>
        <span className={styles.counter} id="lead-composer-help">{text.length}/{MAX_TEXT}</span>
        <button type="submit" className="adm-btn" disabled={state.busy}><Icon name="check" />{state.busy ? 'Saving…' : `Save ${ACTIVITY[kind].label.toLowerCase()}`}</button>
      </div>
    </form>
  </Panel>;
}

/** Schedule a standalone follow-up (POST /crm/leads/:id/tasks). */
export function ScheduleDialog({ open, onClose, item, request, onSaved }) {
  return <AdminDrawer open={open} onClose={onClose} title="Schedule a follow-up" subtitle={item.applicant?.fullName}>
    {open && <ScheduleForm item={item} request={request} onClose={onClose} onSaved={onSaved} />}
  </AdminDrawer>;
}
function ScheduleForm({ item, request, onClose, onSaved }) {
  const toast = useToaster();
  const [kind, setKind] = useState('call');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => localInputValue(followUpPresets()[1].date));
  const [state, setState] = useState({ busy: false, error: '' });
  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const { lead } = await request(`/crm/leads/${item.id}/tasks`, { method: 'POST', body: { kind, title: title.trim(), dueAt: isoFromLocalInput(when) } });
      toast.success('Follow-up scheduled.');
      onSaved(lead);
      onClose();
    } catch (failure) { setState({ busy: false, error: failure.fields?.dueAt ?? failure.message }); }
  }
  return <form className={styles.drawerForm} onSubmit={submit}>
    <label className="adm-label">What to do
      <select className="adm-select" value={kind} onChange={(event) => setKind(event.target.value)}>{Object.entries(TASK_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="adm-label">Title <span className="adm-hint">Optional</span>
      <input className="adm-input" value={title} maxLength={120} placeholder={`${TASK_KINDS[kind]} ${item.applicant?.fullName ?? ''}`.trim()} onChange={(event) => setTitle(event.target.value)} /></label>
    <div className="adm-label">When<WhenPicker value={when} onChange={setWhen} idPrefix="sched" /></div>
    {state.error && <p className="adm-error" role="alert">{state.error}</p>}
    <div className={styles.drawerActions}>
      <button type="button" className="adm-btn" onClick={onClose}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy || !when}>{state.busy ? 'Saving…' : 'Schedule'}</button>
    </div>
  </form>;
}

/** Open follow-ups for this lead, with Done and Reschedule (PATCH /crm/tasks/:id). */
export function FollowUps({ item, timeline, admin, request, onChanged, onSchedule }) {
  const toast = useToaster();
  const [busy, setBusy] = useState('');
  const canEdit = can(admin, 'leads.notes');
  const tasks = openTasks(timeline.items);
  const open = OPEN_STAGES.includes(item.status);

  async function patch(task, body, message, undo) {
    setBusy(task.id);
    try {
      await request(`/crm/tasks/${task.id}`, { method: 'PATCH', body });
      toast.success(message, undo ? { action: { label: 'Undo', onClick: () => request(`/crm/tasks/${task.id}`, { method: 'PATCH', body: undo }).then(onChanged, (failure) => toast.error(failure.message)) } } : undefined);
      await onChanged();
    } catch (failure) { toast.error(failure.message); }
    setBusy('');
  }

  return <Panel title="Follow-ups" meta={tasks.length ? `${tasks.length} open` : undefined} flush
    actions={canEdit && open ? <button type="button" className="adm-btn adm-btn--sm" onClick={onSchedule}><Icon name="plus" />Schedule</button> : null}>
    <div id="follow-up" className={styles.listBody}>
      {!timeline.loaded ? <div className={styles.lineSkeleton} aria-busy="true"><span /><span /></div>
        : tasks.length ? <ul className={styles.tasks}>
          {tasks.map((task) => <li key={task.id}>
            <div className={styles.taskMain}>
              <strong title={task.title}>{task.title}</strong>
              <span><FollowUpText at={task.dueAt} /><small>{TASK_KINDS[task.kind] ?? task.kind}</small></span>
            </div>
            {canEdit && <div className={styles.taskActions}>
              <button type="button" className="adm-btn adm-btn--sm" disabled={busy === task.id} onClick={() => patch(task, { done: true }, 'Follow-up marked done.', { done: false })}><Icon name="check" />Done</button>
              <label className="sr-only" htmlFor={`resched-${task.id}`}>Reschedule {task.title}</label>
              <select id={`resched-${task.id}`} className="adm-select" value="" disabled={busy === task.id} onChange={(event) => {
                const preset = followUpPresets().find((entry) => entry.key === event.target.value);
                if (preset) patch(task, { dueAt: preset.date.toISOString() }, `Follow-up moved to ${dateTimeOf(preset.date)}.`, { dueAt: task.dueAt });
              }}>
                <option value="">Move to…</option>
                {followUpPresets().map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
              </select>
            </div>}
          </li>)}
        </ul> : <p className={styles.emptyLine}>{open ? 'None booked' : 'Closed leads have no follow-ups'}</p>}
    </div>
  </Panel>;
}

function describe(entry) {
  if (entry.type === 'activity' || entry.type === 'note') {
    const config = ACTIVITY[entry.kind] ?? ACTIVITY.note;
    return { icon: config.icon, title: config.label === 'Note' ? 'Note' : `${config.label} logged`, text: entry.text, outcome: entry.outcome };
  }
  if (entry.type === 'status') return { icon: 'flag', title: entry.id === 's0' ? `Lead received as ${entry.statusLabel}` : `Moved to ${entry.statusLabel}`, text: '' };
  if (entry.type === 'task-created') return { icon: 'calendar', title: `Follow-up scheduled: ${entry.title}`, text: entry.dueAt ? `Due ${formatWhen(entry.dueAt)}` : '' };
  if (entry.type === 'task-done') return { icon: 'checkCircle', title: `Follow-up done: ${entry.title}`, text: '' };
  return { icon: 'history', title: entry.type, text: entry.text ?? '' };
}

export function Timeline({ timeline, onRetry }) {
  const [shown, setShown] = useState(20);
  const items = timeline.items;
  return <Panel title="Timeline" meta={timeline.loaded && items.length ? `${items.length} ${items.length === 1 ? 'entry' : 'entries'}` : undefined} flush>
    <div className={styles.listBody}>
      {timeline.error ? <div className={styles.inlineError} role="alert"><span>{timeline.error}</span><button type="button" className="adm-btn adm-btn--sm" onClick={onRetry}>Retry</button></div>
        : !timeline.loaded ? <div className={styles.lineSkeleton} aria-busy="true"><span /><span /><span /></div>
          : !items.length ? <p className={styles.emptyLine}>Nothing logged yet</p>
            : <>
              <ol className={styles.timeline}>
                {items.slice(0, shown).map((entry) => {
                  const view = describe(entry);
                  const outcome = OUTCOMES[view.outcome];
                  const who = entry.by ? displayName(entry.by) : 'System';
                  return <li key={`${entry.type}-${entry.id}`}>
                    <span className={styles.node} data-kind={entry.type}><Icon name={view.icon} /></span>
                    <div className={styles.tlBody}>
                      <p className={styles.tlHead}>
                        <span className={styles.tlTitle}><strong>{view.title}</strong>{outcome && <span className={styles.outcomeTag}>· {outcome.label}</span>}</span>
                        <span className={styles.tlMeta}><span className={styles.tlWho} title={entry.by || 'Recorded automatically'}>{who}</span><span aria-hidden="true">·</span>
                          <time dateTime={new Date(entry.at).toISOString()} title={dateTimeOf(entry.at)}>{relativeTime(entry.at)}</time></span>
                      </p>
                      {view.text && <p className={styles.tlText}>{view.text}</p>}
                    </div>
                  </li>;
                })}
              </ol>
              {items.length > shown && <button type="button" className={`adm-btn adm-btn--sm adm-btn--ghost ${styles.more}`} onClick={() => setShown((current) => current + 25)}>Show {Math.min(25, items.length - shown)} more</button>}
            </>}
    </div>
  </Panel>;
}
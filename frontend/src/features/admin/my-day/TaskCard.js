'use client';
// One follow-up on My day, as a compact row: tick, what and who, when, quick actions and the "⋮" menu.
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { FollowUpText, formatWhen, Person } from '@/features/admin/leads/lead-bits';
import RowMenu from '@/features/admin/crm/RowMenu';
import { TASK_KINDS } from '@/features/admin/crm/meta';
import { dateTimeOf, displayName, timeOf } from '@/features/admin/crm/format';
import { telHref, whatsappHref } from '@/features/admin/lead-actions/contact';
import styles from './MyDay.module.css';

const KIND_ICON = { call: 'phone', whatsapp: 'chat', email: 'mail', meeting: 'people', visit: 'building', document: 'document', other: 'note' };

export default function TaskCard({ task, section, now, people, teamMode, canEdit, onDone, onUndo, onLog, onReschedule, onDelete }) {
  const done = section === 'done' || Boolean(task.doneAt);
  const completing = Boolean(task._hold) && Boolean(task.doneAt);
  const person = people.get(task.assigneeId);
  const who = person?.name || (task.assigneeEmail && !/^demo$/i.test(task.assigneeEmail) ? displayName(task.assigneeEmail) : 'Teammate');
  const leadHref = `/admin/leads/${task.leadId}`;
  const kind = TASK_KINDS[task.kind] ?? 'Follow-up';
  const items = [
    { key: 'done', label: done ? 'Mark as not done' : 'Mark done', icon: done ? 'undo' : 'checkCircle', hidden: !canEdit, onSelect: () => (done ? onUndo(task) : onDone(task)) },
    { key: 'reschedule', label: 'Reschedule', icon: 'calendar', hidden: !canEdit || done, onSelect: () => onReschedule(task) },
    { key: 'log', label: 'Log call', icon: 'note', hidden: !canEdit, onSelect: () => onLog(task) },
    { divider: true },
    { key: 'call', label: 'Call', icon: 'phone', hint: task.leadPhone, hidden: !task.leadPhone, onSelect: () => { window.location.href = telHref(task.leadPhone); } },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', hidden: !task.leadPhone, onSelect: () => window.open(whatsappHref(task.leadPhone), '_blank', 'noopener,noreferrer') },
    { key: 'open', label: 'Open lead', icon: 'eye', href: leadHref },
    { divider: true, hidden: !canEdit },
    { key: 'delete', label: 'Delete follow-up…', icon: 'trash', tone: 'danger', hidden: !canEdit, onSelect: () => onDelete(task) },
  ];

  return <article className={styles.task} data-done={done || undefined} data-completing={completing || undefined}>
    {canEdit ? <button type="button" className={styles.tick} aria-label={done ? `Mark not done: ${task.title}` : `Mark done: ${task.title}`} aria-pressed={done} disabled={completing} onClick={() => (done ? onUndo(task) : onDone(task))}>
      <Icon name="check" />
    </button> : <span className={styles.kindIcon} title={kind}><Icon name={KIND_ICON[task.kind] ?? 'note'} /></span>}
    <div className={styles.taskBody}>
      <p className={styles.taskTitle} title={`${kind}: ${task.title}`}>{task.title}</p>
      <p className={styles.taskLead}>
        <Link href={leadHref} className={styles.leadName}>{task.leadName || 'Lead'}</Link>
        {task.leadPhone && <a className={styles.phone} href={telHref(task.leadPhone)}>{task.leadPhone}</a>}
        {task.leadRef && <span className={styles.ref}>{task.leadRef}</span>}
      </p>
    </div>
    <div className={styles.when}>
      {done ? <span className={styles.doneAt}><Icon name="check" />Done {timeOf(task.doneAt)}</span> : <FollowUpText at={task.dueAt} />}
      {(done || new Date(task.dueAt) < (now ?? new Date())) && <small title={`Was due ${dateTimeOf(task.dueAt)}`}>{formatWhen(task.dueAt)}</small>}
    </div>
    {teamMode && <span className={styles.assignee}><Person name={who} email={person?.email || task.assigneeEmail} title={`Assigned to ${who}`} /></span>}
    <div className={styles.actions}>
      {!done && task.leadPhone && <a className="adm-btn adm-btn--sm adm-btn--icon" href={telHref(task.leadPhone)} aria-label={`Call ${task.leadName}`} title="Call"><Icon name="phone" /></a>}
      {!done && canEdit && <button type="button" className="adm-btn adm-btn--sm" onClick={() => onLog(task)}><Icon name="note" />Log call</button>}
      {done && canEdit && !completing && <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => onUndo(task)}><Icon name="undo" />Undo</button>}
      <RowMenu label={`Actions for ${task.title}`} items={items} />
    </div>
  </article>;
}

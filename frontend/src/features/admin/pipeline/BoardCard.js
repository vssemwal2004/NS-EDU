'use client';
// One lead on the pipeline board: a compact card (name + priority flag, course, then temperature · follow-up · owner)
// with the "⋮" menu as the keyboard and touch alternative to dragging.
import { memo } from 'react';
import Link from 'next/link';
import { Avatar, HeatChip } from '@/features/admin/crm/ui';
import { FollowUpText, PriorityText } from '@/features/admin/leads/lead-bits';
import RowMenu from '@/features/admin/crm/RowMenu';
import { CHANNELS, HEATS, HEAT_ORDER, STAGES, STAGE_ORDER } from '@/features/admin/crm/meta';
import { followUpState, relativeTime } from '@/features/admin/crm/format';
import { telHref, whatsappHref } from '@/features/admin/lead-actions/contact';
import styles from './Pipeline.module.css';

const courseLine = (lead) => [lead.preference?.courseName, lead.preference?.institutionName].filter(Boolean).join(' · ')
  || lead.school?.name || [lead.applicant?.city, lead.applicant?.state].filter(Boolean).join(', ');

function BoardCard({ lead, closed, perms, people, dragging, moved, onDragStart, onDragEnd, act }) {
  const { applicant = {}, crm = {} } = lead;
  const name = applicant.fullName || 'Unnamed lead';
  const overdue = !closed && followUpState(crm.nextFollowUpAt).state === 'overdue';
  const draggable = perms.move;
  const owner = people.get((lead.assignedEmployeeIds ?? [])[0]);
  const extraOwners = Math.max(0, (lead.assignedEmployeeIds ?? []).length - 1);
  const line = courseLine(lead) || applicant.phone || '';
  const info = [`${name} · ${lead.ref ?? ''}`, applicant.phone, `${CHANNELS[lead.channel || 'web-apply']?.label ?? ''} · added ${relativeTime(lead.createdAt)}`].filter(Boolean).join('\n');

  const items = [
    { key: 'open', label: 'Open lead', icon: 'eye', href: `/admin/leads/${lead.id}` },
    { divider: true },
    { key: 'call', label: 'Call', icon: 'phone', hint: applicant.phone, hidden: !applicant.phone, onSelect: () => { window.location.href = telHref(applicant.phone); } },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', hidden: !applicant.phone, onSelect: () => window.open(whatsappHref(applicant.phone), '_blank', 'noopener,noreferrer') },
    { key: 'log', label: 'Log call', icon: 'note', hidden: !perms.notes, onSelect: () => act.log(lead) },
    { key: 'follow', label: 'Schedule follow-up', icon: 'calendar', hidden: !perms.notes || closed, onSelect: () => act.follow(lead) },
    { divider: true, hidden: !perms.move },
    { heading: 'Move to', hidden: !perms.move },
    ...(perms.move ? STAGE_ORDER.map((status) => ({ key: `move-${status}`, label: STAGES[status].label, icon: STAGES[status].icon, disabled: status === lead.status, hint: status === lead.status ? 'Current' : undefined, reason: 'It is already in this stage', onSelect: () => act.move(lead, status) })) : []),
    { divider: true, hidden: !perms.heat },
    { heading: 'Temperature', hidden: !perms.heat },
    ...(perms.heat ? [...HEAT_ORDER.map((heat) => ({ key: `heat-${heat}`, label: HEATS[heat].label, icon: HEATS[heat].icon, disabled: crm.heat === heat && crm.heatSource === 'manual', hint: crm.heat === heat ? (crm.heatSource === 'manual' ? 'Current' : 'Auto') : undefined, reason: 'Already set by hand', onSelect: () => act.heat(lead, heat) })),
      { key: 'heat-auto', label: 'Let the score decide', icon: 'refresh', disabled: crm.heatSource !== 'manual', reason: 'Already automatic', onSelect: () => act.heat(lead, 'auto') }] : []),
    { divider: true },
    { key: 'copy', label: 'Copy phone number', icon: 'copy', hidden: !applicant.phone, onSelect: () => act.copy(applicant.phone) },
    { divider: true, hidden: !perms.remove },
    { key: 'delete', label: 'Delete lead…', icon: 'trash', tone: 'danger', hidden: !perms.remove, onSelect: () => act.remove(lead) },
  ];

  return <article className={styles.card} data-overdue={overdue || undefined} data-draggable={draggable || undefined} data-dragging={dragging || undefined} data-moved={moved || undefined}
    draggable={draggable} onDragStart={draggable ? (event) => onDragStart(event, lead) : undefined} onDragEnd={draggable ? onDragEnd : undefined}>
    <div className={styles.cardTop}>
      <h3 className={styles.name}><Link href={`/admin/leads/${lead.id}`} draggable={false} title={info}>{name}</Link></h3>
      <PriorityText priority={crm.priority} dash={false} />
      <span className={styles.menuWrap}><RowMenu label={`Actions for ${name}`} items={items} /></span>
    </div>
    {line && <p className={styles.line} title={line}>{line}</p>}
    <div className={styles.cardFoot}>
      <span className={styles.chips}>
        {crm.heat && <HeatChip heat={crm.heat} source={crm.heatSource} score={crm.score} size="sm" />}
        {!closed && crm.nextFollowUpAt && <FollowUpText at={crm.nextFollowUpAt} />}
      </span>
      {owner ? <span className={styles.owner} title={`Assigned to ${owner.name || owner.email}${extraOwners ? ` and ${extraOwners} more` : ''}`}><Avatar name={owner.name} email={owner.email} size={20} />{extraOwners > 0 && <small>+{extraOwners}</small>}</span>
        : <span className={styles.nobody} role="img" aria-label={(lead.assignedEmployeeIds ?? []).length ? 'Assigned' : 'Unassigned'} title={(lead.assignedEmployeeIds ?? []).length ? 'Assigned' : 'Unassigned'} />}
    </div>
  </article>;
}

export default memo(BoardCard);

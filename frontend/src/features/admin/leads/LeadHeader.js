'use client';
// Lead 360 header (identity, contact actions, the stage stepper) and the temperature / priority / tags panel.
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import RowMenu from '@/features/admin/crm/RowMenu';
import { Chip, HeatChip } from '@/features/admin/crm/ui';
import { CHANNELS, can, HEAT_ORDER, HEATS, OPEN_STAGES, PRIORITIES, PRIORITY_ORDER, STAGES } from '@/features/admin/crm/meta';
import { useToaster } from '@/features/admin/crm/toast';
import { Panel } from '@/features/admin/ui/Page';
import { channelOf, courseText, formatDateTime, isQuick, whatsAppLink } from './lead-format';
import { FollowUpText, formatWhen, PriorityText, StageDot } from './lead-bits';
import styles from './LeadPanel.module.css';

const PIPELINE = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted'];
const EXITS = ['not-interested', 'closed'];

function Stepper({ status, canChange, busy, onPick }) {
  const at = PIPELINE.indexOf(status);
  const closed = EXITS.includes(status);
  return <nav className={styles.stepper} aria-label="Pipeline stage">
    <ol className={styles.steps}>
      {PIPELINE.map((key, index) => {
        const state = key === status ? 'current' : at > index ? 'past' : 'next';
        return <li key={key} data-state={state} data-closed={closed || undefined}>
          <button type="button" disabled={!canChange || busy || key === status} aria-current={key === status ? 'step' : undefined}
            title={canChange ? (key === status ? 'Current stage' : `Move to ${STAGES[key].label}`) : 'You can view the stage but not change it'} onClick={() => onPick(key)}>
            {state === 'past' && <Icon name="check" />}<span>{STAGES[key].label}</span>
          </button>
        </li>;
      })}
    </ol>
    <div className={styles.exits} role="group" aria-label="Close this lead">
      {EXITS.map((key) => <button key={key} type="button" className="adm-btn adm-btn--sm adm-btn--ghost" aria-pressed={key === status} data-current={key === status || undefined} disabled={!canChange || busy || key === status}
        onClick={() => onPick(key)} title={canChange ? `Mark as ${STAGES[key].label.toLowerCase()}` : 'You can view the stage but not change it'}>
        <Icon name={STAGES[key].icon} />{STAGES[key].label}
      </button>)}
    </div>
  </nav>;
}

/**
 * Header panel. `onStage(status, lostReason)` performs a stage change; `onLog`, `onSchedule`, `onEdit`, `onDelete`
 * open the composer and the dialogs; `backHref` is the list with the filters the person came from.
 */
export default function LeadHeader({ item, backHref, onBack, admin, busy, onStage, onLog, onSchedule, onEdit, onDelete, onCopy }) {
  const [closing, setClosing] = useState(null);
  const [reason, setReason] = useState('');
  const [closeError, setCloseError] = useState('');
  const applicant = item.applicant ?? {};
  const preference = item.preference ?? {};
  const school = item.school ?? {};
  const crm = item.crm ?? {};
  const channel = channelOf(item);
  const course = courseText(preference);
  const phone = applicant.phone;
  const wa = whatsAppLink(phone);
  const canStage = can(admin, 'leads.change_status');
  const canNotes = can(admin, 'leads.notes');
  const open = OPEN_STAGES.includes(item.status);
  const place = [applicant.city, applicant.state].filter(Boolean).join(', ');
  const about = channel === 'school-drive' ? [school.name, [school.district, school.state].filter(Boolean).join(', ')]
    : channel === 'callback' ? [item.careerField?.name ? `Callback about ${item.careerField.name}` : 'Callback request']
      : [course === 'Not specified' ? '' : course, preference.institutionName];
  const stage = STAGES[item.status] ?? { label: item.status, tone: 'neutral' };

  function pick(status) {
    if (status === item.status) return;
    if (EXITS.includes(status)) { setClosing(status); setReason(crm.lostReason ?? ''); setCloseError(''); return; }
    onStage(status);
  }
  async function confirmClose() {
    setCloseError('');
    const failure = await onStage(closing, reason.trim());
    if (failure) setCloseError(failure); else setClosing(null);
  }

  const more = [
    { key: 'log', label: 'Log activity', icon: 'note', hidden: !canNotes, onSelect: onLog },
    { key: 'follow', label: 'Schedule follow-up', icon: 'calendar', hidden: !canNotes, disabled: !open, reason: 'Closed leads have no follow-ups', onSelect: onSchedule },
    { key: 'edit', label: 'Edit details', icon: 'edit', hidden: !can(admin, 'leads.edit'), onSelect: onEdit },
    { key: 'copy', label: 'Copy phone number', icon: 'copy', disabled: !phone, reason: 'This lead has no mobile number', onSelect: () => onCopy(phone) },
    { divider: true },
    { key: 'delete', label: 'Delete lead…', icon: 'trash', tone: 'danger', hidden: !can(admin, 'leads.delete'), onSelect: onDelete },
  ];

  return <header className={`adm-panel ${styles.head}`}>
    <Link className={styles.backLink} href={backHref} onClick={onBack}><Icon name="arrow" />All leads</Link>
    <div className={styles.headTop}>
      <div className={styles.who}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{applicant.fullName || 'Name not provided'}</h2>
          <StageDot label={stage.label} tone={stage.tone} />
          <HeatChip heat={crm.heat} source={crm.heatSource} score={crm.score} size="sm" />
          <PriorityText priority={crm.priority} dash={false} />
        </div>
        <p className={styles.meta}>
          <span className="crm-tabnum">{item.ref}</span>
          <span>{CHANNELS[channel]?.label ?? channel}{isQuick(item) ? ' (quick apply)' : ''}</span>
          {about[0] && <span title={about.filter(Boolean).join(' · ')}>{about[0]}</span>}
          {place && <span title={place}>{place}</span>}
          <span title={formatDateTime(item.createdAt)}>Received {formatWhen(item.createdAt)}</span>
          {open && crm.nextFollowUpAt && <span className={styles.metaFollow}>Next follow-up <FollowUpText at={crm.nextFollowUpAt} /></span>}
          {!open && crm.lostReason && <span title={crm.lostReason}>Reason: {crm.lostReason}</span>}
        </p>
      </div>
      <div className={styles.actions}>
        {phone ? <a className="adm-btn adm-btn--primary" href={`tel:${phone}`} title={`Call ${phone}`}><Icon name="phone" />Call</a>
          : <span className="adm-btn" aria-disabled="true" title="This lead has no mobile number"><Icon name="phone" />No mobile</span>}
        {wa && <a className="adm-btn" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp"><Icon name="chat" /><span className={styles.hideNarrow}>WhatsApp</span></a>}
        {applicant.email && <a className="adm-btn" href={`mailto:${applicant.email}?subject=${encodeURIComponent(`Your Gyaan Vidhya enquiry ${item.ref}`)}`} aria-label="Email" title={applicant.email}><Icon name="mail" /><span className={styles.hideNarrow}>Email</span></a>}
        {canNotes && <button type="button" className="adm-btn" onClick={onSchedule} disabled={!open} aria-label="Schedule a follow-up" title={open ? 'Schedule a follow-up' : 'Closed leads have no follow-ups'}><Icon name="calendar" /><span className={styles.hideNarrow}>Follow-up</span></button>}
        <RowMenu label="More actions for this lead" items={more} className={styles.moreButton} />
      </div>
    </div>
    <Stepper status={item.status} canChange={canStage} busy={busy === 'stage'} onPick={pick} />

    <ConfirmDialog open={Boolean(closing)} tone="danger" icon="lock" title={`Mark this lead as ${closing ? STAGES[closing].label.toLowerCase() : ''}?`}
      confirmLabel={closing ? `Mark ${STAGES[closing].label.toLowerCase()}` : 'Confirm'} busy={busy === 'stage'} error={closeError}
      onConfirm={confirmClose} onCancel={() => setClosing(null)}>
      <p>Closed leads leave the follow-up lists and are no longer scored. You can move the lead back to an open stage later.</p>
      {can(admin, 'crm.heat') && <label className={`adm-label ${styles.reason}`}>Reason (optional)
        <input className="adm-input" value={reason} maxLength={160} placeholder="e.g. Chose another college" onChange={(event) => setReason(event.target.value)} />
      </label>}
    </ConfirmDialog>
  </header>;
}

function Segmented({ label, value, options, onChange, disabled }) {
  return <div className={styles.segmented} role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>
      {option.icon && <Icon name={option.icon} />}{option.label}
    </button>)}
  </div>;
}

/** Temperature, priority and tags. `save(patch, message)` does the PATCH /crm/leads/:id and resolves to an error message or ''. */
export function ScoringPanel({ item, admin, busy, save }) {
  const toast = useToaster();
  const [tag, setTag] = useState('');
  const crm = item.crm ?? {};
  const canHeat = can(admin, 'crm.heat');
  const auto = (crm.heatSource ?? 'auto') === 'auto';
  const tags = crm.tags ?? [];
  const reasons = crm.reasons ?? [];
  const heatName = HEATS[crm.heat]?.label;

  async function addTag(event) {
    event.preventDefault();
    const next = tag.trim().toLowerCase().replace(/[^a-z0-9 -]+/g, '').replace(/\s+/g, '-').slice(0, 24);
    if (!next) return;
    if (tags.includes(next)) { setTag(''); return; }
    if (tags.length >= 8) { toast.error('A lead can have at most 8 tags. Remove one first.'); return; }
    if (!await save({ tags: [...tags, next] }, `Tag “${next}” added.`)) setTag('');
  }

  return <Panel title="Qualification" description={canHeat ? undefined : 'Your role can view these but not change them.'}>
    <dl className={`${styles.facts} ${styles.controls}`}>
      <div>
        <dt>Temperature</dt>
        <dd className={styles.stack}>
          <Segmented label="Temperature" disabled={!canHeat || busy === 'crm'} value={auto ? 'auto' : crm.heat} onChange={(value) => save({ heat: value }, value === 'auto' ? 'Temperature is automatic again.' : `Temperature set to ${HEATS[value].label} by hand.`)}
            options={[{ value: 'auto', label: 'Auto' }, ...HEAT_ORDER.map((key) => ({ value: key, label: HEATS[key].label }))]} />
          <details className={styles.why}>
            <summary>{heatName || 'Not scored'} · {auto ? 'automatic' : 'set by hand'} · why?</summary>
            {reasons.length ? <ul>{reasons.map((entry, index) => <li key={`${entry.label}-${index}`}>
              <span className={`crm-tabnum ${styles.points}`} data-sign={entry.points >= 0 ? 'plus' : 'minus'}>{entry.points > 0 ? `+${entry.points}` : entry.points}</span><span>{entry.label}</span>
            </li>)}</ul> : <p className={styles.hint}>No scoring signals yet.</p>}
          </details>
        </dd>
      </div>
      <div>
        <dt>Score</dt>
        <dd>{typeof crm.score === 'number' ? <span className={styles.score} role="img" aria-label={`Score ${crm.score} out of 100`}>
          <span className={styles.scoreTrack}><span style={{ width: `${Math.max(2, Math.min(100, crm.score))}%` }} /></span>
          <span className="crm-tabnum">{crm.score}<small> / 100</small></span>
        </span> : <span className={styles.faint}>—</span>}</dd>
      </div>
      <div>
        <dt>Priority</dt>
        <dd><Segmented label="Priority" disabled={!canHeat || busy === 'crm'} value={crm.priority ?? 'normal'} onChange={(value) => save({ priority: value }, `Priority set to ${PRIORITIES[value].label}.`)}
          options={PRIORITY_ORDER.map((key) => ({ value: key, label: PRIORITIES[key].label }))} /></dd>
      </div>
      <div>
        <dt>Tags <small className="crm-tabnum">{tags.length}/8</small></dt>
        <dd className={styles.stack}>
          {tags.length > 0 && <ul className={styles.tagList}>
            {tags.map((name) => <li key={name}><Chip size="sm">{name}</Chip>
              {canHeat && <button type="button" aria-label={`Remove tag ${name}`} title="Remove tag" disabled={busy === 'crm'} onClick={() => save({ tags: tags.filter((value) => value !== name) }, `Tag “${name}” removed.`)}><Icon name="close" /></button>}</li>)}
          </ul>}
          {canHeat ? <form className={styles.inline} onSubmit={addTag}>
            <label className="sr-only" htmlFor="lead-tag">New tag</label>
            <input id="lead-tag" className="adm-input" value={tag} maxLength={24} placeholder="Add a tag" onChange={(event) => setTag(event.target.value)} />
            <button type="submit" className="adm-btn" disabled={!tag.trim() || busy === 'crm'}>Add</button>
          </form> : !tags.length && <span className={styles.faint}>—</span>}
        </dd>
      </div>
    </dl>
  </Panel>;
}

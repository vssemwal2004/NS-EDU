'use client';
// Bulk actions on the selected leads (sticky bar + the dialog each action opens). The same dialogs serve the
// "⋮" row menu for one lead (`lead` given): those use the single-lead endpoints, so people without bulk rights can use them.
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { HEAT_ORDER, HEATS, PRIORITIES, PRIORITY_ORDER, STAGE_ORDER, STAGES } from '@/features/admin/crm/meta';
import { BULK_LIMIT } from './lead-format';
import { personName } from './lead-views';
import styles from './LeadBulk.module.css';

const TITLES = {
  status: 'Change stage', heat: 'Set temperature', priority: 'Set priority', tag: 'Add a tag', assign: 'Assign to colleagues', delete: 'Delete leads',
};
const noun = (count) => `${count} ${count === 1 ? 'lead' : 'leads'}`;

/** `allowed` = { status, heat, priority, tag, assign, delete } booleans from the viewer's permissions. */
export function BulkBar({ count, allowed, onAction, onClear }) {
  const actions = [
    ['status', 'Change stage', 'trend'], ['heat', 'Set temperature', 'flame'], ['priority', 'Set priority', 'flag'],
    ['tag', 'Add tag', 'tag'], ['assign', 'Assign', 'people'], ['delete', 'Delete', 'trash'],
  ].filter(([key]) => allowed[key]);
  return <div className={styles.bar} role="region" aria-label="Bulk actions">
    <p className={styles.count} aria-live="polite"><strong className="crm-tabnum">{count}</strong> selected<span className={styles.hint} title={`Bulk actions apply to up to ${BULK_LIMIT} leads at a time (one page).`}> · this page</span></p>
    <div className={styles.actions}>
      {actions.map(([key, label, icon]) => <button key={key} type="button" className={`adm-btn adm-btn--sm${key === 'delete' ? ' adm-btn--danger' : ''}`} onClick={() => onAction(key)}>
        <Icon name={icon} />{label}
      </button>)}
      {!actions.length && <span className={styles.hint}>Your role cannot change leads in bulk.</span>}
    </div>
    <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={onClear}><Icon name="close" />Clear selection</button>
  </div>;
}

function Choices({ options, value, onChange, name }) {
  return <div className={styles.choices} role="radiogroup" aria-label={name}>
    {options.map((option) => <label key={option.value} className="crm-tone" data-tone={option.tone ?? 'neutral'} data-on={value === option.value || undefined}>
      <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
      {option.icon && <Icon name={option.icon} />}<span>{option.label}<small>{option.hint}</small></span>
    </label>)}
  </div>;
}

// One lead: the single-lead endpoints. Many: POST /crm/leads/bulk.
async function send({ request, action, ids, lead, value }) {
  if (!lead) return request('/crm/leads/bulk', { method: 'POST', body: { ids, action, ...(action === 'delete' ? {} : { value }) } });
  if (action === 'status') await request(`/leads/${lead.id}/status`, { method: 'PATCH', body: { status: value } });
  else if (action === 'heat' || action === 'priority') await request(`/crm/leads/${lead.id}`, { method: 'PATCH', body: { [action]: value } });
  else if (action === 'tag') await request(`/crm/leads/${lead.id}`, { method: 'PATCH', body: { tags: [...new Set([...(lead.crm?.tags ?? []), value.trim().toLowerCase()])].slice(0, 8) } });
  else if (action === 'assign') await request(`/leads/${lead.id}/assignments`, { method: 'PATCH', body: { employeeIds: [...new Set([...(lead.assignedEmployeeIds ?? []), ...value])] } });
  else if (action === 'delete') await request(`/crm/leads/${lead.id}`, { method: 'DELETE' });
  return { count: 1 };
}

function Body({ action, ids, lead, request, assignees, onClose, onDone }) {
  const [value, setValue] = useState(action === 'assign' ? [] : '');
  const [state, setState] = useState({ busy: false, error: '' });
  const count = ids.length;
  const what = lead ? (lead.applicant?.fullName || lead.ref) : noun(count);

  const config = {
    status: { ready: Boolean(value) && value !== lead?.status, label: 'Change stage', text: () => `Moved ${what} to ${STAGES[value]?.label ?? value}.` },
    heat: { ready: Boolean(value), label: 'Set temperature', text: () => (value === 'auto' ? `Temperature of ${what} handed back to automatic scoring.` : `${what} marked ${HEATS[value]?.label}.`) },
    priority: { ready: Boolean(value), label: 'Set priority', text: () => `Priority ${PRIORITIES[value]?.label} set on ${what}.` },
    // `value` is an array for "assign": only call string methods on it for the string actions.
    tag: { ready: typeof value === 'string' && value.trim().length > 0, label: 'Add tag', text: () => `Tag “${value.trim().toLowerCase()}” added to ${what}.` },
    assign: { ready: value.length > 0, label: 'Assign', text: () => `${value.length === 1 ? 'Colleague' : 'Colleagues'} added to ${what}.` },
  }[action];

  async function submit(event) {
    event.preventDefault();
    if (!config.ready || state.busy) return;
    setState({ busy: true, error: '' });
    try {
      const result = await send({ request, action, ids, lead, value });
      // `count` can be lower than selected (e.g. leads already in that stage); say what really happened.
      const changed = typeof result?.count === 'number' ? result.count : count;
      onDone(changed === count ? config.text() : `${config.text()} ${changed} of ${count} changed; the rest already matched.`);
    } catch (failure) { setState({ busy: false, error: failure.message }); }
  }

  return <form className={drawerStyles.confirm} onSubmit={submit}>
    {action === 'status' && <>
      <p className={drawerStyles.help}>Choose the stage for {what}. Each move is added to the lead’s history.</p>
      <Choices name="Stage" value={value} onChange={setValue} options={STAGE_ORDER.filter((key) => key !== lead?.status).map((key) => ({ value: key, label: STAGES[key].label, icon: STAGES[key].icon, tone: STAGES[key].tone }))} />
      {(value === 'not-interested' || value === 'closed') && <p className={styles.note}><Icon name="alert" />Closed leads leave the follow-up lists and are no longer scored.</p>}
    </>}
    {action === 'heat' && <>
      <p className={drawerStyles.help}>Pick a temperature for {what}, or hand it back to the scoring rules.</p>
      <Choices name="Temperature" value={value} onChange={setValue} options={[
        ...HEAT_ORDER.map((key) => ({ value: key, label: HEATS[key].label, icon: HEATS[key].icon, tone: HEATS[key].tone, hint: HEATS[key].hint })),
        { value: 'auto', label: 'Auto', icon: 'spark', tone: 'purple', hint: 'Let the scoring rules decide again.' },
      ]} />
    </>}
    {action === 'priority' && <>
      <p className={drawerStyles.help}>Priority for {what}.</p>
      <Choices name="Priority" value={value} onChange={setValue} options={PRIORITY_ORDER.map((key) => ({ value: key, label: PRIORITIES[key].label, icon: PRIORITIES[key].icon, tone: PRIORITIES[key].tone }))} />
    </>}
    {action === 'tag' && <label className={drawerStyles.formField}>
      <span className={drawerStyles.fieldLabel}>Tag</span>
      <input className={drawerStyles.input} value={value} maxLength={24} autoFocus placeholder="e.g. scholarship" onChange={(event) => setValue(event.target.value)} />
      <span className={drawerStyles.help}>Added to {what}. Tags are lowercase; a lead keeps at most 8.</span>
    </label>}
    {action === 'assign' && <>
      <p className={drawerStyles.help}>The people you choose are added to {what}. Existing assignments stay in place.</p>
      <div className={styles.people}>
        {assignees.map((person) => <label key={person.id}>
          <input type="checkbox" checked={value.includes(person.id)} onChange={(event) => setValue((current) => (event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)))} />
          <span>{personName(person)}<small>{person.email}</small></span>
        </label>)}
        {!assignees.length && <p className={drawerStyles.help}>There is nobody you can assign leads to.</p>}
      </div>
    </>}
    {state.error && <p className={drawerStyles.formError} role="alert"><Icon name="shield" />{state.error}</p>}
    <div className={drawerStyles.formActions}>
      <button type="button" className="adm-btn" onClick={onClose}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={!config.ready || state.busy}>{state.busy ? 'Working…' : config.label}</button>
    </div>
  </form>;
}

function DeleteConfirm({ ids, lead, request, onClose, onDone }) {
  const [state, setState] = useState({ busy: false, error: '' });
  const name = lead ? `${lead.applicant?.fullName || 'this lead'} (${lead.ref})` : noun(ids.length);
  async function run() {
    setState({ busy: true, error: '' });
    try {
      await send({ request, action: 'delete', ids, lead });
      onDone(`${lead ? lead.ref : noun(ids.length)} moved to the Lead bin.`);
    } catch (failure) { setState({ busy: false, error: failure.message }); }
  }
  return <ConfirmDialog open tone="danger" title={`Delete ${name}?`} confirmLabel={lead ? 'Delete lead' : `Delete ${noun(ids.length)}`} busy={state.busy} error={state.error} onConfirm={run} onCancel={onClose}>
    {lead ? 'This lead' : 'These leads'} will move to the <strong>Lead bin</strong>. {lead ? 'It disappears' : 'They disappear'} from lists and reports, but an owner can restore {lead ? 'it' : 'them'} from the bin.
  </ConfirmDialog>;
}

/** `action` is null when closed; `lead` (a list item) switches to single-lead mode. onDone(message) runs after the API accepted the change. */
export function BulkDialog({ action, ids, lead = null, request, assignees, onClose, onDone }) {
  if (action === 'delete') return <DeleteConfirm ids={ids} lead={lead} request={request} onClose={onClose} onDone={onDone} />;
  const title = lead ? `${TITLES[action] ?? ''} · ${lead.applicant?.fullName || lead.ref}` : `${TITLES[action] ?? ''} · ${noun(ids.length)}`;
  return <AdminDrawer open={Boolean(action)} onClose={onClose} title={action ? title : ''}>
    {action && <Body key={action} action={action} ids={ids} lead={lead} request={request} assignees={assignees} onClose={onClose} onDone={onDone} />}
  </AdminDrawer>;
}

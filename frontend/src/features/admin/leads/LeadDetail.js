'use client';
/**
 * Lead 360: one record page with everything about a lead and what staff can do next.
 * Header: identity, contact actions, stage stepper. Left: log activity + timeline. Right: follow-ups,
 * temperature/priority/tags, contact, course, application, assignment, consent and source, delete.
 * What renders follows the signed-in person's permissions; the API is the real gate.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { can, STAGES } from '@/features/admin/crm/meta';
import { useToaster } from '@/features/admin/crm/toast';
import { clearServerListCache } from '@/features/admin/table/useServerList';
import { Composer, FollowUps, ScheduleDialog, Timeline } from './LeadActivity';
import LeadHeader, { ScoringPanel } from './LeadHeader';
import { AssignmentPanel, DangerZone, DetailPanels, EditDrawer } from './LeadInfo';
import { LEADS_FLASH_KEY, LEADS_QUERY_KEY } from './lead-format';
import { useCrmMeta } from './lead-views';
import styles from './LeadPanel.module.css';

const savedQuery = () => { try { return window.sessionStorage.getItem(LEADS_QUERY_KEY) || ''; } catch { return ''; } };

export default function LeadDetail({ id }) {
  const router = useRouter();
  const toast = useToaster();
  const { admin, request } = useAdminSession();
  const { assignees } = useCrmMeta();
  const [state, setState] = useState({ item: null, error: '', status: 0 });
  const [timeline, setTimeline] = useState({ items: [], loaded: false, error: '' });
  const [states, setStates] = useState([]);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [backHref, setBackHref] = useState('/admin/leads');
  const composer = useRef(null);
  const hashHandled = useRef(false);

  // The back link returns to the list exactly as the person left it (filters, stage, page).
  useEffect(() => { setBackHref(`/admin/leads${savedQuery()}`); }, []);

  const loadTimeline = useCallback(async (signal) => {
    try {
      const { items } = await request(`/crm/leads/${id}/timeline`, { signal });
      setTimeline({ items, loaded: true, error: '' });
    } catch (failure) {
      if (failure.name !== 'AbortError') setTimeline((current) => ({ ...current, loaded: true, error: failure.message }));
    }
  }, [id, request]);

  useEffect(() => {
    const controller = new AbortController();
    request(`/leads/${id}`, { signal: controller.signal })
      .then(({ item }) => setState({ item, error: '', status: 200 }))
      .catch((failure) => { if (failure.name !== 'AbortError') setState({ item: null, error: failure.message, status: failure.status }); });
    loadTimeline(controller.signal);
    request('/leads/filter-options', { signal: controller.signal }).then((options) => setStates(options.states ?? [])).catch(() => {});
    return () => controller.abort();
  }, [id, request, loadTimeline]);

  // Links from the list's row menu: #log, #follow-up and #edit jump straight to that action.
  const loaded = Boolean(state.item);
  useEffect(() => {
    if (!loaded || hashHandled.current) return;
    hashHandled.current = true;
    const hash = window.location.hash;
    if (hash === '#log') { document.getElementById('log')?.scrollIntoView({ block: 'center' }); composer.current?.focus({ preventScroll: true }); }
    else if (hash === '#follow-up') setScheduling(true);
    else if (hash === '#edit') setEditing('applicant');
  }, [loaded]);

  // The list caches pages per tab; after a write, it must not flash the old stage, temperature or counts.
  const applyItem = useCallback((item) => {
    setState((current) => ({ ...current, item }));
    clearServerListCache('/leads');
  }, []);
  const refresh = useCallback(async () => {
    const [{ item }] = await Promise.all([request(`/leads/${id}`), loadTimeline()]);
    applyItem(item);
  }, [applyItem, id, loadTimeline, request]);

  function back(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    router.push(`/admin/leads${savedQuery()}`);
  }
  function focusComposer() {
    document.getElementById('log')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    composer.current?.focus({ preventScroll: true });
  }
  function copyPhone(phone) {
    (window.navigator.clipboard?.writeText(phone) ?? Promise.reject(new Error('unavailable')))
      .then(() => toast.success(`Copied ${phone}.`), () => toast.error('Could not copy. Select the number and copy it by hand.'));
  }

  /** Stage change with Undo. Resolves to an error message ('' on success) so the close dialog can show it. */
  async function changeStage(status, lostReason = '') {
    const previous = state.item.status;
    setBusy('stage');
    try {
      const { item } = await request(`/leads/${id}/status`, { method: 'PATCH', body: { status } });
      let next = item;
      if (lostReason && lostReason !== (item.crm?.lostReason ?? '')) next = (await request(`/crm/leads/${id}`, { method: 'PATCH', body: { lostReason } })).item;
      applyItem(next); loadTimeline();
      toast.success(`Moved to ${STAGES[status]?.label ?? status}.`, {
        action: { label: 'Undo', onClick: () => request(`/leads/${id}/status`, { method: 'PATCH', body: { status: previous } }).then(({ item: restored }) => { applyItem(restored); loadTimeline(); }, (failure) => toast.error(failure.message)) },
      });
      setBusy('');
      return '';
    } catch (failure) {
      setBusy('');
      toast.error(failure.message);
      return failure.message;
    }
  }

  /** PATCH /crm/leads/:id for temperature, priority and tags. Resolves to an error message ('' on success). */
  async function saveCrm(patch, message) {
    setBusy('crm');
    try {
      const { item } = await request(`/crm/leads/${id}`, { method: 'PATCH', body: patch });
      applyItem(item); loadTimeline();
      toast.success(message);
      setBusy('');
      return '';
    } catch (failure) {
      setBusy('');
      toast.error(failure.message);
      return failure.message;
    }
  }

  function deleted() {
    try { window.sessionStorage.setItem(LEADS_FLASH_KEY, `${state.item.ref} moved to the Lead bin.`); } catch { /* storage unavailable */ }
    clearServerListCache('/leads');
    router.push(`/admin/leads${savedQuery()}`);
  }

  if (state.error) return <div className={`adm-panel ${styles.detailError}`} role="alert">
    <Icon name="alert" /><div><strong>{state.status === 404 ? 'Lead not found' : 'Could not load this lead'}</strong><p>{state.status === 404 ? 'It may not exist, was deleted, or is not assigned to you.' : state.error}</p></div>
    <Link className="adm-btn" href={backHref} onClick={back}>Back to leads</Link>
  </div>;
  if (!state.item) return <div className={styles.skeleton} aria-busy="true" aria-label="Loading lead"><span /><div><span /><span /></div></div>;

  const { item } = state;
  const afterLog = (lead) => { applyItem(lead); loadTimeline(); };
  return <div className={styles.detail}>
    <LeadHeader item={item} backHref={backHref} onBack={back} admin={admin} busy={busy} onStage={changeStage} onLog={focusComposer} onSchedule={() => setScheduling(true)}
      onEdit={() => setEditing('applicant')} onDelete={() => setDeleting(true)} onCopy={copyPhone} />
    <div className={styles.grid}>
      <div className={styles.main}>
        {can(admin, 'leads.notes') && <Composer item={item} request={request} onSaved={afterLog} textRef={composer} />}
        <Timeline timeline={timeline} onRetry={() => loadTimeline()} />
      </div>
      <aside className={styles.rail} aria-label="Lead details">
        <FollowUps item={item} timeline={timeline} admin={admin} request={request} onChanged={refresh} onSchedule={() => setScheduling(true)} />
        <ScoringPanel item={item} admin={admin} busy={busy} save={saveCrm} />
        <AssignmentPanel key={item.assignedEmployeeIds.join(',')} item={item} admin={admin} assignees={assignees} request={request} onSaved={applyItem} />
        <DetailPanels item={item} admin={admin} onEdit={setEditing} />
        <DangerZone item={item} admin={admin} request={request} onDeleted={deleted} open={deleting} setOpen={setDeleting} />
      </aside>
    </div>
    <ScheduleDialog open={scheduling} onClose={() => setScheduling(false)} item={item} request={request} onSaved={afterLog} />
    {can(admin, 'leads.edit') && <EditDrawer item={item} editing={editing} states={states} request={request} onClose={() => setEditing('')}
      onSaved={(next) => { setEditing(''); applyItem(next); toast.success('Details saved.'); }} />}
  </div>;
}

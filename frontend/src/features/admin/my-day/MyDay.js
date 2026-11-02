'use client';
/**
 * My day: the counsellor's daily work queue. A summary strip (Overdue, Due today, Upcoming, Done today),
 * compact follow-up rows with Call / WhatsApp / Log call / Reschedule / Mark done, and the hot leads still waiting
 * for a first call. Data: GET /crm/tasks?state=…, GET /crm/dashboard (actions.hotWaiting) or GET /leads?heat=hot&status=new.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { useToaster } from '@/features/admin/crm/toast';
import { can, canAny } from '@/features/admin/crm/meta';
import { dateTimeOf, displayName, formatNumber } from '@/features/admin/crm/format';
import FollowUpDialog from '@/features/admin/lead-actions/FollowUpDialog';
import LogCallDialog from '@/features/admin/lead-actions/LogCallDialog';
import { toQuery } from '@/features/admin/table/useServerList';
import { PageToolbar, StatStrip, ViewTabs } from '@/features/admin/ui/Page';
import HotWaiting from './HotWaiting';
import TaskCard from './TaskCard';
import styles from './MyDay.module.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const SCOPES = [['mine', 'Mine', 'user'], ['team', 'My team', 'people'], ['all', 'Everyone', 'building']];
const STATE_LIMITS = { overdue: 100, today: 100, upcoming: 50, done: 50 };
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** Which section a task belongs to right now. */
export function classify(task, now) {
  if (task._hold) return task._hold;
  if (task.doneAt) return 'done';
  const due = new Date(task.dueAt);
  if (due < now) return 'overdue';
  return sameDay(due, now) ? 'today' : 'upcoming';
}
const shift = (counts, from, to) => ({ ...counts, ...(counts[from] !== undefined && from !== to ? { [from]: Math.max(0, counts[from] - 1) } : {}), ...(counts[to] !== undefined && from !== to ? { [to]: counts[to] + 1 } : {}) });

const SECTIONS = {
  overdue: { title: 'Overdue', tone: 'bad', icon: 'alert', hint: 'Was due earlier. Call these first.' },
  today: { title: 'Due today', tone: 'warn', icon: 'clock', hint: 'Scheduled for the rest of today' },
  upcoming: { title: 'Upcoming', tone: 'info', icon: 'calendar', hint: 'Coming up in the next days' },
  done: { title: 'Done today', tone: 'good', icon: 'checkCircle', hint: 'Ticked off today; a tick can be undone' },
};

export default function MyDay() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const team = admin?.isOwner || admin?.leadScope === 'team' || admin?.leadScope === 'all' || can(admin, 'tasks.manage_team');
  const everyone = admin?.isOwner || admin?.leadScope === 'all';
  const [scope, setScope] = useState('mine');
  const [blocked, setBlocked] = useState([]);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({ key: null, tasks: null, counts: { overdue: 0, today: 0, upcoming: 0 }, error: '' });
  const [people, setPeople] = useState(() => new Map());
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState('');
  const [open, setOpen] = useState({ overdue: true, today: true, upcoming: true, done: false });
  const [more, setMore] = useState(false);
  const [logFor, setLogFor] = useState(null);
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const sectionRefs = useRef({});
  const dataRef = useRef(data);
  const undoRef = useRef(null);
  useEffect(() => { dataRef.current = data; });
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const key = `${scope}|${version}`;
  const nowDate = useMemo(() => new Date(now), [now]);

  // Who the assignees are (for the avatar in team mode).
  useEffect(() => {
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((meta) => setPeople(new Map((meta.assignees ?? []).map((person) => [person.id, person])))).catch(() => {});
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all(Object.entries(STATE_LIMITS).map(([state, limit]) => request(`/crm/tasks?${toQuery({ scope, state, limit })}`, { signal })))
      .then((results) => {
        if (signal.aborted) return;
        const byId = new Map();
        results.forEach((result) => result.items.forEach((task) => byId.set(task.id, task)));
        setData({ key, tasks: [...byId.values()], counts: results[0].counts, error: '' });
      })
      .catch((failure) => {
        if (signal.aborted || failure.name === 'AbortError') return;
        if (failure.status === 403 && scope !== 'mine') { setBlocked((list) => [...list, scope]); setScope('mine'); return; }
        setData((current) => ({ ...current, key, error: failure.message || 'Could not load your follow-ups.' }));
      });
    return () => controller.abort();
  }, [key, scope, request]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const loading = !data.tasks;
  const switching = data.key !== key && Boolean(data.tasks);

  // ---- edits to the local list ----
  const patchTask = useCallback((id, patch) => setData((cur) => (cur.tasks ? { ...cur, tasks: cur.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)) } : cur)), []);
  const bump = useCallback((from, to) => setData((cur) => ({ ...cur, counts: shift(cur.counts, from, to) })), []);

  const sections = useMemo(() => {
    const out = { overdue: [], today: [], upcoming: [], done: [] };
    (data.tasks ?? []).forEach((task) => { const cls = classify(task, nowDate); if (cls !== 'done' || sameDay(new Date(task.doneAt), nowDate)) out[cls].push(task); });
    const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
    out.overdue.sort(byDue); out.today.sort(byDue); out.upcoming.sort(byDue);
    out.done.sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
    return out;
  }, [data.tasks, nowDate]);
  const counts = { overdue: data.counts.overdue, today: data.counts.today, upcoming: data.counts.upcoming, done: sections.done.length };

  async function markDone(task) {
    const cls = classify(task, new Date());
    const original = task;
    patchTask(task.id, { doneAt: new Date().toISOString(), _hold: cls });
    bump(cls, 'done');
    window.setTimeout(() => patchTask(task.id, { _hold: undefined }), 750);
    try {
      await request(`/crm/tasks/${task.id}`, { method: 'PATCH', body: { done: true } });
      toast.success(`Done: ${task.title}`, { action: { label: 'Undo', onClick: () => undoRef.current(original) } });
    } catch (failure) {
      patchTask(task.id, { doneAt: null, _hold: undefined });
      bump('done', cls);
      toast.error(`Could not mark it done: ${failure.message}`);
    }
  }
  const undoDone = useCallback(async (original) => {
    const cls = classify({ ...original, doneAt: null, _hold: undefined }, new Date());
    patchTask(original.id, { doneAt: null, _hold: undefined });
    bump('done', cls);
    try { await request(`/crm/tasks/${original.id}`, { method: 'PATCH', body: { done: false } }); toast.success('Back on your list'); } catch (failure) {
      toast.error(`Could not undo: ${failure.message}`); reload();
    }
  }, [bump, patchTask, reload, request, toast]);
  useEffect(() => { undoRef.current = undoDone; });

  function rescheduled(result) {
    const task = result.item;
    const before = dataRef.current.tasks?.find((entry) => entry.id === task.id);
    if (!before) return;
    const from = classify(before, new Date());
    const after = { ...before, dueAt: task.dueAt, overdue: false };
    patchTask(task.id, { dueAt: task.dueAt, overdue: false });
    bump(from, classify(after, new Date()));
    toast.success(`Rescheduled to ${dateTimeOf(task.dueAt)}`);
  }
  async function deleteTask() {
    const { task } = deleting;
    setDeleting({ task, busy: true, error: '' });
    try {
      await request(`/crm/tasks/${task.id}`, { method: 'DELETE' });
      const cls = classify(task, new Date());
      setData((cur) => ({ ...cur, tasks: cur.tasks.filter((entry) => entry.id !== task.id), counts: cls === 'done' ? cur.counts : { ...cur.counts, [cls]: Math.max(0, cur.counts[cls] - 1) } }));
      setDeleting(null);
      toast.success('Follow-up deleted');
    } catch (failure) { setDeleting({ task, busy: false, error: failure.message }); }
  }

  // Choosing a number in the strip opens that section and scrolls to it (after it has rendered open).
  const [scrollTo, setScrollTo] = useState({ name: '', tick: 0 });
  useEffect(() => {
    if (!scrollTo.name) return undefined;
    const timer = window.setTimeout(() => sectionRefs.current[scrollTo.name]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    return () => window.clearTimeout(timer);
  }, [scrollTo]);
  function focusSection(name) {
    setFocus(name);
    setOpen((cur) => ({ ...cur, [name]: true }));
    setScrollTo((cur) => ({ name, tick: cur.tick + 1 }));
  }

  const first = (admin?.name || displayName(admin?.email)).split(' ')[0];
  const hour = nowDate.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const available = SCOPES.filter(([value]) => !blocked.includes(value) && (value === 'mine' || (value === 'team' && team) || (value === 'all' && everyone)));
  const teamMode = scope !== 'mine';
  const caughtUp = !loading && sections.overdue.length === 0 && sections.today.length === 0;
  const analytics = canAny(admin, ['analytics.view_own', 'analytics.view_team', 'analytics.view_all']);
  const showHot = analytics || canAny(admin, ['leads.view_own', 'leads.view_team', 'leads.view_all']);

  const cardProps = { now: nowDate, people, teamMode, onDone: markDone, onUndo: undoDone, onLog: setLogFor, onReschedule: setRescheduleFor, onDelete: (task) => setDeleting({ task, busy: false, error: '' }), canEdit: can(admin, 'leads.notes') };


  const todo = counts.overdue + counts.today;
  const summary = <>{greeting}, {first} · {nowDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}{!loading && <> · {todo > 0 ? <strong>{formatNumber(todo)} to do now</strong> : 'nothing due right now'}</>}</>;

  return <div className={styles.page}>
    <PageToolbar summary={summary} start={available.length > 1 ? <ViewTabs label="Whose follow-ups" value={scope} onChange={setScope} items={available.map(([value, label, icon]) => ({ key: value, label, icon }))} /> : null}>
      <button type="button" className={cx('adm-btn adm-btn--icon', switching && styles.spin)} onClick={reload} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
    </PageToolbar>

    <StatStrip label="Follow-up summary" loading={loading} items={Object.entries(SECTIONS).map(([name, info]) => ({
      key: name, label: info.title, icon: info.icon, tone: info.tone, value: counts[name], active: focus === name, onClick: () => focusSection(name),
    }))} />

    {data.error && <div className={cx('adm-panel', styles.errorBox)} role="alert"><Icon name="alert" /><span>{data.tasks ? `Showing the last loaded list. ${data.error}` : data.error}</span><button type="button" className="adm-btn adm-btn--sm" onClick={reload}>Retry</button></div>}

    <div className={styles.layout}>
      <div className={styles.main} aria-busy={switching}>
        {loading && !data.error && <div className={cx('adm-panel', styles.skeleton)} aria-label="Loading your follow-ups">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>}

        {caughtUp && <p className={styles.caughtUp} aria-live="polite"><Icon name="checkCircle" />
          <span>All caught up: nothing overdue or due today{teamMode ? ' in this view' : ''}.</span></p>}

        {!loading && Object.entries(SECTIONS).filter(([name]) => !(caughtUp && (name === 'overdue' || name === 'today'))).map(([name, info]) => {
          const items = sections[name];
          const limit = name === 'upcoming' && !more ? 10 : items.length;
          return <section key={name} ref={(node) => { sectionRefs.current[name] = node; }} className={cx('adm-panel', styles.section)} data-focus={focus === name} aria-labelledby={`sec-${name}`}>
            <h2 className={styles.sectionHead} id={`sec-${name}`}>
              <button type="button" className={styles.sectionToggle} aria-expanded={open[name]} aria-controls={`list-${name}`} onClick={() => setOpen((cur) => ({ ...cur, [name]: !cur[name] }))}>
                <i className="crm-tone" data-tone={info.tone} aria-hidden="true" />
                <span className={styles.sectionTitle} title={info.hint}>{info.title}</span>
                <span className={cx('crm-tabnum', styles.sectionCount)}>{formatNumber(counts[name])}</span>
                <span className={styles.sectionSpacer} />
                <Icon name="chevron" className={styles.chev} />
              </button>
            </h2>
            {open[name] && <div className={styles.list} id={`list-${name}`}>
              {items.length === 0 && <p className={styles.none}>{name === 'done' ? 'Nothing done yet today' : name === 'upcoming' ? 'Nothing planned after today' : 'Nothing here'}</p>}
              {items.slice(0, limit).map((task) => <TaskCard key={task.id} task={task} section={name} {...cardProps} />)}
              {name === 'upcoming' && items.length > 10 && <button type="button" className={cx('adm-btn adm-btn--sm adm-btn--ghost', styles.showAll)} onClick={() => setMore((value) => !value)}>{more ? 'Show fewer' : `Show all ${formatNumber(items.length)}`}</button>}
              {counts[name] > items.length && name !== 'done' && <p className={styles.none}>Showing the first {formatNumber(items.length)} of {formatNumber(counts[name])}. <Link href={`/admin/leads?followUp=${name}`}>See the leads in the list</Link>.</p>}
            </div>}
          </section>;
        })}
      </div>

      {showHot && <aside className={styles.side}><HotWaiting analytics={analytics} /></aside>}
    </div>

    <LogCallDialog open={Boolean(logFor)} lead={logFor ? { id: logFor.leadId, name: logFor.leadName, phone: logFor.leadPhone } : null} task={logFor} onClose={() => setLogFor(null)}
      onLogged={({ taskDone, followUpAt, warning }) => {
        if (warning) toast.error(warning); else toast.success(`Call logged${taskDone ? ', follow-up done' : ''}${followUpAt ? ' and the next one planned' : ''}`);
        reload();
      }} />
    <FollowUpDialog open={Boolean(rescheduleFor)} mode="reschedule" task={rescheduleFor} onClose={() => setRescheduleFor(null)} onSaved={rescheduled} />
    <ConfirmDialog open={Boolean(deleting)} tone="danger" icon="trash" title="Delete this follow-up?" confirmLabel="Delete follow-up" busy={deleting?.busy} error={deleting?.error}
      onCancel={() => setDeleting(null)} onConfirm={deleteTask}>
      <p><strong>{deleting?.task.title}</strong> for {deleting?.task.leadName} will be removed. The lead itself is not affected. To only change the time, use Reschedule instead.</p>
    </ConfirmDialog>
  </div>;
}

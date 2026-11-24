'use client';
/**
 * My day: the counsellor's daily work queue. A summary strip (Overdue, Due today, Upcoming, Done today),
 * compact follow-up rows with Call / WhatsApp / Log call / Reschedule / Mark done, and the hot leads still waiting
 * for a first call. Data: GET /crm/tasks/sections and the scoped hot-leads queue.
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
import EditFollowUpDialog from './EditFollowUpDialog';
import HotWaiting from './HotWaiting';
import TaskCard from './TaskCard';
import WeekAgenda from './WeekAgenda';
import styles from './MyDay.module.css';
import { useStickyState } from '../ui/useStickyState';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const SCOPES = [['mine', 'Mine', 'user'], ['team', 'My team', 'people'], ['all', 'Everyone', 'building']];
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const PREVIEW = { overdue: 6, today: 6, upcoming: 10, done: 6 };
// /crm/tasks/sections returns these first page sizes before requests to /crm/tasks.
const INITIAL_FETCH = { overdue: 100, today: 100, upcoming: 50, done: 50 };
const PAGE_SIZE = 25;

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
  const [scope, setScope] = useStickyState('my-day:scope', 'mine');
  const [blocked, setBlocked] = useState([]);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({ key: null, tasks: null, counts: { overdue: 0, today: 0, upcoming: 0 }, error: '' });
  const [people, setPeople] = useState(() => new Map());
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState('');
  const [open, setOpen] = useState({ overdue: true, today: true, upcoming: true, done: false });
  const [visible, setVisible] = useState({});
  const [logFor, setLogFor] = useState(null);
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const sectionRefs = useRef({});
  const dataRef = useRef(data);
  const pendingPages = useRef(new Map());
  const undoRef = useRef(null);
  useEffect(() => { dataRef.current = data; });
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  const key = `${scope}|${version}`;
  const nowDate = useMemo(() => new Date(now), [now]);
  useEffect(() => {
    const pending = pendingPages.current;
    return () => {
      pending.forEach((controller) => controller.abort());
      pending.clear();
    };
  }, [key]);

  // Who the assignees are (for the avatar in team mode).
  useEffect(() => {
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((meta) => setPeople(new Map((meta.assignees ?? []).map((person) => [person.id, person])))).catch(() => {});
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    request(`/crm/tasks/sections?${toQuery({ scope })}`, { signal })
      .then(({ sections, counts }) => {
        if (signal.aborted) return;
        const byId = new Map();
        for (const section of Object.values(sections)) {
          for (const task of section.items) byId.set(task.id, task);
        }
        const nextPages = Object.fromEntries(Object.keys(SECTIONS).map((name) => [
          name,
          { page: INITIAL_FETCH[name] / PAGE_SIZE + 1, exhausted: (sections[name]?.items.length ?? 0) < INITIAL_FETCH[name] },
        ]));
        setData({ key, tasks: [...byId.values()], counts, nextPages, error: '' });
      })
      .catch((failure) => {
        if (signal.aborted || failure.name === 'AbortError') return;
        if (failure.status === 403 && scope !== 'mine') { setBlocked((list) => [...list, scope]); setScope('mine'); return; }
        setData((current) => ({ ...current, key, error: failure.message || 'Could not load your follow-ups.' }));
      });
    return () => controller.abort();
  }, [key, scope, request, setScope]);

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
  const visibleIn = (name) => visible[name]?.key === key ? visible[name].limit : PREVIEW[name];
  function reveal(name, limit) {
    setVisible((current) => ({ ...current, [name]: { key, limit } }));
  }

  async function showMore(name) {
    const available = sections[name].length;
    const limit = visibleIn(name);
    if (limit < available) { reveal(name, limit + PAGE_SIZE); return; }
    const next = data.nextPages?.[name];
    if (!next || pendingPages.current.has(name) || next.exhausted || switching) return;
    const controller = new AbortController();
    pendingPages.current.set(name, controller);
    const update = (entry, items = []) => setData((current) => {
      if (current.key !== key) return current;
      const known = new Set(current.tasks.map((task) => task.id));
      return {
        ...current,
        tasks: [...current.tasks, ...items.filter((task) => !known.has(task.id))],
        nextPages: { ...current.nextPages, [name]: entry },
      };
    });
    update({ ...next, busy: true, error: '' });
    try {
      const { signal } = controller;
      const result = await request(`/crm/tasks?${toQuery({ scope, state: name, page: next.page, limit: PAGE_SIZE })}`, { signal });
      if (signal.aborted) return;
      const { items, total } = result;
      const exhausted = next.page * PAGE_SIZE >= total || items.length < PAGE_SIZE
        || (name === 'done' && items.some((task) => !sameDay(new Date(task.doneAt), new Date())));
      update({ page: next.page + 1, exhausted }, items);
      reveal(name, limit + PAGE_SIZE);
    } catch (failure) {
      if (!controller.signal.aborted) update({ ...next, busy: false, error: failure.message || 'Could not load more follow-ups.' });
    } finally {
      if (pendingPages.current.get(name) === controller) pendingPages.current.delete(name);
    }
  }

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
  function edited(result) {
    const task = result.item;
    const before = dataRef.current.tasks?.find((entry) => entry.id === task.id);
    if (!before) return;
    const patch = { title: task.title, dueAt: task.dueAt, overdue: false };
    if (!before.doneAt) bump(classify(before, new Date()), classify({ ...before, ...patch }, new Date()));
    patchTask(task.id, patch);
    toast.success(`Follow-up saved · due ${dateTimeOf(task.dueAt)}`);
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
  const [scrollTo, setScrollTo] = useState({ name: '', taskId: '', tick: 0 });
  useEffect(() => {
    if (!scrollTo.name) return undefined;
    const timer = window.setTimeout(() => {
      const task = scrollTo.taskId ? document.getElementById(`follow-up-${scrollTo.taskId}`) : null;
      const target = task ?? sectionRefs.current[scrollTo.name];
      if (task) task.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [scrollTo]);
  function focusSection(name, taskId = '') {
    setFocus(name);
    setOpen((cur) => ({ ...cur, [name]: true }));
    const index = taskId ? sections[name].findIndex((task) => task.id === taskId) : -1;
    if (index >= visibleIn(name)) reveal(name, index + 1);
    setScrollTo((cur) => ({ name, taskId, tick: cur.tick + 1 }));
  }

  const first = (admin?.name || displayName(admin?.email)).split(' ')[0];
  const hour = nowDate.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const available = SCOPES.filter(([value]) => !blocked.includes(value) && (value === 'mine' || (value === 'team' && team) || (value === 'all' && everyone)));
  const teamMode = scope !== 'mine';
  const caughtUp = !loading && sections.overdue.length === 0 && sections.today.length === 0;
  const analytics = canAny(admin, ['analytics.view_own', 'analytics.view_team', 'analytics.view_all']);
  const showHot = analytics || canAny(admin, ['leads.view_own', 'leads.view_team', 'leads.view_all']);

  const cardProps = { now: nowDate, people, teamMode, onDone: markDone, onUndo: undoDone, onLog: setLogFor, onReschedule: setRescheduleFor, onEdit: setEditFor, onDelete: (task) => setDeleting({ task, busy: false, error: '' }), canEdit: can(admin, 'leads.notes') };


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

    <div className={styles.layout} data-sidebar={showHot || undefined}>
      <div className={styles.main} aria-busy={switching}>
        {loading && !data.error && <div className={cx('adm-panel', styles.skeleton)} aria-label="Loading your follow-ups">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>}
        {!loading && <WeekAgenda now={nowDate} today={sections.today} upcoming={sections.upcoming} onTask={focusSection} busy={switching} />}

        {caughtUp && <p className={styles.caughtUp} aria-live="polite"><Icon name="checkCircle" />
          <span>All caught up: nothing overdue or due today{teamMode ? ' in this view' : ''}.</span></p>}

        {!loading && Object.entries(SECTIONS).filter(([name]) => !(caughtUp && (name === 'overdue' || name === 'today'))).map(([name, info]) => {
          const items = sections[name];
          const limit = visibleIn(name);
          const next = data.nextPages?.[name];
          const canFetch = Boolean(next && !next.exhausted && (name === 'done' ? items.length >= INITIAL_FETCH.done : counts[name] > items.length));
          const canShowMore = items.length > limit || canFetch;
          return <section key={name} ref={(node) => { sectionRefs.current[name] = node; }} className={cx('adm-panel', 'crm-tone', styles.section)} data-tone={info.tone} data-focus={focus === name} aria-labelledby={`sec-${name}`}>
            <h2 className={styles.sectionHead} id={`sec-${name}`}>
              <button type="button" className={styles.sectionToggle} aria-expanded={open[name]} aria-controls={`list-${name}`} onClick={() => setOpen((cur) => ({ ...cur, [name]: !cur[name] }))}>
                <span className={styles.sectionIcon}><Icon name={info.icon} /></span>
                <span className={styles.sectionTitle} title={info.hint}>{info.title}</span>
                <span className={cx('crm-tabnum', styles.sectionCount)}>{formatNumber(counts[name])}</span>
                <span className={styles.sectionSpacer} />
                <Icon name="chevron" className={styles.chev} />
              </button>
            </h2>
            {open[name] && <div className={styles.list} id={`list-${name}`}>
              {items.length === 0 && <p className={styles.none}>{name === 'done' ? 'Nothing done yet today' : name === 'upcoming' ? 'Nothing planned after today' : 'Nothing here'}</p>}
              {items.slice(0, limit).map((task) => <TaskCard key={task.id} task={task} section={name} {...cardProps} />)}
              {(canShowMore || limit > PREVIEW[name]) && <div className={styles.sectionFoot}>
                {canShowMore && <button type="button" className="adm-btn adm-btn--sm" disabled={switching || next?.busy} onClick={() => showMore(name)}>{next?.busy ? 'Loading…' : next?.error ? 'Retry' : items.length > limit ? 'Show more' : 'Load more'}</button>}
                {limit > PREVIEW[name] && <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => reveal(name, PREVIEW[name])}>Show fewer</button>}
                <span>{formatNumber(Math.min(limit, items.length))} shown{counts[name] > limit && ` of ${formatNumber(counts[name])}`}</span>
              </div>}
              {next?.error && <p className={styles.none} role="alert">{next.error}</p>}
              {counts[name] > items.length && name !== 'done' && <p className={styles.none}><Link href={`/admin/leads?followUp=${name}`}>See the leads in the list</Link></p>}
            </div>}
          </section>;
        })}
      </div>

      {showHot && <aside className={styles.side} aria-label="Lead priorities"><HotWaiting analytics={analytics} /></aside>}
    </div>

    <LogCallDialog open={Boolean(logFor)} lead={logFor ? { id: logFor.leadId, name: logFor.leadName, phone: logFor.leadPhone } : null} task={logFor} onClose={() => setLogFor(null)}
      onLogged={({ taskDone, followUpAt, warning }) => {
        if (warning) toast.error(warning); else toast.success(`Call logged${taskDone ? ', follow-up done' : ''}${followUpAt ? ' and the next one planned' : ''}`);
        reload();
      }} />
    <FollowUpDialog open={Boolean(rescheduleFor)} mode="reschedule" task={rescheduleFor} onClose={() => setRescheduleFor(null)} onSaved={rescheduled} />
    <EditFollowUpDialog open={Boolean(editFor)} task={editFor} onClose={() => setEditFor(null)} onSaved={edited} />
    <ConfirmDialog open={Boolean(deleting)} tone="danger" icon="trash" title="Delete this follow-up?" confirmLabel="Delete follow-up" busy={deleting?.busy} error={deleting?.error}
      onCancel={() => setDeleting(null)} onConfirm={deleteTask}>
      <p><strong>{deleting?.task.title}</strong> for {deleting?.task.leadName} will be removed. The lead itself is not affected. To only change the time, use Reschedule instead.</p>
    </ConfirmDialog>
  </div>;
}

'use client';
// Top-bar check-in for employees: a button that always shows today's state (Check in / On duty 2h 14m / Checked out)
// and a popup to check in or out, with today's lead figures, today's check-ins and the last few days.
// Check-in/out toggles without limit during the day; while checked out no new automatic leads are assigned.
//
// Load on the API: the button polls the cheap, read-only GET /lead-distribution/me (every 5 minutes, on focus and
// after an action). The heavier /status (which runs the distribution) and /history load only while the popup is open.
// The worked time ticks on the client. The dashboard's DistributionCard and this button keep each other in sync with
// the `gv:attendance` window event.
//
// The popup opens by itself once a day when an employee has not checked in yet (remembered per person and day).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { useToaster } from './crm/toast';
import styles from './CheckIn.module.css';

export const ATTENDANCE_EVENT = 'gv:attendance';
const REFRESH_MS = 5 * 60_000;
const IST = 'Asia/Kolkata';
const clock = (value) => (value ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST }).format(new Date(value)) : '—');
const dayLabel = (day, options = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('en-IN', { ...options, timeZone: IST }).format(new Date(`${day}T12:00:00+05:30`));
const num = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : '—');

/** "2h 05m", "45m"; null stays null. */
export function duration(minutes) {
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

/** The day's sessions; records from before sessions existed come as one derived session. */
const sessionsOf = (me) => (me?.sessions?.length ? me.sessions : me?.checkedInAt ? [{ inAt: me.checkedInAt, outAt: me.checkedOutAt ?? null }] : []);

/** Total on-duty minutes across every session; the open one runs to `now`. */
const workedNow = (me, now) => {
  const sessions = sessionsOf(me);
  if (!sessions.length) return null;
  const ms = sessions.reduce((sum, { inAt, outAt }) => sum + Math.max(0, (outAt ? new Date(outAt) : now) - new Date(inAt)), 0);
  return Math.round(ms / 60_000);
};

const stateOf = (me) => (!me ? 'loading' : me.checkedOutAt ? 'out' : me.checkedInAt ? 'in' : 'none');

function readFlag(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function writeFlag(key) { try { window.localStorage.setItem(key, '1'); } catch { /* private mode: prompt may repeat */ } }

function useNow(active) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [active]);
  return now;
}

function History({ items }) {
  if (!items) return <p className={styles.muted}>Loading your recent days…</p>;
  const earlier = items.slice(0, 7);
  if (!earlier.length) return <p className={styles.muted}>No earlier days yet.</p>;
  return <ul className={styles.history}>
    {earlier.map((entry) => <li key={entry.day}>
      <span className={styles.historyDay}>{dayLabel(entry.day)}</span>
      <span className={styles.historyTimes}>{clock(entry.checkedInAt)} – {entry.checkedOutAt ? clock(entry.checkedOutAt) : 'no check-out'}
        {entry.sessionCount > 1 && <small> · {entry.sessionCount} check-ins</small>}</span>
      <span className={styles.historyHours}>{duration(entry.workedMinutes) ?? '—'}</span>
      <span className={styles.historyLeads} title="Automatic leads that day">{num(entry.assigned)} leads</span>
      {entry.late && <span className={styles.tag} data-tone="warn">Late</span>}
    </li>)}
  </ul>;
}

export default function CheckIn() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const employee = admin?.role === 'employee' && !admin?.isOwner;
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const [figures, setFigures] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);
  const dialog = useRef(null);
  const state = stateOf(me);
  const now = useNow(state === 'in' || open);

  const adminId = admin?.id;
  // Also opens the popup by itself the first time in a day that an employee is seen without a check-in.
  const loadMe = useCallback(() => request('/lead-distribution/me').then((data) => {
    setMe(data);
    if (!data.canCheckIn || data.checkedInAt || data.checkedOutAt) return;
    const key = `gv-checkin-prompt:${adminId}:${data.day}`;
    if (readFlag(key)) return;
    writeFlag(key);
    setOpen(true);
  }).catch(() => {}), [request, adminId]);
  const close = useCallback(() => { setOpen(false); setError(''); }, []);
  const loadDetails = useCallback(() => {
    request('/lead-distribution/status').then(setFigures).catch((problem) => setError(problem.message));
    request('/lead-distribution/history?limit=8').then((data) => setHistory(data.items)).catch(() => setHistory([]));
  }, [request]);

  // Button state: on load, every 5 minutes while the tab is visible, on focus and when the dashboard card acts.
  useEffect(() => {
    if (!employee) return undefined;
    const refresh = () => { if (document.visibilityState !== 'hidden') loadMe(); };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener(ATTENDANCE_EVENT, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener(ATTENDANCE_EVENT, refresh); };
  }, [employee, loadMe]);

  useEffect(() => {
    if (!open) return undefined;
    loadDetails();
    dialog.current?.focus();
    const away = (event) => { if (!box.current?.contains(event.target)) close(); };
    const key = (event) => { if (event.key === 'Escape') { close(); box.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open, loadDetails, close]);

  async function act(kind) {
    setBusy(true); setError('');
    try {
      const result = await request(`/lead-distribution/${kind}`, { method: 'POST' });
      setFigures(result);
      const again = (result.sessionCount ?? 1) > 1;
      if (kind === 'check-in') {
        toast.success(result.late ? `Checked in${again ? ' again' : ''}. Your first check-in was after the cutoff, so no automatic leads today — work your pending leads.`
          : result.notInRoster ? 'Checked in. You joined after today’s roster was set; ask your admin for leads.'
            : again ? 'Checked in again. New leads will be assigned to you again.' : 'Checked in. Your share of today’s leads is being assigned.');
      } else toast.success('Checked out. No new leads will come to you until you check in again; your pending leads stay with you.');
      await loadMe();
      request('/lead-distribution/history?limit=8').then((data) => setHistory(data.items)).catch(() => {});
      window.dispatchEvent(new window.Event(ATTENDANCE_EVENT));
    } catch (problem) {
      setError(problem.message);
      loadMe();
    } finally { setBusy(false); }
  }

  if (!employee) return null;
  const worked = duration(workedNow(me, now));
  const sessions = sessionsOf(me);
  const label = state === 'in' ? 'On duty' : state === 'out' ? 'Checked out' : 'Check in';
  const lateWarning = state === 'none' && me?.cutoffPassed;
  const onDutySince = me?.onDutySince ?? sessions.at(-1)?.inAt;

  return <div className={styles.wrap} ref={box}>
    <button type="button" className={styles.trigger} data-state={state} data-late={lateWarning || undefined}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
      aria-label={state === 'in' ? `On duty since ${clock(onDutySince)}, ${worked} today. Open check-in` : state === 'out' ? `Checked out at ${clock(me.checkedOutAt)}. Open to check in again` : 'Check in for today'}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.triggerLabel}>{label}</span>
      {state !== 'none' && worked && <span className={styles.triggerTime}>{worked}</span>}
    </button>

    {open && <div ref={dialog} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="false" aria-labelledby="gv-checkin-title">
      <header className={styles.head} data-state={state}>
        <div>
          <p className={styles.eyebrow}>{me?.day ? dayLabel(me.day, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Today'}</p>
          <h2 id="gv-checkin-title">{state === 'in' ? 'You are on duty' : state === 'out' ? 'You are checked out' : 'Start your day'}</h2>
        </div>
        <button type="button" className={styles.close} onClick={close} aria-label="Close"><Icon name="close" /></button>
      </header>

      <div className={styles.body}>
        <dl className={styles.times}>
          <div><dt>First check-in</dt><dd>{clock(me?.checkedInAt)}</dd></div>
          <div><dt>{state === 'in' ? 'On duty since' : state === 'out' ? 'Checked out' : 'Work ends'}</dt>
            <dd>{state === 'in' ? clock(onDutySince) : state === 'out' ? clock(me.checkedOutAt) : me?.workEndTime ?? '—'}</dd></div>
          <div><dt>Time worked</dt><dd>{worked ?? '—'}</dd></div>
        </dl>

        {sessions.length > 0 && <section className={styles.today} aria-label="Today’s check-ins">
          <h3>Checked in {sessions.length === 1 ? 'once' : `${sessions.length} times`} today</h3>
          <ol>{sessions.map((session, index) => <li key={`${session.inAt}-${index}`} data-open={!session.outAt || undefined}>
            <span>{clock(session.inAt)} – {session.outAt ? clock(session.outAt) : 'now'}</span>
            <span>{duration(Math.max(0, Math.round(((session.outAt ? new Date(session.outAt) : now) - new Date(session.inAt)) / 60_000)))}</span>
          </li>)}</ol>
        </section>}

        <p className={styles.note} data-tone={lateWarning || me?.late ? 'warn' : 'info'}>
          <Icon name={lateWarning || me?.late ? 'alert' : 'clock'} />
          <span>{state === 'none'
            ? (me?.cutoffPassed ? `The ${clock(me.cutoffAt)} cutoff has passed. You can still check in and work your pending leads, but no automatic leads will be added today.`
              : `Check in before ${clock(me?.cutoffAt)} IST to receive your share of today’s automatic leads.`)
            : state === 'in' ? (me.late ? 'You checked in after the cutoff: no automatic leads today.' : me.notInRoster ? 'You were not on today’s roster: ask your admin for a manual assignment.' : 'Your automatic leads for today are in Pending leads.')
              : me?.late || !me?.eligible ? 'Your pending leads stay with you. Check in again whenever you are back.'
                : 'While you are checked out, no new leads are assigned to you. Your pending leads stay with you. Check in again whenever you are back.'}</span>
        </p>

        <dl className={styles.figures}>
          <div data-tone="warn"><dt>On-time share</dt><dd>{num(figures?.baseline)}</dd></div>
          <div data-tone="good"><dt>Assigned today</dt><dd>{num(figures?.assignedToday)}</dd></div>
          <div data-tone="info"><dt>Pending leads</dt><dd>{num(figures?.pending)}</dd></div>
        </dl>

        {error && <p className={styles.note} data-tone="bad" role="alert"><Icon name="alert" /><span>{error}</span></p>}

        {state !== 'in' && <button type="button" className={`adm-btn adm-btn--primary ${styles.primary}`} disabled={busy || !me} onClick={() => act('check-in')}>
          <Icon name="checkCircle" />{busy ? 'Checking in…' : state === 'out' ? 'Check in again' : 'Check in now'}
        </button>}
        {state === 'in' && <button type="button" className={`adm-btn ${styles.primary}`} disabled={busy} onClick={() => act('check-out')}>
          <Icon name="logout" />{busy ? 'Checking out…' : 'Check out'}
        </button>}
        {state === 'in' && <p className={styles.hint}>Checking out pauses new leads until you check in again. You can check in and out as often as you need.</p>}

        <section className={styles.recent} aria-label="Recent days">
          <h3><Icon name="history" />Recent days</h3>
          <History items={history?.filter((entry) => entry.day !== me?.day)} />
        </section>
      </div>

      <Link href="/admin/leads/pending" className={styles.foot} onClick={close}>Open pending leads<Icon name="arrow" /></Link>
    </div>}
  </div>;
}

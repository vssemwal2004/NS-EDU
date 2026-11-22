'use client';
// Daily lead distribution: the owner sees today's batch and the roster; an employee checks in / out for their share.
// Same data and actions as before (GET /lead-distribution/status, POST /lead-distribution/check-in|check-out);
// laid out as figures + a status line + the roster table in the console style.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { useServerList } from './table/useServerList';
import { Panel } from './ui/Page';
import styles from './DistributionCard.module.css';

const time = (value) => value ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '';
const num = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : '—');

function Figures({ items }) {
  return <dl className={styles.figures}>
    {items.map(([label, value, tone]) => <div key={label} className="crm-tone" data-tone={tone}>
      <dt>{label}</dt><dd className="crm-tabnum">{value}</dd>
    </div>)}
  </dl>;
}

function Note({ tone = 'info', icon = 'alert', children, role }) {
  return <p className={`crm-tone ${styles.note}`} data-tone={tone} role={role}><Icon name={icon} /><span>{children}</span></p>;
}

const personState = (person) => (person.checkedOutAt ? ['Checked out', 'neutral'] : person.checkedInAt ? (person.late ? ['Late', 'warn'] : ['Checked in', 'good']) : ['Not checked in', 'neutral']);

export default function DistributionCard() {
  const { admin, request } = useAdminSession();
  const { data, error, reload } = useServerList(request, '/lead-distribution/status', {}, { scope: admin?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(reload, 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  async function act(kind) {
    setBusy(true); setActionError(''); setMessage('');
    try {
      const result = await request(`/lead-distribution/${kind}`, { method: 'POST' });
      setMessage(kind === 'check-in' ? result.late ? 'Checked in late. Work your pending leads; no automatic leads will be added today.' : result.notInRoster ? 'Checked in. You were added after today’s roster was set; ask the admin for a manual assignment.' : 'Checked in. Your initial share is being assigned.' : 'Checked out. Pending leads remain assigned to you.');
      reload();
    } catch (problem) { setActionError(problem.message); }
    finally { setBusy(false); }
  }

  if (!admin) return null;
  if (admin.isOwner) return <Panel title="Daily lead distribution" description="Yesterday’s unassigned new leads are distributed to employees who check in on time."
    actions={<Link className="adm-btn adm-btn--sm" href="/admin/settings"><Icon name="clock" />Set times</Link>}>
    {error ? <Note tone="bad" role="alert">{error}</Note> : !data ? <p className={styles.loading}>Loading distribution…</p> : <div className={styles.body}>
      <Figures items={[
        [`Leads from ${data.sourceDay ?? 'yesterday'}`, num(data.initialCount), 'info'],
        ['Employees on the roster', num(data.rosterCount), 'purple'],
        ['Initial share each', num(data.baseline), 'warn'],
        ['Checked in', num(data.finalized ? data.checkedInCount : data.currentlyCheckedIn), 'good'],
      ]} />
      <p className={styles.status}>
        <span className={styles.pill} data-state={data.finalized ? 'done' : 'waiting'}>{data.finalized ? 'Finalised' : 'Waiting for the cutoff'}</span>
        Check-in cutoff <strong>{time(data.cutoffAt) || '—'} IST</strong>
      </p>
      {data.finalized && data.remaining > 0 && <Note tone="bad" role="alert"><strong>{num(data.remaining)} leads remain unassigned.</strong> No eligible employee was available. <Link href="/admin/leads?assignee=unassigned">Assign them manually</Link>.</Note>}
      {data.olderUnassigned > 0 && <Note tone="warn" role="alert"><strong>{num(data.olderUnassigned)} older leads are still unassigned.</strong> They are outside today’s batch. <Link href="/admin/leads?assignee=unassigned">Review the backlog</Link>.</Note>}
      {data.employees?.length > 0 && <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Employee</th><th>Today</th><th className={styles.num}>Automatic leads</th></tr></thead>
        <tbody>{data.employees.map((person) => {
          const [label, tone] = personState(person);
          return <tr key={person.id}><td>{person.name}</td>
            <td><span className={`crm-tone ${styles.chip}`} data-tone={tone}>{label}</span></td>
            <td className={`${styles.num} crm-tabnum`}>{num(person.assignedToday)}</td></tr>;
        })}</tbody>
      </table></div>}
    </div>}
  </Panel>;

  const checkedIn = Boolean(data?.checkedInAt) && !data?.checkedOutAt;
  return <Panel title="Check in for today’s leads" description={`Today’s batch contains new leads from ${data?.sourceDay ?? 'yesterday'}. Leads generated today wait until tomorrow.`}
    actions={<Link className="adm-btn adm-btn--sm" href="/admin/leads/pending"><Icon name="inbox" />Pending leads</Link>}>
    {error ? <Note tone="bad" role="alert">{error}</Note> : !data ? <p className={styles.loading}>Loading check-in…</p> : <div className={styles.body}>
      <div className={styles.checkin} data-state={data.checkedOutAt ? 'out' : checkedIn ? 'in' : 'none'}>
        <span className={styles.checkIcon} aria-hidden="true"><Icon name={checkedIn ? 'check' : data.checkedOutAt ? 'logout' : 'clock'} /></span>
        <div className={styles.checkText}>
          <strong>{data.checkedOutAt ? `Checked out at ${time(data.checkedOutAt)}` : checkedIn ? `Checked in at ${time(data.checkedInAt)}` : `Check in by ${time(data.cutoffAt) || '—'} IST`}</strong>
          <span>{data.checkedOutAt ? 'Your pending leads remain in your list.'
            : checkedIn ? (data.late ? 'Late check-in: no automatic leads today.' : data.notInRoster ? 'Not on today’s roster: ask for a manual assignment.' : `Expected work end: ${data.workEndTime ?? '—'} IST`)
              : data.cutoffPassed ? 'The cutoff has passed. You can still check in and work older pending leads.' : 'Check in to receive today’s automatic share.'}</span>
        </div>
        {!data.checkedOutAt && <button type="button" className={`adm-btn ${checkedIn ? '' : 'adm-btn--primary'}`} disabled={busy} onClick={() => act(checkedIn ? 'check-out' : 'check-in')}>
          {busy ? 'Saving…' : checkedIn ? 'Check out' : 'Check in'}
        </button>}
      </div>
      <Figures items={[
        ['On-time share', num(data.baseline), 'warn'],
        ['Assigned to you today', num(data.assignedToday), 'good'],
        ['Pending leads', num(data.pending), 'info'],
      ]} />
      {message && <Note tone="good" icon="checkCircle" role="status">{message}</Note>}
      {actionError && <Note tone="bad" role="alert">{actionError}</Note>}
    </div>}
  </Panel>;
}

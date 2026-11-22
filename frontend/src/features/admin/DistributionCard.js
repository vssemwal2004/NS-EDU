'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminSession } from './AdminSession';
import { useServerList } from './table/useServerList';
import { Panel } from './ui/Page';

const time = (value) => value ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '';

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
  if (admin.isOwner) return <Panel title="Daily lead distribution" description="Yesterday’s unassigned new leads are distributed to employees who check in on time." actions={<Link href="/admin/settings">Set times</Link>}>
    {error ? <p role="alert">{error}</p> : !data ? <p>Loading distribution…</p> : <>
      <p><strong>{data.initialCount}</strong> leads from {data.sourceDay} · <strong>{data.rosterCount}</strong> employees · initial share <strong>{data.baseline}</strong> each.</p>
      <p>Check-in cutoff: {time(data.cutoffAt)} IST. {data.finalized ? `Finalized with ${data.checkedInCount} checked in.` : `${data.currentlyCheckedIn} checked in now; waiting for the cutoff.`}</p>
      {data.finalized && data.remaining > 0 && <p role="alert"><strong>{data.remaining} leads remain unassigned.</strong> No eligible employee was available for them. <Link href="/admin/leads?assignee=unassigned">Assign them manually</Link>.</p>}
      {data.olderUnassigned > 0 && <p role="alert"><strong>{data.olderUnassigned} older leads are still unassigned.</strong> These are outside today’s automatic batch. <Link href="/admin/leads?assignee=unassigned">Review the backlog</Link>.</p>}
      {data.employees?.length > 0 && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr><th>Employee</th><th>Today</th><th>Automatic leads</th></tr></thead>
        <tbody>{data.employees.map((person) => <tr key={person.id}><td>{person.name}</td>
          <td>{person.checkedOutAt ? 'Checked out' : person.checkedInAt ? person.late ? 'Late' : 'Checked in' : 'Not checked in'}</td>
          <td>{person.assignedToday}</td></tr>)}</tbody>
      </table></div>}
    </>}
  </Panel>;

  return <Panel title="Check in for today’s leads" description={`Today’s batch contains new leads from ${data?.sourceDay ?? 'yesterday'}. Leads generated today wait until tomorrow.`} actions={<Link href="/admin/leads/pending">Pending leads</Link>}>
    {error ? <p role="alert">{error}</p> : !data ? <p>Loading check-in…</p> : <>
      <p>Check in by <strong>{time(data.cutoffAt)} IST</strong>. Expected work end: <strong>{data.workEndTime} IST</strong>.</p>
      <p>On-time initial share: <strong>{data.baseline}</strong> · Assigned automatically today: <strong>{data.assignedToday}</strong> · Pending leads: <strong>{data.pending}</strong>.</p>
      {data.checkedOutAt ? <p>Checked out at {time(data.checkedOutAt)}. Your pending leads remain in your list.</p>
        : data.checkedInAt ? <p>Checked in at {time(data.checkedInAt)}{data.late ? ' · late check-in: no automatic leads today' : data.notInRoster ? ' · not on today’s roster: ask for a manual assignment' : ''}.</p>
          : <p>{data.cutoffPassed ? 'The cutoff has passed. You can check in and work older pending leads; ask the admin for new manual assignments.' : 'Check in to receive today’s automatic share. You can work older pending leads at any time.'}</p>}
      {!data.checkedOutAt && <button type="button" className="adm-btn adm-btn--primary" disabled={busy} onClick={() => act(data.checkedInAt ? 'check-out' : 'check-in')}>
        {busy ? 'Saving…' : data.checkedInAt ? 'Check out' : 'Check in'}
      </button>}
      {message && <p role="status">{message}</p>}
      {actionError && <p role="alert">{actionError}</p>}
    </>}
  </Panel>;
}

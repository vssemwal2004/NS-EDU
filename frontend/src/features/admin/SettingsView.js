'use client';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useAdminSession } from './AdminSession';
import { dateTimeOf, timeOf } from './crm/format';
import { Avatar } from './crm/ui';
import { PageToolbar, Panel } from './ui/Page';
import styles from './Settings.module.css';

// /platform/stats also returns objects (courseCounts, fieldCounts) for the public pages; only these
// whole-number totals are shown here. Rendering every entry put an object into JSX and crashed the page.
const PUBLISHED = [
  { key: 'institutions', label: 'Universities and colleges' },
  { key: 'programmes', label: 'Programmes' },
  { key: 'courses', label: 'Courses' },
  { key: 'exams', label: 'Exam guides' },
  { key: 'scholarships', label: 'Scholarships' },
  { key: 'cities', label: 'Cities' },
  { key: 'states', label: 'States' },
  { key: 'statesWithInstitutions', label: 'States with a listed college' },
];

// Static notes about how this deployment is configured (not live checks).
const CHECKLIST = [
  { key: 'password', label: 'Owner password', text: <>Replace the demo password: set <code>ADMIN_PASSWORD</code>, then run the seed with <code>--reset-admin</code></> },
  { key: 'otp', label: 'Email and SMS', text: <>One-time codes print to the API console while <code>OTP_DELIVERY=console</code></> },
  { key: 'limits', label: 'Rate limits', text: 'Kept in memory; they reset when the API restarts' },
];
export default function SettingsView() {
  const { admin, logout } = useAdminSession();
  const [health, setHealth] = useState({ state: 'checking', at: null });
  const [stats, setStats] = useState({ state: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const started = window.performance.now();
    api('/health', { signal: controller.signal })
      .then(() => setHealth({ state: 'ok', at: new Date(), ms: Math.round(window.performance.now() - started) }))
      .catch((error) => { if (error.name !== 'AbortError') setHealth({ state: 'down', at: new Date(), error: error.message }); });
    api('/platform/stats', { signal: controller.signal })
      .then((data) => setStats({ state: 'ready', data }))
      .catch((error) => { if (error.name !== 'AbortError') setStats({ state: 'error', data: null, error: error.message }); });
    return () => controller.abort();
  }, [attempt]);
  const recheck = useCallback(() => { setHealth({ state: 'checking', at: null }); setStats({ state: 'loading', data: null }); setAttempt((value) => value + 1); }, []);

  const counts = stats.data ? PUBLISHED.filter((row) => Number.isFinite(stats.data[row.key])) : PUBLISHED;
  const apiTone = health.state === 'ok' ? 'good' : health.state === 'down' ? 'bad' : 'neutral';

  return <>
    <PageToolbar summary={<>Signed in as <strong>{admin?.email}</strong></>}>
      <button type="button" className="adm-btn" onClick={recheck} disabled={health.state === 'checking'}><Icon name="refresh" />Check again</button>
      <button type="button" className="adm-btn" onClick={logout}><Icon name="logout" />Log out</button>
    </PageToolbar>

    <div className={styles.grid}>
      <Panel title="Your account" meta="Session ends after 8 hours">
        <dl className={styles.sheet}>
          <dt>Name</dt><dd><Avatar name={admin?.name} email={admin?.email} size={20} /><span>{admin?.name || '—'}</span></dd>
          <dt>Email</dt><dd>{admin?.email || '—'}</dd>
          <dt>Role</dt><dd>{admin?.roleName || <span className={styles.muted}>—</span>}</dd>
          <dt>Job title</dt><dd>{admin?.title || <span className={styles.muted}>—</span>}</dd>
          <dt>Last sign-in</dt><dd className="crm-tabnum">{admin?.lastLoginAt ? dateTimeOf(admin.lastLoginAt) : <span className={styles.muted}>—</span>}</dd>
          <dt>Permissions</dt><dd className="crm-tabnum">{admin?.isOwner ? 'All (owner)' : `${admin?.permissions?.length ?? 0} granted`}</dd>
        </dl>
      </Panel>

      <Panel title="Platform status" meta={health.at ? `Checked ${timeOf(health.at)}` : undefined}>
        <dl className={styles.sheet}>
          <dt>API</dt>
          <dd role="status"><span className={`crm-tone ${styles.dot}`} data-tone={apiTone} aria-hidden="true" />
            {health.state === 'checking' ? 'Checking…' : health.state === 'ok' ? <>Online <span className={styles.muted}>· answered in <span className="crm-tabnum">{health.ms}</span> ms</span></> : <>Unreachable <span className={styles.muted}>· {health.error}</span></>}</dd>
        </dl>
        <h3 className={styles.subhead}>Published records</h3>
        {stats.state === 'error' ? <p className="adm-error" role="alert">Could not load published counts: {stats.error}</p> : <dl className={styles.counts}>
          {counts.map((row) => <div key={row.key}>
            <dt>{row.label}</dt>
            <dd className="crm-tabnum">{stats.data ? stats.data[row.key].toLocaleString('en-IN') : <span className={styles.skeleton} />}</dd>
          </div>)}
        </dl>}
      </Panel>
    </div>

    <Panel title="Before going live" description="How this deployment is set up today. Change these before real students sign in.">
      <dl className={styles.sheet}>
        {CHECKLIST.map((item) => <div key={item.key} className={styles.sheetRow}><dt>{item.label}</dt><dd className={styles.note}>{item.text}</dd></div>)}
      </dl>
    </Panel>  </>;
}

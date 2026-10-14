'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useAdminSession } from './AdminSession';
import styles from './Dashboard.module.css';

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function SettingsView() {
  const { admin, logout } = useAdminSession();
  const [health, setHealth] = useState({ state: 'checking' });
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api('/health', { signal: controller.signal }).then((data) => setHealth({ state: 'ok', data })).catch((error) => { if (error.name !== 'AbortError') setHealth({ state: 'down', error: error.message }); });
    api('/platform/stats', { signal: controller.signal }).then(setStats).catch(() => {});
    return () => controller.abort();
  }, []);

  return <div className={styles.dashboard}>
    <div className={styles.row}>
      <section className={styles.card} aria-labelledby="profile-title">
        <header className={styles.cardHeader}><div><h3 id="profile-title">Your admin session</h3><p>Signed in with an http-only JWT cookie (8-hour lifetime).</p></div></header>
        <dl className={styles.health}>
          <div><dt><Icon name="user" />Name</dt><dd>{admin?.name || '—'}</dd></div>
          <div><dt><Icon name="mail" />Email</dt><dd className={styles.smallValue}>{admin?.email}</dd></div>
          <div><dt><Icon name="calendar" />Last sign-in</dt><dd className={styles.smallValue}>{admin?.lastLoginAt ? dateTime.format(new Date(admin.lastLoginAt)) : '—'}</dd></div>
          <div><dt><Icon name="shield" />Role</dt><dd className={styles.smallValue}>Administrator</dd></div>
        </dl>
        <button type="button" className="button button--outline" onClick={logout}><Icon name="logout" />Log out of the console</button>
      </section>
      <section className={styles.card} aria-labelledby="status-title">
        <header className={styles.cardHeader}><div><h3 id="status-title">Platform status</h3><p>Live checks against the NSEDU API</p></div></header>
        <dl className={styles.health}>
          <div><dt><Icon name="trend" />API</dt><dd className={styles.smallValue}><span className={styles.status} data-status={health.state === 'down' ? 'blocked' : 'active'}>{health.state === 'checking' ? 'Checking…' : health.state === 'ok' ? 'Online' : 'Unreachable'}</span></dd></div>
          {stats && Object.entries(stats).map(([key, value]) => <div key={key}><dt><Icon name="layers" />Published {key}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
    <section className={styles.card} aria-labelledby="security-title">
      <header className={styles.cardHeader}><div><h3 id="security-title">Before going live</h3><p>Items that are intentionally development-only today</p></div></header>
      <ul className={styles.checklist}>
        <li><Icon name="lock" /><span><strong>Change the demo admin password.</strong> Run the seed script with <code>--reset-admin</code> after setting a strong <code>ADMIN_PASSWORD</code> in the backend environment.</span></li>
        <li><Icon name="mail" /><span><strong>Connect email and SMS delivery.</strong> One-time codes are printed to the API console while <code>OTP_DELIVERY=console</code>.</span></li>
        <li><Icon name="shield" /><span><strong>Use a shared rate-limit store.</strong> Login limits are kept in memory and reset when the API restarts.</span></li>
      </ul>
    </section>
  </div>;
}

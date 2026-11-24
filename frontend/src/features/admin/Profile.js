'use client';
// My profile: an identity hero, editable details (name and mobile — PATCH /access/me), security and session,
// today's follow-up numbers, and the person's own recent activity.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import ActivityFeed from './activity/ActivityFeed';
import { can, canAny } from './crm/meta';
import { initialsOf, relativeTime } from './crm/format';
import styles from './Profile.module.css';

const PHONE = /^\+?[0-9]{10,15}$/;
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const LEADS = ['leads.view_own', 'leads.view_team', 'leads.view_all'];

export default function Profile() {
  const { admin, request, refreshAdmin, logout } = useAdminSession();
  const [name, setName] = useState(admin?.name ?? '');
  const [phone, setPhone] = useState(admin?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!can(admin, 'leads.notes')) return undefined;
    const controller = new AbortController();
    request('/crm/tasks/counts', { signal: controller.signal }).then((data) => setCounts(data.counts ?? null)).catch(() => {});
    return () => controller.abort();
  }, [admin, request]);

  const changed = name.trim() !== (admin?.name ?? '') || phone.trim() !== (admin?.phone ?? '');
  const phoneInvalid = phone.trim() !== '' && !PHONE.test(phone.trim());

  async function save(event) {
    event.preventDefault();
    if (phoneInvalid) { setError('Enter a valid mobile number: 10 to 15 digits, optionally starting with +.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await request('/access/me', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } });
      await refreshAdmin();
      setMessage('Your profile is saved.');
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  if (!admin) return null;
  const role = admin.isOwner ? 'Owner' : admin.roleName || 'Employee';
  return <div className={styles.page}>
    <section className={styles.hero}>
      <span className={styles.avatar} aria-hidden="true">{initialsOf(admin.name || admin.email)}</span>
      <div className={styles.identity}>
        <h1>{admin.name || 'Add your name'}</h1>
        <p className={styles.role}>{role}{admin.title ? ` · ${admin.title}` : ''}</p>
        <p className={styles.meta}>
          <span><Icon name="mail" />{admin.email}</span>
          {admin.phone && <span><Icon name="phone" />{admin.phone}</span>}
          {admin.lastLoginAt && <span><Icon name="clock" />Signed in {relativeTime(admin.lastLoginAt)}</span>}
          {admin.createdAt && <span><Icon name="calendar" />Member since {date.format(new Date(admin.createdAt))}</span>}
        </p>
      </div>
      <div className={styles.heroActions}>
        <Link href="/admin/change-password" className="adm-btn"><Icon name="lock" />Change password</Link>
      </div>
    </section>

    {counts && <ul className={styles.stats} aria-label="Your follow-ups">
      <li className="crm-tone" data-tone="bad"><Link href="/admin/my-day"><span>Overdue</span><strong className="crm-tabnum">{counts.overdue ?? 0}</strong></Link></li>
      <li className="crm-tone" data-tone="warn"><Link href="/admin/my-day"><span>Due today</span><strong className="crm-tabnum">{counts.today ?? 0}</strong></Link></li>
      <li className="crm-tone" data-tone="info"><Link href="/admin/my-day"><span>Upcoming</span><strong className="crm-tabnum">{counts.upcoming ?? 0}</strong></Link></li>
    </ul>}

    <div className={styles.grid}>
      <div className={styles.column}>
        <section className={styles.card}>
          <header><h3>Your details</h3><p>How your name and number appear to the team and on lead histories.</p></header>
          <form onSubmit={save} className={styles.form} noValidate>
            <label className="adm-label">Full name
              <input className="adm-input" value={name} maxLength={80} autoComplete="name" onChange={(event) => { setName(event.target.value); setMessage(''); }} />
            </label>
            <label className="adm-label">Mobile number
              <input className="adm-input" type="tel" value={phone} maxLength={16} autoComplete="tel" placeholder="+91…" aria-invalid={phoneInvalid || undefined} onChange={(event) => { setPhone(event.target.value); setMessage(''); }} />
              {phoneInvalid && <span className="adm-error">10 to 15 digits, optionally starting with +.</span>}
            </label>
            <label className="adm-label">Email
              <span className={styles.readonly}><Icon name="lock" />{admin.email}</span>
              <span className="adm-hint">Your sign-in email. Ask an owner to change it.</span>
            </label>
            {error && <p className={styles.alert} role="alert"><Icon name="alert" />{error}</p>}
            {message && <p className={styles.saved} role="status"><Icon name="checkCircle" />{message}</p>}
            <div className={styles.formActions}>
              <button type="button" className="adm-btn adm-btn--ghost" disabled={!changed || busy} onClick={() => { setName(admin.name ?? ''); setPhone(admin.phone ?? ''); setError(''); }}>Reset</button>
              <button type="submit" className="adm-btn adm-btn--primary" disabled={!changed || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <header><h3>Security and session</h3></header>
          <ul className={styles.rows}>
            <li><span className={styles.rowIcon}><Icon name="lock" /></span><span><strong>Password</strong><small>Use at least 10 characters you do not use elsewhere.</small></span><Link href="/admin/change-password" className="adm-btn adm-btn--sm">Change</Link></li>
            <li><span className={styles.rowIcon}><Icon name="clock" /></span><span><strong>Session</strong><small>You are signed out automatically after 8 hours.</small></span><button type="button" className="adm-btn adm-btn--sm" onClick={logout}><Icon name="logout" />Log out</button></li>
            {can(admin, 'team.view') && <li><span className={styles.rowIcon}><Icon name="shield" /></span><span><strong>Access</strong><small>What your role allows in the console.</small></span><Link href="/admin/access?tab=you" className="adm-btn adm-btn--sm">View</Link></li>}
          </ul>
        </section>
      </div>

      {canAny(admin, LEADS) && <section className={`${styles.card} ${styles.activity}`}>
        <header className={styles.activityHead}><div><h3>My recent activity</h3><p>Calls, messages, notes and stage moves you logged.</p></div><Link href="/admin/activity" className={styles.link}>Activity log<Icon name="arrow" /></Link></header>
        <div className={styles.activityBody}><ActivityFeed mine compact limit={12} /></div>
      </section>}
    </div>
  </div>;
}

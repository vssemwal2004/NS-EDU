'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { homeFor } from '@/data/admin-navigation';
// Outside the console layout, so it loads the console tokens itself.
import '@/features/admin/crm/crm-tokens.css';
import styles from './StaffForms.module.css';

export default function ChangePassword() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [state, setState] = useState({ checking: true, busy: false, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal }).then(({ admin }) => {
      if (!admin.mustChangePassword) router.replace(homeFor(admin));
      else setState((previous) => ({ ...previous, checking: false }));
    }).catch((error) => {
      if (error.name !== 'AbortError') router.replace('/admin');
    });
    return () => controller.abort();
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setState({ checking: false, busy: false, error: 'New passwords do not match.' }); return; }
    setState({ checking: false, busy: true, error: '' });
    try {
      const { admin } = await api('/admin/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      router.replace(homeFor(admin));
    } catch (error) { setState({ checking: false, busy: false, error: error.message }); }
  }

  return <main className={styles.passwordPage}>
    <div className={styles.column}>
      <header className={styles.brand}><Brand priority /><span>Admin console</span></header>
      <section className={styles.card} aria-labelledby="change-password-title">
        <h1 id="change-password-title">Change your password</h1>
        <p className={styles.lead}>Before opening the console, replace the temporary password your owner set.</p>
        <form className={styles.form} onSubmit={submit}>
          <label className="adm-label"><span>Temporary password <span className={styles.required} aria-hidden="true">*</span></span>
            <input className="adm-input" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
          </label>
          <label className="adm-label"><span>New password <span className={styles.required} aria-hidden="true">*</span></span>
            <input className="adm-input" type="password" autoComplete="new-password" minLength={8} maxLength={200} required aria-describedby="password-rules" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
            <span id="password-rules" className="adm-hint">8+ characters with upper-case, lower-case and a special character.</span>
          </label>
          <label className="adm-label"><span>Confirm new password <span className={styles.required} aria-hidden="true">*</span></span>
            <input className="adm-input" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
          </label>
          {state.error && <p className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
          <button className={`adm-btn adm-btn--primary ${styles.submit}`} type="submit" disabled={state.checking || state.busy}>{state.checking ? 'Checking session…' : state.busy ? 'Saving…' : 'Change password'}</button>
        </form>
      </section>
    </div>
  </main>;
}

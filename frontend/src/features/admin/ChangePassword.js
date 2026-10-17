'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import styles from './StaffForms.module.css';

export default function ChangePassword() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [state, setState] = useState({ checking: true, busy: false, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal }).then(({ admin }) => {
      if (!admin.mustChangePassword) router.replace(admin.role === 'employee' ? '/admin/reference-students' : '/admin/dashboard');
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
      router.replace(admin.role === 'employee' ? '/admin/reference-students' : '/admin/dashboard');
    } catch (error) { setState({ checking: false, busy: false, error: error.message }); }
  }

  return <main className={styles.passwordPage}><section className={styles.card}>
    <h1>Change your password</h1>
    <p>Before opening the console, replace the temporary password set by your administrator.</p>
    <form className={styles.form} onSubmit={submit}>
      <label>Temporary password<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
      <p className={styles.hint}>Use at least 8 characters with an uppercase letter, a lowercase letter and a special character.</p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className="button button--primary" type="submit" disabled={state.checking || state.busy}>{state.checking ? 'Checking session…' : state.busy ? 'Saving…' : 'Change password'}</button>
    </form>
  </section></main>;
}

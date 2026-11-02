'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { canOpen, findAdminPage, homeFor } from '@/data/admin-navigation';
// The sign-in page sits outside the console layout, so it loads the console tokens itself.
import '@/features/admin/crm/crm-tokens.css';
import styles from './AdminLogin.module.css';

// A requested page is honoured only if the role may open it; otherwise the role's own home.
const destination = (admin, next) => (admin.mustChangePassword ? '/admin/change-password' : next && next !== '/admin' && canOpen(admin, findAdminPage(next)) ? next : homeFor(admin));

export default function AdminLogin({ next }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ busy: false, error: '', checking: true });

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal })
      .then(({ admin }) => router.replace(destination(admin, next)))
      .catch((error) => { if (error.name !== 'AbortError') setState((previous) => ({ ...previous, checking: false })); });
    return () => controller.abort();
  }, [next, router]);

  async function submit(event) {
    event.preventDefault();
    const email = form.email.trim();
    if (!email || !form.password) { setState({ busy: false, checking: false, error: 'Enter your email and password.' }); return; }
    setState({ busy: true, checking: false, error: '' });
    try {
      const { admin } = await api('/admin/auth/login', { method: 'POST', body: { email, password: form.password } });
      router.replace(destination(admin, next));
    } catch (error) {
      setState({ busy: false, checking: false, error: error.status === 429 ? error.message : error.status === 401 ? 'Invalid email or password.' : error.message });
      setForm((previous) => ({ ...previous, password: '' }));
    }
  }

  return <main className={styles.page}>
    <div className={styles.column}>
      <header className={styles.brand}><Brand priority /><span>Admin console</span></header>

      <section className={styles.card} aria-labelledby="admin-login-title">
        <h1 id="admin-login-title">Sign in</h1>
        <p className={styles.lead}>Authorised staff only. Sessions last 8 hours.</p>
        <form className={styles.form} onSubmit={submit} noValidate aria-busy={state.busy}>
          <label className="adm-label" htmlFor="admin-email">Email address</label>
          <span className={styles.inputWrap} data-invalid={Boolean(state.error)}>
            <Icon name="mail" />
            <input id="admin-email" type="email" autoComplete="username" inputMode="email" placeholder="you@example.com" value={form.email} maxLength={254}
              onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={state.busy} autoFocus aria-invalid={Boolean(state.error) || undefined} aria-describedby={state.error ? 'admin-login-error' : undefined} />
          </span>
          <label className="adm-label" htmlFor="admin-password">Password</label>
          <span className={styles.inputWrap} data-invalid={Boolean(state.error)}>
            <Icon name="lock" />
            <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={form.password} maxLength={200}
              onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={state.busy} aria-invalid={Boolean(state.error) || undefined} aria-describedby={state.error ? 'admin-login-error' : undefined} />
            <button type="button" className={styles.reveal} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button>
          </span>
          {state.error && <p id="admin-login-error" className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
          <button className={`adm-btn adm-btn--primary ${styles.submit}`} type="submit" disabled={state.busy || state.checking}>
            {state.busy && <span className={styles.spinner} aria-hidden="true" />}
            {state.checking ? 'Checking session…' : state.busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.back} href="/"><Icon name="arrow" />Back to Gyaan Vidhya</Link>
        <span>© {new Date().getFullYear()} Gyaan Vidhya</span>
      </footer>
    </div>
  </main>;
}

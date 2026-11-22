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
    const showForm = () => setState((previous) => ({ ...previous, checking: false }));
    api('/admin/auth/session', { signal: controller.signal })
      .then(({ admin }) => {
        if (admin) router.replace(destination(admin, next));
        else showForm();
      })
      .catch((error) => { if (error.name !== 'AbortError') showForm(); });
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
    <aside className={styles.frame}>
      <header className={styles.brand}><Brand priority /><span>Admin console</span></header>
      <svg className={styles.arches} viewBox="0 0 420 230" aria-hidden="true" focusable="false">
        <g opacity=".55"><path d="M10 230V120Q10 60 70 40Q130 60 130 120V230" /><path d="M150 230V100Q150 34 210 12Q270 34 270 100V230" /><path d="M290 230V120Q290 60 350 40Q410 60 410 120V230" /></g>
        <g opacity=".3"><path d="M30 230V128Q30 78 70 62Q110 78 110 128V230" /><path d="M172 230V108Q172 54 210 36Q248 54 248 108V230" /><path d="M310 230V128Q310 78 350 62Q390 78 390 128V230" /></g>
      </svg>
    </aside>

    <div className={styles.column}>
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

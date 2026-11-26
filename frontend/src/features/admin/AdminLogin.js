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
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(0);
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

  useEffect(() => {
    if (!challenge) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  async function submit(event) {
    event.preventDefault();
    const email = form.email.trim();
    if (!email || !form.password) { setState({ busy: false, checking: false, error: 'Enter your email and password.' }); return; }
    setState({ busy: true, checking: false, error: '' });
    try {
      const result = await api('/admin/auth/login', { method: 'POST', body: { email, password: form.password } });
      const at = Date.now();
      setChallenge({ token: result.challenge, email: result.email, expiresAt: at + result.expiresInSeconds * 1000, resendAt: at + result.resendInSeconds * 1000, devCode: result.devCode });
      setNow(at);
      setCode('');
      setForm((previous) => ({ ...previous, password: '' }));
      setState({ busy: false, checking: false, error: '' });
    } catch (error) {
      setState({ busy: false, checking: false, error: error.status === 429 ? error.message : error.status === 401 ? 'Invalid email or password.' : error.message });
      setForm((previous) => ({ ...previous, password: '' }));
    }
  }

  async function verify(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setState((previous) => ({ ...previous, error: 'Enter the 6-digit code.' })); return; }
    setState({ busy: true, checking: false, error: '' });
    try {
      const { admin } = await api('/admin/auth/login/verify', { method: 'POST', body: { challenge: challenge.token, code } });
      router.replace(destination(admin, next));
    } catch (error) {
      setState({ busy: false, checking: false, error: error.message });
      setCode('');
    }
  }

  async function resend() {
    setState({ busy: true, checking: false, error: '' });
    try {
      const result = await api('/admin/auth/login/resend', { method: 'POST', body: { challenge: challenge.token } });
      const at = Date.now();
      setChallenge((previous) => ({ ...previous, expiresAt: at + result.expiresInSeconds * 1000, resendAt: at + result.resendInSeconds * 1000, devCode: result.devCode }));
      setNow(at);
      setCode('');
      setState({ busy: false, checking: false, error: '' });
    } catch (error) {
      setState({ busy: false, checking: false, error: error.message });
    }
  }

  const expired = challenge && now >= challenge.expiresAt;
  const resendSeconds = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0;

  return <main className={`${styles.page} adm-workspace`}>
    <div className={styles.column}>
      <header className={styles.brand}><Brand priority /><span>Admin console</span></header>
      <section className={styles.card} aria-labelledby="admin-login-title">
        <h1 id="admin-login-title">{challenge ? 'Check your email' : 'Sign in'}</h1>
        <p className={styles.lead}>{challenge ? `Enter the 6-digit code sent to ${challenge.email}. It expires in 5 minutes.` : 'Authorised staff only. Sessions last 8 hours.'}</p>
        {challenge ? <form className={styles.form} onSubmit={verify} noValidate aria-busy={state.busy}>
          <label className="adm-label" htmlFor="admin-code">Email code</label>
          <span className={styles.inputWrap} data-invalid={Boolean(state.error)}>
            <Icon name="lock" />
            <input id="admin-code" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={state.busy || expired} autoFocus
              aria-invalid={Boolean(state.error) || undefined} aria-describedby={state.error ? 'admin-login-error' : undefined} />
          </span>
          {challenge.devCode && <p className={styles.hint}>Development code: <strong>{challenge.devCode}</strong></p>}
          {expired && <p className={styles.error}>This code has expired. Sign in again.</p>}
          {state.error && <p id="admin-login-error" className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>}
          <button className={`adm-btn adm-btn--primary ${styles.submit}`} type="submit" disabled={state.busy || expired || code.length !== 6}>
            {state.busy && <span className={styles.spinner} aria-hidden="true" />}
            {state.busy ? 'Verifying…' : 'Verify and sign in'}
          </button>
          <div className={styles.actions}>
            <button type="button" onClick={resend} disabled={state.busy || expired || resendSeconds > 0}>Resend code{resendSeconds > 0 && !expired ? ` in ${resendSeconds}s` : ''}</button>
            <button type="button" onClick={() => { setChallenge(null); setCode(''); setState({ busy: false, checking: false, error: '' }); }} disabled={state.busy}>Back to sign in</button>
          </div>
        </form> : <form className={styles.form} onSubmit={submit} noValidate aria-busy={state.busy}>
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
        </form>}
      </section>

      <footer className={styles.footer}>
        <Link className={styles.back} href="/"><Icon name="arrow" />Back to Gyaan Vidhya</Link>
        <span>© {new Date().getFullYear()} Gyaan Vidhya</span>
      </footer>
    </div>
  </main>;
}

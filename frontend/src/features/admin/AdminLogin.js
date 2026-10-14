'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { getHeroImage } from '@/lib/hero-image';
import { api } from '@/lib/api/client';
import styles from './AdminLogin.module.css';

const capabilities = [
  { icon: 'building', title: 'Colleges & programmes', text: 'Publish institutions, fees and placement data.' },
  { icon: 'book', title: 'Courses & exams', text: 'Keep the catalogue students search accurate.' },
  { icon: 'people', title: 'Student accounts', text: 'Monitor sign-ups and manage access.' },
  { icon: 'map', title: 'Locations & funding', text: 'Curate destinations and scholarship links.' },
];

export default function AdminLogin({ next }) {
  const router = useRouter();
  const photo = getHeroImage();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ busy: false, error: '', checking: true });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api('/admin/auth/me', { signal: controller.signal })
      .then(() => router.replace(next))
      .catch((error) => { if (error.name !== 'AbortError') setState((previous) => ({ ...previous, checking: false })); });
    api('/platform/stats', { signal: controller.signal }).then(setStats).catch(() => {});
    return () => controller.abort();
  }, [next, router]);

  async function submit(event) {
    event.preventDefault();
    const email = form.email.trim();
    if (!email || !form.password) { setState({ busy: false, checking: false, error: 'Enter your email and password.' }); return; }
    setState({ busy: true, checking: false, error: '' });
    try {
      await api('/admin/auth/login', { method: 'POST', body: { email, password: form.password } });
      router.replace(next);
    } catch (error) {
      setState({ busy: false, checking: false, error: error.status === 429 ? error.message : error.status === 401 ? 'Invalid email or password.' : error.message });
      setForm((previous) => ({ ...previous, password: '' }));
    }
  }

  const statItems = stats ? [
    { label: 'Programmes', value: stats.programmes },
    { label: 'Colleges', value: stats.institutions },
    { label: 'Courses', value: stats.courses },
  ] : [];

  return <main className={styles.page}>
    <section className={styles.showcase} aria-labelledby="admin-about">
      <svg className={styles.linework} viewBox="0 0 450 300" fill="none" aria-hidden="true"><path d="M25 230h390M60 230V120h110v110m-97-87h20v27H73zm48 0h20v27h-20zM82 230v-34h38v34M170 230V85h170v145M184 85l71-47 71 47M225 230v-55h60v55M190 108h26v33h-26zm51 0h26v33h-26zm51 0h26v33h-26zM340 230V120h60v110M360 140h20v30h-20zM55 247h345M205 66V45m100 21V45" /><circle cx="255" cy="75" r="8" /></svg>
      <header className={styles.brand}><span className={styles.brandMark}><Icon name="cap" /></span><span><strong>NSEDU</strong><small>Admin console</small></span></header>
      <div className={styles.showcaseBody}>
        <div className={styles.about}>
          <p className={styles.eyebrow}><Icon name="shield" />Platform administration</p>
          <h2 id="admin-about">The information students <em>rely on</em>, managed in one place.</h2>
          <p className={styles.aboutText}>NSEDU helps students across India discover colleges, compare programmes, check eligibility and plan their budget. Everything they see is published from this console.</p>
          <ul className={styles.capabilities}>{capabilities.map((item) => <li key={item.title}><span><Icon name={item.icon} /></span><div><strong>{item.title}</strong><small>{item.text}</small></div></li>)}</ul>
        </div>
        <figure className={styles.visual}>
          <svg className={styles.photo} viewBox="945 160 600 524" preserveAspectRatio="xMidYMid slice" role="img" aria-label={photo.alt}><image href={photo.src} x="0" y="0" width="1672" height="941" /></svg>
          <figcaption className={styles.floatCard}>
            <span className={styles.floatIcon}><Icon name="trend" /></span>
            <span><strong>{stats ? `${stats.programmes} programmes live` : 'Live catalogue'}</strong><small>Published to students instantly</small></span>
          </figcaption>
          {statItems.length > 0 && <dl className={styles.stats}>{statItems.map((item) => <div key={item.label}><dd>{item.value}</dd><dt>{item.label}</dt></div>)}</dl>}
        </figure>
      </div>
      <p className={styles.showcaseFooter}>© {new Date().getFullYear()} NSEDU · Discover · Learn · Belong</p>
    </section>

    <section className={styles.formSide} aria-labelledby="admin-login-title">
      <div className={styles.formCard}>
        <span className={styles.lockBadge}><Icon name="lock" /></span>
        <h1 id="admin-login-title">Welcome back</h1>
        <p className={styles.formLead}>Sign in to manage the NSEDU platform.</p>
        <form className={styles.form} onSubmit={submit} noValidate aria-busy={state.busy}>
          <label className={styles.field}><span>Email address</span>
            <span className={styles.inputWrap} data-invalid={Boolean(state.error)}><Icon name="mail" /><input type="email" autoComplete="username" inputMode="email" placeholder="admin@example.com" value={form.email} maxLength={254} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={state.busy} autoFocus /></span>
          </label>
          <label className={styles.field}><span>Password</span>
            <span className={styles.inputWrap} data-invalid={Boolean(state.error)}><Icon name="lock" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} maxLength={200} onChange={(event) => setForm({ ...form, password: event.target.value })} disabled={state.busy} />
              <button type="button" className={styles.reveal} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></span>
          </label>
          {state.error && <p className={styles.error} role="alert"><Icon name="shield" />{state.error}</p>}
          <button className={styles.submit} type="submit" disabled={state.busy || state.checking}>{state.busy && <span className={styles.spinner} aria-hidden="true" />}{state.checking ? 'Checking session…' : state.busy ? 'Signing in…' : 'Sign in'}{!state.busy && !state.checking && <Icon name="arrow" />}</button>
        </form>
        <p className={styles.secureNote}><Icon name="shield" />Authorised staff only. Sessions use signed, http-only tokens and expire after 8 hours.</p>
        <Link className={styles.back} href="/"><Icon name="arrow" />Back to NSEDU</Link>
      </div>
    </section>
  </main>;
}

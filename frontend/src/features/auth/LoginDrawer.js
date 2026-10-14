'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import LoginBrand from './LoginBrand';
import OtpInput from './OtpInput';
import { clock, DEFAULT_CODE_MINUTES, emailSuggestion, formatPhone, maskIdentifier, phoneDigits, readChannel, rememberChannel, validateIdentifier } from './login-helpers';
import styles from './LoginDrawer.module.css';

// Passwordless student login: identify → verify → (profile) → done.
// The API creates the account on first successful verification, so there is no sign-up path.
const channels = [
  { id: 'phone', label: 'Mobile', icon: 'phone' },
  { id: 'email', label: 'Email', icon: 'mail' },
];
const steps = {
  identify: { label: 'Step 1 of 2', detail: 'Get code', bar: 1, heading: 'Log in to your student space' },
  verify: { label: 'Step 2 of 2', detail: 'Verify', bar: 2, heading: 'Enter the 6-digit code' },
  profile: { label: 'Almost done', detail: 'Your profile', bar: 3, heading: 'Welcome to NSEDU' },
  done: { label: 'All set', detail: 'Signed in', bar: 3, heading: 'You’re signed in' },
  blocked: { label: 'Sign-in stopped', detail: '', bar: 2, heading: 'We couldn’t sign you in' },
};
const otherChannel = { phone: 'email', email: 'phone' };

export default function LoginDrawer() {
  const { loginOpen, closeLogin, signIn, setStudent, student } = useStudentAuth();
  const { courses, cityNames } = useCatalog();
  const preferences = usePreferences();
  const id = useId();
  const dialog = useRef(null);
  const identifierRef = useRef(null);
  const otpRef = useRef(null);
  const nameRef = useRef(null);
  const doneRef = useRef(null);
  const timers = useRef([]);
  const submitting = useRef(false);
  const pressedBackdrop = useRef(false);

  const [openState, setOpenState] = useState({ open: false, seen: false });
  const [channel, setChannel] = useState('phone');
  const [values, setValues] = useState({ phone: '', email: '' });
  const [fieldError, setFieldError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('identify');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [profile, setProfile] = useState({ name: '', course: '', city: '' });
  const [now, setNow] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);

  // First open: restore the last channel used on this device (adjusting state during render, not in an effect).
  if (openState.open !== loginOpen) {
    setOpenState({ open: loginOpen, seen: openState.seen || loginOpen });
    if (loginOpen && !openState.seen) setChannel(readChannel());
  }

  useEffect(() => {
    const node = dialog.current;
    if (loginOpen && !node.open) node.showModal();
    if (!loginOpen && node.open) node.close();
  }, [loginOpen]);
  // Focus the control that matters for each step (never the Close button).
  useEffect(() => {
    if (!loginOpen) return;
    const targets = { identify: identifierRef.current, verify: otpRef.current?.querySelector('input:not(:disabled)'), profile: nameRef.current, done: doneRef.current, blocked: doneRef.current };
    targets[step]?.focus();
  }, [loginOpen, step, focusRequest]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const ticking = loginOpen && (step === 'verify' || cooldownLeft > 0);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const minutes = Math.round((challenge?.expiresInSeconds || DEFAULT_CODE_MINUTES * 60) / 60);
  const secondsLeft = (seconds) => challenge ? Math.max(0, Math.ceil((challenge.sentAt + seconds * 1000 - now) / 1000)) : 0;
  const expiresLeft = secondsLeft(challenge?.expiresInSeconds);
  const resendLeft = Math.max(secondsLeft(challenge?.resendInSeconds), cooldownLeft);
  const expired = Boolean(challenge && (challenge.expired || expiresLeft === 0));
  const masked = challenge ? maskIdentifier(challenge.channel, challenge.identifier) : '';
  const value = values[channel];
  const suggestion = channel === 'email' ? emailSuggestion(value) : '';
  const identifyError = fieldError || error;
  const verifyError = expired ? 'This code has expired. Send a new one to continue.' : error;
  const meta = steps[step];

  function later(callback, delay) { timers.current.push(window.setTimeout(callback, delay)); }
  function refocus() { setFocusRequest((count) => count + 1); }
  function reset() {
    setStep('identify'); setChallenge(null); setCode(''); setError(''); setFieldError(''); setBusy(false); setIsNew(false); setAttempted(false);
    setProfile({ name: '', course: '', city: '' });
  }
  function close() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    closeLogin();
    later(reset, 300);
  }
  function switchChannel(next) { setChannel(next); setFieldError(''); setError(''); }
  function updateValue(next) {
    const clean = channel === 'phone' ? phoneDigits(next) : next;
    setValues((current) => ({ ...current, [channel]: clean }));
    setError('');
    // Clear an error as soon as the value becomes valid; new errors wait for blur or submit.
    if (fieldError && !validateIdentifier(channel, clean)) setFieldError('');
  }

  async function sendCode(nextChannel, identifier) {
    setBusy(true); setError(''); setFieldError('');
    try {
      const data = await api('/auth/otp/request', { method: 'POST', body: { channel: nextChannel, identifier } });
      const at = Date.now();
      rememberChannel(nextChannel);
      setNow(at);
      setChallenge({ ...data, channel: nextChannel, expiresInSeconds: data.expiresInSeconds || DEFAULT_CODE_MINUTES * 60, resendInSeconds: data.resendInSeconds || 30, sentAt: at, expired: false });
      setCode(''); setStep('verify'); refocus();
    } catch (failure) {
      const retry = failure.details?.retryAfterSeconds;
      if (retry) { const at = Date.now(); setNow(at); setCooldownUntil(at + retry * 1000); }
      if (failure.fields?.identifier) { setFieldError(failure.fields.identifier.replace(/\.?$/, '.')); setStep('identify'); refocus(); }
      else setError(failure.message);
    } finally { setBusy(false); }
  }
  function requestCode(event) {
    event.preventDefault();
    if (busy || cooldownLeft > 0) return;
    setAttempted(true);
    const problem = validateIdentifier(channel, value);
    if (problem) { setFieldError(problem); refocus(); return; }
    sendCode(channel, channel === 'phone' ? `+91${value}` : value.trim().toLowerCase());
  }
  function resend() { if (!busy && resendLeft === 0) sendCode(challenge.channel, challenge.identifier); }
  function editIdentifier(next = challenge.channel) { setChannel(next); setStep('identify'); setError(''); setFieldError(''); setCode(''); refocus(); }

  async function verify(entered = code) {
    if (submitting.current || !challenge || expired) return;
    if (entered.length !== 6) { setError('Enter all 6 digits of the code.'); refocus(); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await api('/auth/otp/verify', { method: 'POST', body: { channel: challenge.channel, identifier: challenge.identifier, code: entered } });
      signIn(data.student);
      setIsNew(Boolean(data.isNew));
      if (data.isNew || !data.student.name) {
        setProfile({ name: data.student.name || '', course: preferences.course || '', city: preferences.city || '' });
        setStep('profile');
      } else { setStep('done'); later(close, 900); }
    } catch (failure) {
      setCode('');
      setError(failure.message);
      if (failure.status === 403) setStep('blocked');
      else if (failure.status === 429) { setChannel(challenge.channel); setChallenge(null); setStep('identify'); }
      else if (failure.status === 400 && /expired/i.test(failure.message)) setChallenge((current) => ({ ...current, expired: true }));
      refocus();
    } finally { submitting.current = false; setBusy(false); }
  }

  function finish() { setError(''); setStep('done'); if (!isNew) later(close, 900); }
  async function saveProfile(event) {
    event.preventDefault();
    const name = profile.name.trim();
    if (!name) { setError('Enter your name, or choose Skip for now.'); refocus(); return; }
    setBusy(true); setError('');
    try {
      const data = await api('/auth/me', { method: 'PATCH', body: { name } });
      setStudent(data.student);
      if (profile.course !== preferences.course) preferences.setCourse(profile.course);
      if (profile.city !== preferences.city) preferences.setCity(profile.city);
      finish();
    } catch (failure) { setError(failure.fields?.name || failure.message); } finally { setBusy(false); }
  }

  const announcement = step === 'verify' && challenge ? `Code sent to ${masked}.${expired ? ' The code has expired.' : resendLeft === 0 ? ' You can request a new code now.' : ''}` : '';

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-lead`}
    onClose={() => { if (loginOpen) close(); }}
    onPointerDown={(event) => { pressedBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => { if (pressedBackdrop.current && event.target === event.currentTarget) close(); pressedBackdrop.current = false; }}>
    <div className={styles.shell}>
      <LoginBrand minutes={minutes} showPhoto={openState.seen} />

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.stepper}>
            <span className={styles.stepBars} data-bar={meta.bar} aria-hidden="true"><i /><i /></span>
            <p><strong>{meta.label}</strong>{meta.detail && <span> · {meta.detail}</span>}</p>
          </div>
          <button type="button" className={styles.close} aria-label="Close login" onClick={close}><Icon name="close" /></button>
        </div>

        <div className={styles.body}>
          <p className="sr-only" aria-live="polite">{announcement}</p>
          <div className={styles.heading}>
            {step === 'profile' && <p className={styles.verified}><Icon name="loginBadge" />Verified · {masked}</p>}
            <h2 id={`${id}-title`}>{meta.heading}</h2>
            <p id={`${id}-lead`} className={styles.lead}>{{
              identify: 'One code to your mobile or email. No password, no separate sign-up.',
              verify: 'Type or paste the code we just sent. Each code works only once.',
              profile: 'Your student space is ready. Add your name so we can greet you.',
              done: 'Your comparisons, saved news and preferences are one tap away.',
              blocked: 'This sign-in can’t continue.',
            }[step]}</p>
          </div>

          {step === 'identify' && <form className={styles.form} onSubmit={requestCode} noValidate>
            <fieldset className={styles.segmented} data-active={channel}>
              <legend className="sr-only">Log in with</legend>
              {channels.map((item) => <label key={item.id} className={styles.segment}>
                <input className="sr-only" type="radio" name={`${id}-channel`} value={item.id} checked={channel === item.id} onChange={() => switchChannel(item.id)} />
                <Icon name={item.icon} />{item.label}
              </label>)}
            </fieldset>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-identifier`}>{channel === 'phone' ? 'Mobile number' : 'Email address'}</label>
              <div className={styles.inputWrap} data-invalid={Boolean(fieldError)}>
                {channel === 'phone'
                  ? <span className={styles.prefix} aria-hidden="true"><span className={styles.flag} />+91</span>
                  : <Icon name="mail" />}
                <input ref={identifierRef} id={`${id}-identifier`} value={channel === 'phone' ? formatPhone(value) : value}
                  {...(channel === 'phone'
                    ? { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', placeholder: '98765 43210', maxLength: 16 }
                    : { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'name@example.com', maxLength: 254, autoCapitalize: 'none', spellCheck: false })}
                  onChange={(event) => updateValue(event.target.value)}
                  onBlur={() => { if (attempted) setFieldError(validateIdentifier(channel, value)); }}
                  aria-invalid={Boolean(fieldError)} aria-describedby={`${id}-hint${identifyError ? ` ${id}-error` : ''}`} />
              </div>
              <p id={`${id}-hint`} className={styles.hint}>
                {channel === 'phone'
                  ? <>{value.length > 0 && value.length < 10 && <span className={styles.count} aria-live="off">{value.length} / 10 digits · </span>}+91 is added for you. We’ll send a 6-digit code by SMS.</>
                  : 'We’ll send a 6-digit code to this inbox.'}
              </p>
              {suggestion && <button type="button" className={styles.suggest} onClick={() => { setValues((current) => ({ ...current, email: suggestion })); setFieldError(''); identifierRef.current?.focus(); }}><Icon name="spark" /><span>Did you mean <strong>{suggestion}</strong>?</span></button>}
              {identifyError && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name="close" />{identifyError}</p>}
            </div>

            <button className={styles.primary} type="submit" disabled={busy || cooldownLeft > 0}>
              {busy ? <><span className={styles.spinner} aria-hidden="true" />Sending…</> : cooldownLeft > 0 ? <><Icon name="loginClock" />Try again in {clock(cooldownLeft)}</> : <>Get OTP<Icon name="arrow" /></>}
            </button>
            <p className={styles.newHere}><Icon name="sparkleUser" /><span><strong>New here?</strong> There’s no separate sign-up. Your space is created when you verify the code.</span></p>
          </form>}

          {step === 'verify' && challenge && <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (expired) resend(); else verify(); }} noValidate>
            <div className={styles.sentTo}>
              <span className={styles.sentIcon}><Icon name={challenge.channel === 'phone' ? 'loginChat' : 'mail'} /></span>
              <p>Sent to <strong>{masked}</strong></p>
              <button type="button" className={styles.inlineButton} onClick={() => editIdentifier()}><Icon name="edit" />Edit<span className="sr-only"> {challenge.channel === 'phone' ? 'mobile number' : 'email address'}</span></button>
            </div>
            {challenge.devCode && <div className={styles.devCode}>
              <Icon name="gear" />
              <p><strong>Development preview</strong>No SMS/email provider is connected. Code: <code>{challenge.devCode.replace(/^(\d{3})/, '$1 ')}</code></p>
              <button type="button" disabled={busy || expired} onClick={() => { setCode(challenge.devCode); verify(challenge.devCode); }}>Fill code</button>
            </div>}
            <OtpInput fieldRef={otpRef} value={code} onChange={(next) => { setCode(next); setError(''); }} onComplete={(next) => verify(next)}
              invalid={Boolean(error) && !expired} disabled={busy || expired} describedBy={verifyError ? `${id}-error` : undefined} />
            {verifyError && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name={expired ? 'loginClock' : 'close'} />{verifyError}</p>}
            <button className={styles.primary} type="submit" disabled={busy || (expired && resendLeft > 0)}>
              {busy ? <><span className={styles.spinner} aria-hidden="true" />{expired ? 'Sending…' : 'Verifying…'}</>
                : expired ? (resendLeft > 0 ? `Send a new code in ${clock(resendLeft)}` : <>Send a new code<Icon name="refresh" /></>)
                : <>Verify &amp; continue<Icon name="arrow" /></>}
            </button>
            <div className={styles.timers}>
              {!expired && <p><Icon name="loginClock" />Code expires in <strong>{clock(expiresLeft)}</strong></p>}
              <p className={styles.resendRow}>
                {!expired && (resendLeft > 0
                  ? <span>Resend code in <strong>{clock(resendLeft)}</strong></span>
                  : <button type="button" className={styles.inlineButton} onClick={resend} disabled={busy}><Icon name="refresh" />Resend code</button>)}
                <button type="button" className={styles.inlineButton} onClick={() => editIdentifier(otherChannel[challenge.channel])}><Icon name="loginSwap" />Try {challenge.channel === 'phone' ? 'Email' : 'Mobile'} instead</button>
              </p>
            </div>
          </form>}

          {step === 'profile' && <form className={styles.form} onSubmit={saveProfile} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-name`}>Your name</label>
              <div className={styles.inputWrap} data-invalid={Boolean(error)}>
                <Icon name="user" />
                <input ref={nameRef} id={`${id}-name`} autoComplete="name" placeholder="Full name" value={profile.name} maxLength={80} required
                  onChange={(event) => { setProfile({ ...profile, name: event.target.value }); setError(''); }} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
              </div>
              {error && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name="close" />{error}</p>}
            </div>
            <fieldset className={styles.personalise}>
              <legend>Personalise <span>Optional · saved on this device</span></legend>
              <div className={styles.personaliseGrid}>
              <label className={styles.selectField}><span>Preferred course</span>
                <select value={profile.course} onChange={(event) => setProfile({ ...profile, course: event.target.value })}>
                  <option value="">No preference</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className={styles.selectField}><span>Preferred city</span>
                <select value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })}>
                  <option value="">No preference</option>{cityNames.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button className={styles.primary} type="submit" disabled={busy}>{busy ? <><span className={styles.spinner} aria-hidden="true" />Saving…</> : <>Save &amp; continue<Icon name="arrow" /></>}</button>
              <button className={styles.secondary} type="button" onClick={finish} disabled={busy}>Skip for now</button>
            </div>
          </form>}

          {step === 'done' && <>
            <div ref={doneRef} tabIndex={-1} className={styles.done} role="status">
              <svg className={styles.doneMark} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 8 8 16-17" /></svg>
              <p>Signed in as <strong>{student?.name || masked}</strong></p>
              {!isNew && <p className={styles.small}>Taking you back to the page…</p>}
            </div>
            {isNew && <div className={styles.actions}>
              <Link className={styles.primary} href="/account" onClick={close}>Go to your student space<Icon name="arrow" /></Link>
              <button className={styles.secondary} type="button" onClick={close}>Continue browsing</button>
            </div>}
          </>}

          {step === 'blocked' && <>
            <div ref={doneRef} tabIndex={-1} className={styles.blocked} role="alert"><Icon name="shield" /><p>{error || 'This account is suspended.'}</p></div>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/contact" onClick={close}>Contact & support<Icon name="arrow" /></Link>
              <button className={styles.secondary} type="button" onClick={() => editIdentifier()}>Use a different {challenge?.channel === 'email' ? 'email' : 'number'}</button>
            </div>
          </>}
        </div>

        <p className={styles.trust}><Icon name="lock" /><span>Codes expire in {minutes} minutes and work once. By continuing you agree to the <Link href="/terms-and-conditions" onClick={close}>Terms</Link> and acknowledge the <Link href="/privacy-policy" onClick={close}>Privacy policy</Link>.</span></p>
      </div>
    </div>
  </dialog>;
}

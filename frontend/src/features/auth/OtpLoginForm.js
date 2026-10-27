'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useAuthConfig } from './auth-config';
import GoogleButton from './GoogleButton';
import OtpInput from './OtpInput';
import { clock, emailSuggestion, formatPhone, maskIdentifier, phoneDigits, readChannel, rememberChannel, validateIdentifier } from './login-helpers';
import styles from './OtpLoginForm.module.css';

const channelMeta = {
  email: { label: 'Email', icon: 'mail' },
  phone: { label: 'Mobile', icon: 'phone' },
};

/**
 * Passwordless student login (the one implementation used by /login and the login popup).
 * identify → verify → (name, when the account has none) → done. "Continue with Google" leaves the
 * page instead and comes back to `returnTo` (default: this page). The API creates the account on
 * the first successful verification. `askNameFor` (a signed-in student) opens straight on the name
 * step: Google accounts without a profile name come back with ?welcome=name.
 * @param {{ onSuccess: (student, meta: { isNew: boolean }) => void, onVerified?: (student) => void,
 *   title?: string, lead?: string, titleId?: string, headingLevel?: 'h1'|'h2', active?: boolean,
 *   onLinkClick?: () => void, doneText?: string, returnTo?: string, notice?: string, askNameFor?: object }} props
 */
export default function OtpLoginForm({ onSuccess, onVerified, title, lead, titleId, headingLevel = 'h2', active = true, autoFocus = true, onLinkClick, doneText = 'Taking you back…', returnTo, notice = '', askNameFor = null }) {
  const config = useAuthConfig(active);
  const id = useId();
  const identifierRef = useRef(null);
  const otpRef = useRef(null);
  const nameRef = useRef(null);
  const statusRef = useRef(null);
  const submitting = useRef(false);
  const verified = useRef(askNameFor ? { student: askNameFor, meta: { isNew: false } } : null);
  const [name, setName] = useState('');

  const [preferred, setPreferred] = useState(null);
  const [values, setValues] = useState({ phone: '', email: '' });
  const [fieldError, setFieldError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(askNameFor ? 'name' : 'identify');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const [smsPaused, setSmsPaused] = useState(false);

  const channels = config.channels;
  const stored = preferred ?? (typeof window === 'undefined' ? 'email' : readChannel());
  const channel = channels.includes(stored) ? stored : channels[0];

  useEffect(() => {
    if (!active || (!autoFocus && step === 'identify' && focusRequest === 0)) return;
    const targets = { identify: identifierRef.current, verify: otpRef.current?.querySelector('input:not(:disabled)'), name: nameRef.current, done: statusRef.current, blocked: statusRef.current };
    targets[step]?.focus({ preventScroll: true });
  }, [active, autoFocus, step, focusRequest]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const ticking = active && (step === 'verify' || cooldownLeft > 0);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const secondsLeft = (seconds) => (challenge ? Math.max(0, Math.ceil((challenge.sentAt + seconds * 1000 - now) / 1000)) : 0);
  const expiresLeft = secondsLeft(challenge?.expiresInSeconds);
  const resendLeft = Math.max(secondsLeft(challenge?.resendInSeconds), cooldownLeft);
  const expired = Boolean(challenge && (challenge.expired || expiresLeft === 0));
  const masked = challenge ? maskIdentifier(challenge.channel, challenge.identifier) : '';
  const value = values[channel];
  const suggestion = channel === 'email' ? emailSuggestion(value) : '';
  const identifyError = fieldError || error;
  const verifyError = expired ? 'This code has expired. Send a new one to continue.' : error;
  const minutes = Math.round((challenge?.expiresInSeconds || config.otpTtlSeconds) / 60);
  const Heading = headingLevel;

  const refocus = () => setFocusRequest((count) => count + 1);
  function switchChannel(next) { setPreferred(next); setFieldError(''); setError(''); setSmsPaused(false); }
  function updateValue(next) {
    const clean = channel === 'phone' ? phoneDigits(next) : next;
    setValues((current) => ({ ...current, [channel]: clean }));
    setError('');
    if (fieldError && !validateIdentifier(channel, clean)) setFieldError('');
  }

  async function sendCode(nextChannel, identifier) {
    setBusy(true); setError(''); setFieldError('');
    try {
      const data = await api('/auth/otp/request', { method: 'POST', body: { channel: nextChannel, identifier } });
      const at = Date.now();
      rememberChannel(nextChannel);
      setNow(at);
      setChallenge({
        channel: nextChannel, identifier: data.identifier || identifier, devCode: data.devCode,
        expiresInSeconds: data.expiresInSeconds || config.otpTtlSeconds, resendInSeconds: data.resendInSeconds || config.resendSeconds, sentAt: at, expired: false,
      });
      setCode(''); setStep('verify'); refocus();
    } catch (failure) {
      const retry = failure.details?.retryAfterSeconds;
      if (retry) { const at = Date.now(); setNow(at); setCooldownUntil(at + retry * 1000); }
      if (failure.fields?.identifier) { setFieldError(failure.fields.identifier.replace(/\.?$/, '.')); setStep('identify'); refocus(); }
      // The server's own words when SMS is paused for the day: waiting a minute would not help.
      else if (failure.details?.smsPaused) { setSmsPaused(true); setError(failure.message); }
      else if (failure.status >= 500) setError(`${failure.message.replace(/\.?$/, '.')} If it keeps failing, check the ${nextChannel === 'phone' ? 'number' : 'address'} or try again in a minute.`);
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
  function editIdentifier() { setStep('identify'); setError(''); setFieldError(''); setCode(''); refocus(); }

  async function verify(entered = code) {
    if (submitting.current || !challenge || expired) return;
    if (entered.length !== 6) { setError('Enter all 6 digits of the code.'); refocus(); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await api('/auth/otp/verify', { method: 'POST', body: { channel: challenge.channel, identifier: challenge.identifier, code: entered } });
      verified.current = { student: data.student, meta: { isNew: Boolean(data.isNew) } };
      onVerified?.(data.student);
      // Counsellors call students by name, so ask once, right here, for accounts that have none.
      if (data.student?.name) finish(data.student);
      else { setStep('name'); refocus(); }
    } catch (failure) {
      setCode('');
      setError(failure.message);
      if (failure.status === 403) setStep('blocked');
      else if (failure.status === 429) { setChallenge(null); setStep('identify'); }
      else if (failure.status === 400 && /expired/i.test(failure.message)) setChallenge((current) => ({ ...current, expired: true }));
      refocus();
    } finally { submitting.current = false; setBusy(false); }
  }

  function finish(student = verified.current?.student) {
    setStep('done'); setError('');
    onSuccess?.(student, verified.current?.meta ?? { isNew: false });
  }
  async function saveName(event) {
    event.preventDefault();
    if (busy) return;
    const value = name.replace(/\s+/g, ' ').trim();
    if (!value) { setError('Enter your name, or choose “Skip for now”.'); refocus(); return; }
    setBusy(true); setError('');
    try {
      const data = await api('/auth/me', { method: 'PATCH', body: { name: value } });
      finish(data.student);
    } catch (failure) {
      setError(failure.fields?.name || failure.message);
      refocus();
    } finally { setBusy(false); }
  }

  const announcement = step === 'name' ? `${challenge ? 'Code verified.' : 'You’re signed in.'} One last step: tell us what to call you, or skip.`
    : step === 'verify' && challenge ? `Code sent to ${masked}.${expired ? ' The code has expired.' : resendLeft === 0 ? ' You can request a new code now.' : ''}` : '';
  const heading = {
    identify: title || 'Log in to Gyaan Vidhya',
    verify: challenge?.channel === 'phone' ? 'Check your messages' : 'Check your inbox',
    name: 'What should we call you?',
    done: 'You’re signed in',
    blocked: 'We couldn’t sign you in',
  }[step];
  const codeWay = channels.length > 1 ? 'a one-time code on your email or mobile' : 'a one-time code by email';
  const leadText = {
    identify: lead || (config.google ? `Continue with Google, or get ${codeWay}. No password, no separate sign-up.`
      : channels.length > 1 ? 'Get a one-time code on your email or mobile. No password, no separate sign-up.' : 'We’ll email you a one-time code. No password, no separate sign-up.'),
    verify: null,
    name: 'Your counsellor will use this name when they get in touch. You can change it any time in your account.',
    done: doneText,
    blocked: 'This sign-in can’t continue.',
  }[step];
  const stepLabel = { identify: 'Step 1 of 2 · Get a code', verify: 'Step 2 of 2 · Verify', name: `${challenge ? 'Verified' : 'Signed in'} · One last thing`, done: 'Verified', blocked: 'Sign-in stopped' }[step];

  return <div className={styles.root} data-step={step}>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <div className={styles.heading}>
      <p className={styles.stepTag}><span aria-hidden="true" data-on={step !== 'identify' || undefined} />{stepLabel}</p>
      <Heading id={titleId} className={styles.title}>{heading}</Heading>
      {step === 'verify' && challenge
        ? <p className={styles.lead}>Enter the 6-digit code we sent to <strong>{masked}</strong>.
          <button type="button" className={styles.inlineLink} onClick={editIdentifier}>Change<span className="sr-only"> {challenge.channel === 'phone' ? 'mobile number' : 'email address'}</span></button></p>
        : leadText && <p className={styles.lead}>{leadText}</p>}
    </div>

    {step === 'identify' && notice && <p className={styles.notice} role="alert"><Icon name="shield" /><span>{notice}</span></p>}

    {step === 'identify' && config.google && <div className={styles.alternatives}>
      <GoogleButton returnTo={returnTo} />
      <p className={styles.divider}>or use a one-time code</p>
    </div>}

    {step === 'identify' && <form className={styles.form} onSubmit={requestCode} noValidate>
      {channels.length > 1 && <fieldset className={styles.segmented} data-active={channel}>
        <legend className="sr-only">Log in with</legend>
        {channels.map((item) => <label key={item} className={styles.segment}>
          <input className="sr-only" type="radio" name={`${id}-channel`} value={item} checked={channel === item} onChange={() => switchChannel(item)} />
          <Icon name={channelMeta[item].icon} />{channelMeta[item].label}
        </label>)}
      </fieldset>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-identifier`}>{channel === 'phone' ? 'Mobile number' : 'Email address'}</label>
        <div className={styles.inputWrap} data-invalid={Boolean(fieldError) || undefined}>
          {channel === 'phone' ? <span className={styles.prefix} aria-hidden="true">+91</span> : <Icon name="mail" />}
          <input ref={identifierRef} id={`${id}-identifier`} data-otp-identifier="" value={channel === 'phone' ? formatPhone(value) : value}
            {...(channel === 'phone'
              ? { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', placeholder: '98765 43210', maxLength: 16 }
              : { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'you@example.com', maxLength: 254, autoCapitalize: 'none', spellCheck: false })}
            onChange={(event) => updateValue(event.target.value)}
            onBlur={() => { if (attempted) setFieldError(validateIdentifier(channel, value)); }}
            aria-invalid={Boolean(fieldError)} aria-describedby={identifyError ? `${id}-error` : undefined} />
        </div>
        {suggestion && <button type="button" className={styles.suggest} onClick={() => { setValues((current) => ({ ...current, email: suggestion })); setFieldError(''); identifierRef.current?.focus(); }}>Did you mean <strong>{suggestion}</strong>?</button>}
        {identifyError && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name="close" />{identifyError}</p>}
        {smsPaused && channel === 'phone' && channels.includes('email') && <button type="button" className={styles.suggest} onClick={() => { switchChannel('email'); refocus(); }}>Use my <strong>email address</strong> instead</button>}
      </div>

      <button className={styles.primary} type="submit" disabled={busy || cooldownLeft > 0}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />Sending code…</>
          : cooldownLeft > 0 ? <><Icon name="loginClock" />Try again in {clock(cooldownLeft)}</>
            : <>{channel === 'phone' ? 'Text me a code' : 'Email me a code'}<Icon name="arrow" /></>}
      </button>
    </form>}

    {step === 'verify' && challenge && <form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (expired) resend(); else verify(); }} noValidate>
      {challenge.devCode && <div className={styles.devCode}>
        <p><strong>Development preview</strong> · no email provider connected. Code <code>{challenge.devCode}</code></p>
        <button type="button" disabled={busy || expired} onClick={() => { setCode(challenge.devCode); verify(challenge.devCode); }}>Fill</button>
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
        {!expired && <span><Icon name="loginClock" />Expires in <strong>{clock(expiresLeft)}</strong></span>}
        {!expired && (resendLeft > 0
          ? <span>Resend in <strong>{clock(resendLeft)}</strong></span>
          : <button type="button" className={styles.inlineLink} onClick={resend} disabled={busy}><Icon name="refresh" />Resend code</button>)}
      </div>
      {challenge.channel === 'email' && <p className={styles.hint}>Can’t find it? Check Promotions or Spam for “Gyaan Vidhya”.</p>}
    </form>}

    {step === 'name' && <form className={styles.form} onSubmit={saveName} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-name`}>Your name</label>
        <div className={styles.inputWrap} data-invalid={Boolean(error) || undefined}>
          <Icon name="user" />
          <input ref={nameRef} id={`${id}-name`} value={name} maxLength={80} autoComplete="name" autoCapitalize="words" placeholder="e.g. Priya Sharma"
            onChange={(event) => { setName(event.target.value); setError(''); }}
            aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        {error && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name="close" />{error}</p>}
      </div>
      <button className={styles.primary} type="submit" disabled={busy}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />Saving…</> : <>Continue<Icon name="arrow" /></>}
      </button>
      <button type="button" className={styles.skip} onClick={() => finish()} disabled={busy}>Skip for now</button>
    </form>}

    {step === 'done' && <div ref={statusRef} tabIndex={-1} className={styles.done} role="status">
      <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 8 8 16-17" /></svg>
      <p>Verified{masked ? <> · <strong>{masked}</strong></> : null}</p>
    </div>}

    {step === 'blocked' && <div ref={statusRef} tabIndex={-1} className={styles.blocked} role="alert">
      <Icon name="shield" /><p>{error || 'This account is suspended.'} <Link href="/contact" onClick={onLinkClick}>Contact support</Link></p>
    </div>}

    {(step === 'identify' || step === 'verify') && <p className={styles.legal}><Icon name="lock" /><span>Codes expire in {minutes} minutes and work once. By continuing you agree to the <Link href="/terms-and-conditions" onClick={onLinkClick}>Terms</Link> and <Link href="/privacy-policy" onClick={onLinkClick}>Privacy policy</Link>.</span></p>}
  </div>;
}

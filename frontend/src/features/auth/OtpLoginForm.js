'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useAuthConfig } from './auth-config';
import GoogleButton from './GoogleButton';
import OtpInput from './OtpInput';
import { clock, domainCompletions, emailSuggestion, formatPhone, maskIdentifier, phoneDigits, readChannel, rememberChannel, validateIdentifier } from './login-helpers';
import styles from './OtpLoginForm.module.css';

/**
 * Passwordless student login (the one implementation used by /login and the login popup).
 * Layout follows the familiar pattern: email field and Continue first, then "or" Google / mobile
 * number. /auth/config says which methods work today: one that is not switched on yet says
 * "coming soon" instead of disappearing.
 * identify → verify → (name, when the account has none) → done. "Continue with Google" leaves the
 * page instead and comes back to `returnTo` (default: this page). The API creates the account on
 * the first successful verification. `askNameFor` (a signed-in student) opens straight on the name
 * step: Google accounts without a profile name come back with ?welcome=name.
 * `onDismiss` adds a quiet "Maybe later" under the first step (used by the login nudge).
 * @param {{ onSuccess: (student, meta: { isNew: boolean }) => void, onVerified?: (student) => void,
 *   title?: string, lead?: string, titleId?: string, headingLevel?: 'h1'|'h2', active?: boolean,
 *   onLinkClick?: () => void, doneText?: string, returnTo?: string, notice?: string, askNameFor?: object,
 *   onDismiss?: () => void, dismissLabel?: string }} props
 */
export default function OtpLoginForm({ onSuccess, onVerified, title, lead, titleId, headingLevel = 'h2', active = true, autoFocus = true, onLinkClick, doneText = 'Taking you back…', returnTo, notice = '', askNameFor = null, onDismiss, dismissLabel = 'Maybe later' }) {
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
  const [googleNote, setGoogleNote] = useState(false);

  const [phoneNote, setPhoneNote] = useState(false);

  const channels = config.channels;
  const usable = (item) => channels.includes(item);
  // Email is the main way in and is on screen at once. Mobile is one tap away ("Continue with mobile
  // number") and is chosen up front only for a browser that last signed in with it and while SMS works.
  const remembered = typeof window === 'undefined' ? '' : readChannel();
  const channel = preferred ?? (remembered === 'phone' && usable('phone') ? 'phone' : 'email');
  const channelReady = usable(channel);

  useEffect(() => {
    if (!active || (!autoFocus && step === 'identify' && focusRequest === 0)) return;
    const targets = { identify: identifierRef.current, verify: otpRef.current?.querySelector('input:not(:disabled)'), name: nameRef.current, done: statusRef.current, blocked: statusRef.current };
    targets[step]?.focus({ preventScroll: true });
    // channelReady: the field only exists once /auth/config has answered, so focus it then.
  }, [active, autoFocus, step, focusRequest, channelReady]);

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
  const value = values[channel] ?? '';
  const suggestion = channel === 'email' ? emailSuggestion(value) : '';
  const completions = channel === 'email' && !suggestion ? domainCompletions(value, 3) : [];
  const identifyError = fieldError || error;
  const verifyError = expired ? 'This code has expired. Send a new one to continue.' : error;
  const minutes = Math.round((challenge?.expiresInSeconds || config.otpTtlSeconds) / 60);
  const Heading = headingLevel;

  const refocus = () => setFocusRequest((count) => count + 1);
  function switchChannel(next) { setPreferred(next); setFieldError(''); setError(''); setSmsPaused(false); setGoogleNote(false); setPhoneNote(false); refocus(); }
  // Mobile codes need an SMS provider; until one is set up the button says so instead of switching.
  function choosePhone() {
    if (usable('phone')) switchChannel('phone');
    else if (config.loaded) { setPhoneNote(true); setGoogleNote(false); }
  }
  function completeEmail(address) { setValues((current) => ({ ...current, email: address })); setFieldError(''); setError(''); identifierRef.current?.focus(); }
  function updateValue(next) {
    if (!channel) return;
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
    if (busy || cooldownLeft > 0 || !channelReady) return;
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
    identify: title || 'Log in or sign up',
    verify: challenge?.channel === 'phone' ? 'Check your phone' : 'Check your email',
    name: 'What should we call you?',
    done: 'You’re signed in',
    blocked: 'We couldn’t sign you in',
  }[step];
  const leadText = {
    identify: lead || 'Welcome to Gyaan Vidhya. No password needed — we’ll send you a one-time code.',
    verify: null,
    name: 'Your counsellor will use this name when they get in touch.',
    done: doneText,
    blocked: 'This sign-in can’t continue.',
  }[step];

  return <div className={styles.root} data-step={step}>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <Brand className={styles.brand} />
    <div className={styles.heading}>
      <Heading id={titleId} className={styles.title}>{heading}</Heading>
      {step === 'verify' && challenge
        ? <p className={styles.lead}>Enter the 6-digit code we sent to <strong>{masked}</strong>.
          <button type="button" className={styles.inlineLink} onClick={editIdentifier}>Change<span className="sr-only"> {challenge.channel === 'phone' ? 'mobile number' : 'email address'}</span></button></p>
        : leadText && <p className={styles.lead}>{leadText}</p>}
    </div>

    {step === 'identify' && notice && <p className={styles.notice} role="alert"><Icon name="shield" /><span>{notice}</span></p>}

    {step === 'identify' && <form className={styles.form} onSubmit={requestCode} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-identifier`}>{channel === 'phone' ? 'Mobile number' : 'Email address'}</label>
        <div className={styles.inputWrap} data-invalid={Boolean(fieldError) || undefined}>
          {channel === 'phone' ? <span className={styles.prefix} aria-hidden="true">+91</span> : <Icon name="mail" />}
          <input ref={identifierRef} id={`${id}-identifier`} data-otp-identifier="" value={channel === 'phone' ? formatPhone(value) : value}
            {...(channel === 'phone'
              ? { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', placeholder: '98765 43210', maxLength: 16 }
              : { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'name@example.com', maxLength: 254, autoCapitalize: 'none', spellCheck: false })}
            onChange={(event) => updateValue(event.target.value)}
            onBlur={() => { if (attempted) setFieldError(validateIdentifier(channel, value)); }}
            aria-invalid={Boolean(fieldError)} aria-describedby={identifyError ? `${id}-error` : undefined} />
        </div>
        {completions.length > 0 && <div className={styles.completions} role="group" aria-label="Complete your email address">
          {completions.map((address) => <button key={address} type="button" className={styles.completion} onClick={() => completeEmail(address)}>
            @{address.split('@')[1]}<span className="sr-only"> — use {address}</span>
          </button>)}
        </div>}
        {suggestion && <button type="button" className={styles.suggest} onClick={() => completeEmail(suggestion)}>Did you mean <strong>{suggestion}</strong>?</button>}
        {identifyError && <p id={`${id}-error`} className={styles.error} role="alert"><Icon name="close" />{identifyError}</p>}
        {smsPaused && channel === 'phone' && <button type="button" className={styles.suggest} onClick={() => switchChannel('email')}>Use my <strong>email address</strong> instead</button>}
      </div>

      <button className={styles.primary} type="submit" disabled={busy || cooldownLeft > 0 || !channelReady}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />Sending code…</>
          : cooldownLeft > 0 ? <><Icon name="loginClock" />Try again in {clock(cooldownLeft)}</>
            : 'Continue'}
      </button>
    </form>}

    {step === 'identify' && <div className={styles.alternatives}>
      <p className={styles.divider}>or</p>
      <GoogleButton returnTo={returnTo} available={config.google} describedBy={googleNote ? `${id}-method-note` : undefined}
        onUnavailable={() => { if (config.loaded) { setGoogleNote(true); setPhoneNote(false); } }} />
      {channel === 'email'
        ? <button type="button" className={styles.secondary} onClick={choosePhone} aria-describedby={phoneNote ? `${id}-method-note` : undefined}><Icon name="phone" />Continue with mobile number</button>
        : <button type="button" className={styles.secondary} onClick={() => switchChannel('email')}><Icon name="mail" />Continue with email</button>}
      {(googleNote || phoneNote) && <p id={`${id}-method-note`} className={styles.methodNote} role="status">
        <Icon name="clock" /><span>{googleNote ? 'Google sign-in' : 'Mobile number sign-in'} is coming soon. Please continue with your email for now.</span>
      </p>}
    </div>}

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

    {step === 'identify' && <p className={styles.legal}>By continuing, you agree to our <Link href="/terms-and-conditions" onClick={onLinkClick}>Terms</Link> and <Link href="/privacy-policy" onClick={onLinkClick}>Privacy Policy</Link>.</p>}
    {step === 'verify' && <p className={styles.legal}><Icon name="lock" />The code expires in {minutes} minutes and works once.</p>}

    {step === 'identify' && onDismiss && <button type="button" className={styles.skip} onClick={onDismiss}>{dismissLabel}</button>}
  </div>;
}

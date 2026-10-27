'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { useAuthConfig } from './auth-config';
import GoogleButton, { GoogleMark } from './GoogleButton';
import { googleLinkErrorMessage } from './google-login';
import { displayContact, formatPhone, maskIdentifier, phoneDigits, validateIdentifier } from './login-helpers';
import OtpInput from './OtpInput';
import styles from './SignInMethods.module.css';

const LABELS = { email: 'email address', phone: 'mobile number' };
const methodsOf = (student) => student.methods ?? [student.email && 'email', student.phone && 'phone'].filter(Boolean);

// Adds a missing email or mobile number with a one-time code (POST /auth/link/otp/*).
function LinkForm({ channel, onDone, onCancel }) {
  const { setStudent } = useStudentAuth();
  const id = useId();
  const inputRef = useRef(null);
  const otpRef = useRef(null);
  const [value, setValue] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isPhone = channel === 'phone';

  useEffect(() => {
    (challenge ? otpRef.current?.querySelector('input:not(:disabled)') : inputRef.current)?.focus({ preventScroll: true });
  }, [challenge]);

  async function send(event) {
    event?.preventDefault();
    if (busy) return;
    const clean = isPhone ? phoneDigits(value) : value.trim().toLowerCase();
    const problem = validateIdentifier(channel, clean);
    if (problem) { setError(problem); inputRef.current?.focus(); return; }
    setBusy(true); setError('');
    try {
      const data = await api('/auth/link/otp/request', { method: 'POST', body: { channel, identifier: isPhone ? `+91${clean}` : clean } });
      setCode('');
      setChallenge({ identifier: data.identifier, devCode: data.devCode });
    } catch (failure) {
      setError(failure.fields?.identifier || failure.message);
    } finally { setBusy(false); }
  }

  async function verify(entered = code) {
    if (busy) return;
    if (entered.length !== 6) { setError('Enter all 6 digits of the code.'); return; }
    setBusy(true); setError('');
    try {
      const data = await api('/auth/link/otp/verify', { method: 'POST', body: { channel, identifier: challenge.identifier, code: entered } });
      setStudent(data.student);
      onDone(`${isPhone ? 'Mobile number' : 'Email address'} added. You can now log in with it.`);
    } catch (failure) {
      setCode('');
      setError(failure.message);
      if (failure.status === 429 || failure.status === 409) setChallenge(null);
    } finally { setBusy(false); }
  }

  const errorId = error ? `${id}-error` : undefined;
  return <div className={styles.linkForm}>
    {!challenge ? <form onSubmit={send} noValidate className={styles.linkStep}>
      <label className={styles.label} htmlFor={`${id}-identifier`}>{isPhone ? 'Mobile number' : 'Email address'}</label>
      <div className={styles.inputWrap} data-invalid={Boolean(error) || undefined}>
        {isPhone ? <span className={styles.prefix} aria-hidden="true">+91</span> : <Icon name="mail" />}
        <input ref={inputRef} id={`${id}-identifier`} value={isPhone ? formatPhone(value) : value}
          {...(isPhone
            ? { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', placeholder: '98765 43210', maxLength: 16 }
            : { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'you@example.com', maxLength: 254, autoCapitalize: 'none', spellCheck: false })}
          onChange={(event) => { setValue(isPhone ? phoneDigits(event.target.value) : event.target.value); setError(''); }}
          aria-invalid={Boolean(error)} aria-describedby={errorId} />
      </div>
      {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className="lux-button lux-button--primary lux-button--sm" type="submit" disabled={busy}>{busy ? 'Sending…' : isPhone ? 'Text me a code' : 'Email me a code'}</button>
        <button className="lux-button lux-button--ghost lux-button--sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
      : <form onSubmit={(event) => { event.preventDefault(); verify(); }} noValidate className={styles.linkStep}>
        <p className={styles.sent} aria-live="polite">Enter the 6-digit code sent to <strong>{maskIdentifier(channel, challenge.identifier)}</strong>.</p>
        {challenge.devCode && <p className={styles.dev}>Development preview · code <code>{challenge.devCode}</code></p>}
        <OtpInput fieldRef={otpRef} value={code} onChange={(next) => { setCode(next); setError(''); }} onComplete={(next) => verify(next)}
          invalid={Boolean(error)} disabled={busy} describedBy={errorId} />
        {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className="lux-button lux-button--primary lux-button--sm" type="submit" disabled={busy}>{busy ? 'Verifying…' : `Verify & add`}</button>
          <button className="lux-button lux-button--ghost lux-button--sm" type="button" disabled={busy} onClick={() => send()}>Resend code</button>
          <button className="lux-button lux-button--ghost lux-button--sm" type="button" disabled={busy} onClick={() => { setChallenge(null); setError(''); }}>Change<span className="sr-only"> {LABELS[channel]}</span></button>
        </div>
      </form>}
  </div>;
}

/**
 * The account's ways in: Google, email code, mobile code. Missing ones can be connected here.
 * @param {{ student: object, notice?: { linked?: string, error?: string } }} props
 */
export default function SignInMethods({ student, notice = {} }) {
  const config = useAuthConfig();
  const id = useId();
  const [open, setOpen] = useState(null);
  const [message, setMessage] = useState(() => (notice.linked === 'google' ? { ok: true, text: 'Google connected. You can now log in with it.' }
    : notice.error ? { ok: false, text: googleLinkErrorMessage(notice.error) || 'Google could not be connected. Please try again.' } : null));
  const methods = methodsOf(student);
  const statusRef = useRef(null);

  // The ?linked / ?error flags are one-shot: drop them so a refresh doesn't repeat the message.
  useEffect(() => {
    if (!notice.linked && !notice.error) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('linked');
    url.searchParams.delete('error');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [notice.linked, notice.error]);

  function done(text) {
    setOpen(null);
    setMessage({ ok: true, text });
    statusRef.current?.focus({ preventScroll: true });
  }

  const rows = [
    (config.google || methods.includes('google')) && {
      key: 'google', label: 'Google', mark: <GoogleMark />, connected: methods.includes('google'),
      detail: methods.includes('google') ? 'One tap with your Google account' : 'Log in without waiting for a code',
      action: <GoogleButton link returnTo="/account" label="Connect" srLabel=" Google account (opens Google sign-in)" size="sm" />,
    },
    {
      key: 'email', label: 'Email code', mark: <Icon name="mail" />, connected: Boolean(student.email),
      detail: student.email || 'Add an email address as another way in', linkable: true,
    },
    (config.channels.includes('phone') || student.phone) && {
      key: 'phone', label: 'Mobile code', mark: <Icon name="phone" />, connected: Boolean(student.phone),
      detail: student.phone ? displayContact({ phone: student.phone }) : 'Add your mobile number for SMS codes', linkable: true,
    },
  ].filter(Boolean);

  return <div className={styles.root}>
    <p ref={statusRef} tabIndex={-1} className={styles.message} data-tone={message ? (message.ok ? 'ok' : 'error') : undefined} role={message?.ok === false ? 'alert' : 'status'}>
      {message && <><Icon name={message.ok ? 'check' : 'shield'} />{message.text}</>}
    </p>
    <ul className={styles.list}>
      {rows.map((row) => <li key={row.key} className={styles.row}>
        <div className={styles.rowMain}>
          <span className={styles.mark} aria-hidden="true">{row.mark}</span>
          <span className={styles.text}><strong>{row.label}</strong><small>{row.detail}</small></span>
          {row.connected ? <span className={styles.connected}><Icon name="check" />Connected</span>
            : row.action ?? <button type="button" className="lux-button lux-button--outline lux-button--sm" aria-expanded={open === row.key} aria-controls={`${id}-${row.key}`}
              onClick={() => { setMessage(null); setOpen(open === row.key ? null : row.key); }}>{open === row.key ? 'Close' : 'Add'}<span className="sr-only"> {LABELS[row.key]}</span></button>}
        </div>
        {row.linkable && !row.connected && open === row.key && <div id={`${id}-${row.key}`}>
          <LinkForm channel={row.key} onDone={done} onCancel={() => setOpen(null)} />
        </div>}
      </li>)}
    </ul>
    <p className={styles.note}><Icon name="lock" />Every method opens this same account. A number or email that already has its own account can’t be added here.</p>
  </div>;
}

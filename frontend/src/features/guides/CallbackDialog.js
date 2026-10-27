'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { formatPhone, phoneDigits } from '@/features/auth/login-helpers';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import form from '@/features/apply/QuickApply.module.css';
import styles from './Counsellors.module.css';

const ORDER = ['name', 'phone', 'fieldSlug', 'preferredTime', 'message', 'consent'];
const MESSAGE_MAX = 500;
const sentence = (text) => String(text).replace(/\.?$/, '.');

function check(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!/^[6-9]\d{9}$/.test(values.phone)) errors.phone = values.phone ? 'Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.' : 'Enter your 10-digit mobile number.';
  if (!values.fieldSlug) errors.fieldSlug = 'Choose the field you want to talk about.';
  if (!values.consent) errors.consent = 'Tick the box so a counsellor can call you.';
  return errors;
}

function utmTags() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content']
    .map((key) => [`utm${key[0].toUpperCase()}${key.slice(1)}`, (params.get(`utm_${key}`) || '').slice(0, 100)]).filter(([, value]) => value));
}

function CallbackForm({ fieldSlug, fields, callback, onDone }) {
  const id = useId();
  const { student } = useStudentAuth();
  const resultRef = useRef(null);
  const [values, setValues] = useState(() => ({
    name: student?.name || '', phone: phoneDigits(student?.phone || ''), fieldSlug, preferredTime: 'any', message: '', consent: false, website: '',
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const fieldId = (name) => `${id}-${name}`;
  const describe = (name, hint) => [errors[name] && `${fieldId(name)}-error`, hint && `${fieldId(name)}-hint`].filter(Boolean).join(' ') || undefined;
  const error = (name) => errors[name] && <p id={`${fieldId(name)}-error`} className={form.error}><Icon name="close" />{errors[name]}</p>;
  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)));
    setFormError('');
  }
  function focusFirst(found) {
    const first = ORDER.find((name) => found[name]);
    if (first) window.requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const found = check(values);
    setErrors(found); setFormError('');
    if (Object.keys(found).length) { focusFirst(found); return; }
    setBusy(true);
    try {
      const { ref } = await api('/career/callback', { method: 'POST', body: {
        name: values.name.trim(), phone: `+91${values.phone}`, fieldSlug: values.fieldSlug, preferredTime: values.preferredTime,
        message: values.message.trim(), consent: true, consentVersion: callback.consent.version, website: values.website, source: utmTags(),
      } });
      setResult({ ref });
    } catch (failure) {
      const mapped = Object.fromEntries(Object.entries(failure.fields ?? {}).filter(([key]) => ORDER.includes(key)).map(([key, message]) => [key, sentence(message)]));
      setErrors(mapped);
      setFormError(Object.keys(mapped).length ? '' : sentence(failure.message));
      focusFirst(mapped);
    } finally { setBusy(false); }
  }

  if (result) {
    const field = fields.find((item) => item.slug === values.fieldSlug);
    const time = callback.times.find((item) => item.value === values.preferredTime);
    return <div ref={resultRef} tabIndex={-1} className={form.result} role="status">
      <svg className={form.tick} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 8 8 16-17" /></svg>
      <p className={form.resultEyebrow}>Callback requested</p>
      <h3 className={form.resultTitle}>A counsellor will call you</h3>
      <p className={form.resultText}>We will call <strong>+91 {formatPhone(values.phone)}</strong> about {field?.name || 'your field'}{time && values.preferredTime !== 'any' ? `, in the ${time.value}` : ''}. Keep your phone nearby; the call is free.</p>
      {result.ref && <p className={form.ticket}><span>Reference</span><strong>{result.ref}</strong></p>}
      <div className={form.resultActions}><button type="button" className="lux-button lux-button--primary lux-button--lg" onClick={onDone}>Done</button></div>
    </div>;
  }

  return <form className={form.form} onSubmit={submit} noValidate aria-busy={busy || undefined}>
    <div className={form.grid}>
      <div className={form.field}>
        <label className={form.label} htmlFor={fieldId('name')}>Your name</label>
        <input id={fieldId('name')} className={form.input} autoComplete="name" maxLength={100} value={values.name}
          onChange={(event) => update('name', event.target.value)} aria-invalid={Boolean(errors.name) || undefined} aria-describedby={describe('name')} />
        {error('name')}
      </div>
      <div className={form.field}>
        <label className={form.label} htmlFor={fieldId('phone')}>Mobile number</label>
        <span className={form.affix} data-invalid={Boolean(errors.phone) || undefined}><span aria-hidden="true">+91</span>
          <input id={fieldId('phone')} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={16} value={formatPhone(values.phone)}
            onChange={(event) => update('phone', phoneDigits(event.target.value))} aria-invalid={Boolean(errors.phone) || undefined} aria-describedby={describe('phone')} />
        </span>
        {error('phone')}
      </div>
      <div className={form.field} data-wide="true">
        <label className={form.label} htmlFor={fieldId('fieldSlug')}>Field you want to talk about</label>
        <select id={fieldId('fieldSlug')} className={form.input} value={values.fieldSlug} onChange={(event) => update('fieldSlug', event.target.value)}
          aria-invalid={Boolean(errors.fieldSlug) || undefined} aria-describedby={describe('fieldSlug')}>
          <option value="">Choose a field</option>
          {fields.map((field) => <option key={field.slug} value={field.slug}>{field.name}</option>)}
        </select>
        {error('fieldSlug')}
      </div>
      <fieldset className={form.intake} data-wide="true" aria-describedby={describe('preferredTime')}>
        <legend className={form.label}>Best time to call</legend>
        <div className={styles.timeOptions}>
          {callback.times.map((time, index) => <label key={time.value} className={form.year}>
            <input type="radio" name={fieldId('preferredTime')} id={index === 0 ? fieldId('preferredTime') : undefined} value={time.value}
              checked={values.preferredTime === time.value} onChange={(event) => update('preferredTime', event.target.value)} />
            <span>{time.label}</span>
          </label>)}
        </div>
        {error('preferredTime')}
      </fieldset>
      <div className={form.field} data-wide="true">
        <label className={form.label} htmlFor={fieldId('message')}>What would you like to ask?<span>Optional</span></label>
        <textarea id={fieldId('message')} className={`${form.input} ${styles.textarea}`} rows={3} maxLength={MESSAGE_MAX} value={values.message}
          placeholder="e.g. I am in class 12 (PCM) and unsure between engineering and BCA."
          onChange={(event) => update('message', event.target.value)} aria-invalid={Boolean(errors.message) || undefined} aria-describedby={describe('message', true)} />
        <p id={`${fieldId('message')}-hint`} className={form.hint}>{values.message.length}/{MESSAGE_MAX} characters</p>
        {error('message')}
      </div>
    </div>

    {/* Honeypot: hidden from people and assistive technology; bots that fill it are ignored by the API. */}
    <div className={styles.trap} aria-hidden="true">
      <label htmlFor={fieldId('website')}>Website</label>
      <input id={fieldId('website')} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update('website', event.target.value)} />
    </div>

    <div className={form.consent} data-invalid={Boolean(errors.consent) || undefined}>
      <input id={fieldId('consent')} type="checkbox" checked={values.consent} onChange={(event) => update('consent', event.target.checked)}
        aria-invalid={Boolean(errors.consent) || undefined} aria-describedby={errors.consent ? `${fieldId('consent')}-error` : undefined} />
      <label htmlFor={fieldId('consent')}>{callback.consent.text}</label>
      <Link className={styles.privacy} href="/privacy-policy" target="_blank">Read the Privacy policy<span className="sr-only"> (opens in a new tab)</span></Link>
      {error('consent')}
    </div>

    {formError && <p className={form.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <div className={form.submitRow}>
      <button type="submit" className={form.submit} disabled={busy}>
        {busy ? <><span className={form.spinner} aria-hidden="true" />Sending…</> : <>Request a callback<Icon name="arrow" /></>}
      </button>
      <p className={form.reassure}><Icon name="lock" />Free. No login needed.</p>
    </div>
  </form>;
}

/**
 * Callback request popup, open while `fieldSlug` is set. The form unmounts on close, so every opening
 * starts fresh (never on the previous success screen).
 */
export default function CallbackDialog({ fieldSlug, fields, callback, onClose }) {
  return <Dialog open={Boolean(fieldSlug)} onClose={onClose} title="Request a callback" variant={styles.dialog}>
    <p className={styles.dialogLead}>Tell us how to reach you and a counsellor for your field will call. No login needed.</p>
    {fieldSlug && <CallbackForm fieldSlug={fieldSlug} fields={fields} callback={callback} onDone={onClose} />}
  </Dialog>;
}

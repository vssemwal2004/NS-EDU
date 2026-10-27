'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import FormFields, { checkAnswers } from './FormFields';
import styles from './Registration.module.css';

const UTM = { utm_source: 'utmSource', utm_medium: 'utmMedium', utm_campaign: 'utmCampaign', utm_term: 'utmTerm', utm_content: 'utmContent' };
const NO_CONSENT = { contact: false, privacy: false, guardian: false };
// Choice groups mark the wrapper invalid; focus lands on their first option.
function focusFirstError() {
  window.requestAnimationFrame(() => {
    const node = document.querySelector('[data-registration] [aria-invalid="true"]');
    (node?.matches('input, select, textarea') ? node : node?.querySelector('input'))?.focus();
  });
}

function utmFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(Object.entries(UTM).map(([param, key]) => [key, (params.get(param) ?? '').slice(0, 100)]).filter(([, value]) => value));
}

export function ClosedNotice({ school }) {
  return <div className={styles.state} role="status">
    <span className={styles.stateIcon}><Icon name="lock" /></span>
    <h2 className={styles.stateTitle}>Registration closed</h2>
    <p>{school?.name ? `Registration for ${school.name} is no longer open.` : 'This registration form is no longer open.'} Please speak to the Gyaan Vidhya team at your school.</p>
    <Link className="lux-button lux-button--ghost" href="/">Visit Gyaan Vidhya</Link>
  </div>;
}

export default function RegistrationForm({ code, form, token: initialToken }) {
  const consentTexts = form.consent;
  const [token, setToken] = useState(initialToken);
  const [values, setValues] = useState({});
  const [consent, setConsent] = useState(NO_CONSENT);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [closed, setClosed] = useState(false);
  const honeypot = useRef(null);
  const resultHeading = useRef(null);

  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);

  const setValue = (id, value) => {
    setValues((current) => ({ ...current, [id]: value }));
    setErrors((current) => (current[id] ? { ...current, [id]: '' } : current));
  };
  const toggleConsent = (key, checked) => {
    setConsent((current) => ({ ...current, [key]: checked }));
    setErrors((current) => (current[`consent.${key}`] ? { ...current, [`consent.${key}`]: '' } : current));
  };
  async function refreshToken() {
    try { setToken((await api(`/forms/${code}`)).token); } catch (failure) { if (failure.status === 410) setClosed(true); }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const local = checkAnswers(form.fields, values);
    for (const key of ['contact', 'privacy', ...(consentTexts.guardian ? ['guardian'] : [])]) {
      if (!consent[key]) local[`consent.${key}`] = key === 'guardian' ? 'Ask a parent or guardian before you register' : 'Tick this box to register';
    }
    setErrors(local);
    setFormError('');
    if (Object.keys(local).length) { setFormError('Please check the highlighted answers.'); focusFirstError(); return; }
    setBusy(true);
    try {
      const data = await api(`/forms/${code}/submit`, { method: 'POST', body: {
        token, answers: values, consent, website: honeypot.current?.value ?? '', source: utmFromLocation(),
      } });
      setResult({ ref: data.ref, again: data.alreadyRegistered === true });
    } catch (failure) {
      if (failure.status === 410) setClosed(true);
      else if (failure.fields) {
        setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, message]) => [key.replace(/^answers\./, ''), message])));
        setFormError(failure.message);
        focusFirstError();
      } else if (failure.details?.tokenExpired) {
        await refreshToken();
        setFormError('This page was open for a while, so we refreshed it. Please tap Register again.');
      } else setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function another() {
    setValues({}); setConsent(NO_CONSENT); setErrors({}); setFormError(''); setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (closed) return <ClosedNotice school={form.school} />;
  if (result) {
    return <div className={styles.result}>
      <svg className={styles.tick} viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="32" /><path d="m22 37 10 10 18-21" /></svg>
      <h2 ref={resultHeading} tabIndex={-1} className={styles.stateTitle}>{result.again ? 'You are already registered' : 'You are registered!'}</h2>
      <p className={styles.resultText}>{result.again ? `This mobile number is already registered for ${form.school.name}. ${result.ref ? 'Your reference has not changed.' : 'If you need your reference, ask the Gyaan Vidhya team at your school.'}` : `Thank you. The Gyaan Vidhya team will contact you about courses and admissions.`}</p>
      {result.ref && <div className={styles.ticket}><span>Your reference</span><strong>{result.ref}</strong><small>Show this to the Gyaan Vidhya team</small></div>}
      <button type="button" className="lux-button lux-button--ghost" onClick={another}><Icon name="plus" />Register another student</button>
    </div>;
  }

  const consentRow = (key, text) => {
    const id = `gv-consent-${key}`;
    const error = errors[`consent.${key}`];
    return <div className={styles.consent} data-invalid={error ? true : undefined}>
      <input id={id} type="checkbox" checked={consent[key]} onChange={(event) => toggleConsent(key, event.target.checked)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      <label htmlFor={id}>{text}</label>
      {error && <p id={`${id}-error`} className={styles.error}><Icon name="close" />{error}</p>}
    </div>;
  };

  return <form className={styles.form} onSubmit={submit} noValidate data-registration aria-describedby={formError ? 'gv-form-error' : undefined}>
    <FormFields fields={form.fields} values={values} errors={errors} onChange={setValue} disabled={busy} />
    <fieldset className={styles.consents}>
      <legend className="sr-only">Consent</legend>
      {consentRow('contact', consentTexts.contact)}
      {consentRow('privacy', consentTexts.privacy)}
      {consentTexts.guardian && consentRow('guardian', consentTexts.guardian)}
      <p className={styles.hint}>Read the <Link href="/privacy-policy" target="_blank">Privacy policy</Link> to see how Gyaan Vidhya uses and protects your details.</p>
    </fieldset>
    {/* Honeypot: hidden from people and screen readers; bots that fill every input reveal themselves. */}
    <div className={styles.trap} aria-hidden="true"><label>Website<input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
    {formError && <p id="gv-form-error" className={styles.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <button type="submit" className={styles.submit} disabled={busy} aria-busy={busy}>
      {busy ? <><span className={styles.spinner} aria-hidden="true" />Registering…</> : <>Register<Icon name="arrow" /></>}
    </button>
  </form>;
}

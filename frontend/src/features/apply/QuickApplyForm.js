'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatPhone, phoneDigits } from '@/features/auth/login-helpers';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { CONSENT_VERSION, consentSentence, intakeYears, QUALIFICATIONS } from './apply-options';
import styles from './QuickApply.module.css';

const OTHER = '__other';
const UNDECIDED = '__undecided';
const UNDECIDED_TEXT = 'Not decided yet';
const ORDER = ['fullName', 'phone', 'email', 'city', 'course', 'qualification', 'score', 'intakeYear', 'consent'];
// API error keys ("applicant.phone") → form fields.
const FIELD_OF = {
  'applicant.fullName': 'fullName', 'applicant.phone': 'phone', 'applicant.email': 'email', 'applicant.city': 'city',
  'academics.highestQualification': 'qualification', 'academics.score': 'score', 'academics.scoreType': 'score',
  'preference.courseSlug': 'course', 'preference.programmeName': 'course', 'preference.intakeYear': 'intakeYear',
  'consent.contactConsent': 'consent', 'consent.privacyAccepted': 'consent', 'consent.version': 'consent',
};
const sentence = (text) => String(text).replace(/\.?$/, '.');

function check(values, { needsEmail, hasCourses }) {
  const errors = {};
  if (values.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!/^[6-9]\d{9}$/.test(values.phone)) errors.phone = values.phone ? 'Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.' : 'Enter your 10-digit mobile number.';
  if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.city.trim().length < 2) errors.city = 'Enter the city you live in.';
  if (hasCourses && !values.course) errors.course = 'Choose a course, or pick “Not decided yet”.';
  if (values.course === OTHER && !values.programmeName.trim()) errors.course = 'Type the programme you want.';
  if (values.score !== '') {
    const score = Number(values.score);
    const max = values.scoreType === 'cgpa' ? 10 : 100;
    if (!Number.isFinite(score) || score < 0 || score > max) errors.score = values.scoreType === 'cgpa' ? 'CGPA is between 0 and 10.' : 'Percentage is between 0 and 100.';
  }
  if (!values.consent) errors.consent = 'Tick the box so our team can contact you about this application.';
  return errors;
}

function sourceOf() {
  const params = new URLSearchParams(window.location.search);
  const utm = Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content']
    .map((key) => [`utm${key[0].toUpperCase()}${key.slice(1)}`, (params.get(`utm_${key}`) || '').slice(0, 100)]).filter(([, value]) => value));
  return { path: window.location.pathname.slice(0, 200), ...utm };
}

function bodyOf(values, { university, needsEmail }) {
  const courseSlug = values.course && values.course !== OTHER && values.course !== UNDECIDED ? values.course : '';
  const programmeName = values.course === UNDECIDED ? UNDECIDED_TEXT : values.programmeName.trim() || UNDECIDED_TEXT;
  const academics = {
    ...(values.qualification ? { highestQualification: values.qualification } : {}),
    ...(values.score !== '' ? { score: Number(values.score), scoreType: values.scoreType } : {}),
  };
  return {
    mode: 'quick',
    applicant: { fullName: values.fullName.trim(), phone: `+91${values.phone}`, ...(needsEmail ? { email: values.email.trim().toLowerCase() } : {}), ...(values.city.trim() ? { city: values.city.trim() } : {}) },
    ...(Object.keys(academics).length ? { academics } : {}),
    preference: { institutionSlug: university.id, ...(courseSlug ? { courseSlug } : { programmeName }), intakeYear: Number(values.intakeYear) },
    consent: { contactConsent: true, privacyAccepted: true, version: CONSENT_VERSION },
    source: sourceOf(),
  };
}

function Field({ id, label, optional, error, hint, wide, children }) {
  return <div className={styles.field} data-wide={wide || undefined}>
    <label className={styles.label} htmlFor={id}>{label}{optional && <span>Optional</span>}</label>
    {children}
    {hint && !error && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
    {error && <p id={`${id}-error`} className={styles.error}><Icon name="close" />{error}</p>}
  </div>;
}

/**
 * The one-screen quick application, used inline on /apply and inside the quick-apply popup.
 * @param {{ university: { id: string, name: string, city?: string, state?: string, logoUrl?: string },
 *   courseSlug?: string, courses?: { id: string, name: string }[], variant?: 'dialog'|'page',
 *   onDirtyChange?: (dirty: boolean) => void, onDone?: () => void }} props
 */
export default function QuickApplyForm({ university, courseSlug = '', courses: givenCourses, variant = 'page', onDirtyChange, onDone }) {
  const id = useId();
  const { student, openLogin } = useStudentAuth();
  const years = intakeYears();
  const resultRef = useRef(null);
  const [courses, setCourses] = useState(givenCourses ?? null);
  const [verifiedEmail, setVerifiedEmail] = useState(student?.email || '');
  const [phase, setPhase] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState(() => ({
    fullName: student?.name || '', phone: phoneDigits(student?.phone || ''), email: '', city: '',
    course: courseSlug && (!givenCourses || givenCourses.some((course) => course.id === courseSlug)) ? courseSlug : '', programmeName: '',
    qualification: '', score: '', scoreType: 'percentage', intakeYear: String(years.suggested), consent: false,
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Prefill (last application + verified contact) and, unless the page passed them, the university's courses.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.allSettled([
      api('/applications/prefill', { signal }),
      givenCourses ? Promise.resolve(null) : api(`/universities/${encodeURIComponent(university.id)}`, { signal }),
    ]).then(([prefill, detail]) => {
      if (signal.aborted) return;
      if ([prefill, detail].some((item) => item.status === 'rejected' && item.reason?.status === 401)) { setPhase('login'); return; }
      if (detail.status === 'fulfilled' && detail.value) {
        const list = detail.value.courses ?? [];
        setCourses(list);
        setValues((current) => (current.course && !list.some((course) => course.id === current.course) ? { ...current, course: '' } : current));
      } else if (!givenCourses) setCourses([]);
      if (prefill.status === 'fulfilled') {
        const { applicant = {}, academics, verified } = prefill.value;
        setVerifiedEmail(verified?.email || '');
        setValues((current) => ({
          ...current,
          fullName: current.fullName || applicant.fullName || '',
          phone: current.phone || phoneDigits(applicant.phone || ''),
          email: current.email || applicant.email || '',
          city: current.city || applicant.city || '',
          qualification: current.qualification || academics?.highestQualification || '',
          ...(current.score === '' && academics?.score !== null && academics?.score !== undefined ? { score: String(academics.score), scoreType: academics.scoreType || 'percentage' } : {}),
        }));
      }
      setPhase('ready');
    });
    return () => controller.abort();
  }, [university.id, givenCourses, attempt]);

  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const needsEmail = phase !== 'loading' && !verifiedEmail && !student?.email;
  const hasCourses = Boolean(courses?.length);
  const fieldId = (name) => `${id}-${name}`;
  const describe = (name, hint) => [errors[name] && `${fieldId(name)}-error`, hint && !errors[name] && `${fieldId(name)}-hint`].filter(Boolean).join(' ') || undefined;

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)));
    setFormError('');
    onDirtyChange?.(true);
  }
  function focusFirst(found) {
    const first = ORDER.find((name) => found[name]);
    if (first) window.requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
  }
  function relogin() { openLogin({ reason: 'apply', onSuccess: () => { setPhase('loading'); setAttempt((count) => count + 1); } }); }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const found = check(values, { needsEmail, hasCourses });
    setErrors(found); setFormError('');
    if (Object.keys(found).length) { focusFirst(found); return; }
    setBusy(true);
    try {
      const { item } = await api('/applications', { method: 'POST', body: bodyOf(values, { university, needsEmail }) });
      setResult({ ref: item.ref, duplicate: false });
      onDirtyChange?.(false);
    } catch (failure) {
      if (failure.status === 409) { setResult({ ref: failure.details?.ref || '', duplicate: true, message: failure.message }); onDirtyChange?.(false); return; }
      if (failure.status === 401) { setFormError('Your login has expired. Log in again, then send the form.'); relogin(); return; }
      const mapped = {};
      const other = [];
      for (const [key, message] of Object.entries(failure.fields ?? {})) {
        if (FIELD_OF[key]) mapped[FIELD_OF[key]] ??= sentence(message); else other.push(sentence(message));
      }
      setErrors(mapped);
      setFormError(other.join(' ') || (Object.keys(mapped).length ? '' : failure.status === 429 ? failure.message : sentence(failure.message)));
      focusFirst(mapped);
    } finally { setBusy(false); }
  }

  const Heading = variant === 'dialog' ? 'h3' : 'h2';
  if (result) {
    return <div ref={resultRef} tabIndex={-1} className={styles.result} data-variant={variant} role="status">
      <svg className={styles.tick} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 8 8 16-17" /></svg>
      <p className={styles.resultEyebrow}>{result.duplicate ? 'Already with our team' : 'Application received'}</p>
      <Heading className={styles.resultTitle}>{result.duplicate ? 'You have already applied here' : `Sent to our admissions team`}</Heading>
      <p className={styles.resultText}>{result.duplicate
        ? 'Your earlier application for this programme is still open, so there is no need to apply again.'
        : <>A Gyaan Vidhya counsellor will contact you on <strong>+91 {formatPhone(values.phone)}</strong> about {university.name}. Nothing is sent to the university without you.</>}</p>
      {result.ref && <p className={styles.ticket}><span>Reference</span><strong>{result.ref}</strong></p>}
      <div className={styles.resultActions}>
        <Link className="lux-button lux-button--primary lux-button--lg" href="/account#applications" onClick={onDone}>Track in My applications<Icon name="arrow" /></Link>
        {onDone ? <button type="button" className="lux-button lux-button--ghost lux-button--lg" onClick={onDone}>Done</button>
          : <Link className="lux-button lux-button--ghost lux-button--lg" href="/universities">Explore more universities</Link>}
      </div>
    </div>;
  }

  if (phase === 'login') {
    return <div className={styles.loginNotice} role="alert">
      <Icon name="lock" />
      <div><p><strong>Log in to apply.</strong> Verify your email with a one-time code and this form continues.</p>
        <button type="button" className="lux-button lux-button--primary" onClick={relogin}>Log in<Icon name="arrow" /></button></div>
    </div>;
  }

  return <form className={styles.form} data-variant={variant} onSubmit={submit} noValidate aria-busy={busy || undefined}>
    <div className={styles.grid}>
      <Field id={fieldId('fullName')} label="Full name" error={errors.fullName}>
        <input id={fieldId('fullName')} className={styles.input} autoComplete="name" maxLength={100} value={values.fullName}
          onChange={(event) => update('fullName', event.target.value)} aria-invalid={Boolean(errors.fullName) || undefined} aria-describedby={describe('fullName')} />
      </Field>
      <Field id={fieldId('phone')} label="Mobile number" error={errors.phone}>
        <span className={styles.affix} data-invalid={Boolean(errors.phone) || undefined}><span aria-hidden="true">+91</span>
          <input id={fieldId('phone')} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" maxLength={16} value={formatPhone(values.phone)}
            onChange={(event) => update('phone', phoneDigits(event.target.value))} aria-invalid={Boolean(errors.phone) || undefined} aria-describedby={describe('phone')} />
        </span>
      </Field>
      {needsEmail
        ? <Field id={fieldId('email')} label="Email" error={errors.email}>
          <input id={fieldId('email')} className={styles.input} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={values.email}
            onChange={(event) => update('email', event.target.value)} aria-invalid={Boolean(errors.email) || undefined} aria-describedby={describe('email')} />
        </Field>
        : <Field id={fieldId('email')} label="Email" hint="Verified at login. Our team replies here.">
          <span className={styles.verified}><Icon name="mail" />
            <input id={fieldId('email')} readOnly value={verifiedEmail || student?.email || 'Loading…'} aria-describedby={describe('email', true)} />
            <span className={styles.badge}><Icon name="check" />Verified</span>
          </span>
        </Field>}
      <Field id={fieldId('city')} label="Your city" error={errors.city}>
        <input id={fieldId('city')} className={styles.input} autoComplete="address-level2" maxLength={80} placeholder="e.g. Dehradun" value={values.city}
          onChange={(event) => update('city', event.target.value)} aria-invalid={Boolean(errors.city) || undefined} aria-describedby={describe('city')} />
      </Field>

      <Field id={fieldId('course')} label="Course you want" wide error={errors.course}
        hint={courses === null ? 'Loading this university’s courses…' : hasCourses ? '' : 'This university has no course list with us yet. Type what you want, or leave it blank if you are not sure.'}>
        {courses === null || hasCourses
          ? <select id={fieldId('course')} className={styles.input} value={values.course} disabled={courses === null}
            onChange={(event) => update('course', event.target.value)} aria-invalid={Boolean(errors.course) || undefined} aria-describedby={describe('course', courses === null)}>
            <option value="">{courses === null ? 'Loading courses…' : 'Choose a course'}</option>
            {(courses ?? []).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            <option value={OTHER}>Another programme (type it)</option>
            <option value={UNDECIDED}>Not decided yet</option>
          </select>
          : <input id={fieldId('course')} className={styles.input} maxLength={120} placeholder="e.g. B.Tech Computer Science" value={values.programmeName}
            onChange={(event) => update('programmeName', event.target.value)} aria-invalid={Boolean(errors.course) || undefined} aria-describedby={describe('course', true)} />}
        {values.course === OTHER && <input className={`${styles.input} ${styles.follow}`} aria-label="Programme you want" maxLength={120} placeholder="e.g. BBA in Business Analytics" value={values.programmeName}
          onChange={(event) => update('programmeName', event.target.value)} aria-invalid={Boolean(errors.course) || undefined} />}
      </Field>

      <Field id={fieldId('qualification')} label="Highest qualification" optional error={errors.qualification}>
        <select id={fieldId('qualification')} className={styles.input} value={values.qualification} onChange={(event) => update('qualification', event.target.value)}
          aria-invalid={Boolean(errors.qualification) || undefined} aria-describedby={describe('qualification')}>
          <option value="">Select</option>
          {QUALIFICATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
      <Field id={fieldId('score')} label="Score in it" optional error={errors.score}>
        <span className={styles.affix} data-invalid={Boolean(errors.score) || undefined}>
          <input id={fieldId('score')} type="text" inputMode="decimal" maxLength={5} placeholder={values.scoreType === 'cgpa' ? 'e.g. 8.2' : 'e.g. 82'} value={values.score}
            onChange={(event) => update('score', event.target.value.replace(/[^\d.]/g, ''))} aria-invalid={Boolean(errors.score) || undefined} aria-describedby={describe('score')} />
          <select className={styles.unit} aria-label="Score type" value={values.scoreType} onChange={(event) => update('scoreType', event.target.value)}>
            <option value="percentage">%</option><option value="cgpa">CGPA</option>
          </select>
        </span>
      </Field>

      <fieldset className={styles.intake} data-wide="true">
        <legend className={styles.label}>Intake year</legend>
        <div className={styles.years}>
          {years.options.map((year) => <label key={year} className={styles.year}>
            <input type="radio" name={fieldId('intakeYear')} id={year === years.options[0] ? fieldId('intakeYear') : undefined} value={year}
              checked={values.intakeYear === String(year)} onChange={(event) => update('intakeYear', event.target.value)} />
            <span>{year}{year === years.suggested && <small>Next intake</small>}</span>
          </label>)}
        </div>
        {errors.intakeYear && <p className={styles.error}><Icon name="close" />{errors.intakeYear}</p>}
      </fieldset>
    </div>

    <div className={styles.consent} data-invalid={Boolean(errors.consent) || undefined}>
      <input id={fieldId('consent')} type="checkbox" checked={values.consent} onChange={(event) => update('consent', event.target.checked)}
        aria-invalid={Boolean(errors.consent) || undefined} aria-describedby={errors.consent ? `${fieldId('consent')}-error` : undefined} />
      <label htmlFor={fieldId('consent')}>{consentSentence(university.name)} I have read the <Link href="/privacy-policy" target="_blank">Privacy policy</Link>.</label>
      {errors.consent && <p id={`${fieldId('consent')}-error`} className={styles.error}><Icon name="close" />{errors.consent}</p>}
    </div>

    {formError && <p className={styles.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <div className={styles.submitRow}>
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />Sending…</> : <>Send application<Icon name="arrow" /></>}
      </button>
      <p className={styles.reassure}><Icon name="lock" />Free. Takes about a minute.</p>
    </div>
  </form>;
}

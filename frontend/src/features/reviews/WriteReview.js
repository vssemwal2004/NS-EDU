'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { StarInput } from './Stars';
import styles from './Reviews.module.css';

// Fallbacks match backend/src/modules/reviews/schema.js; the server's /api/reviews/form wins when it loads.
const FALLBACK_FORM = {
  stages: [{ id: 'school', label: 'Class 11–12 student' }, { id: 'college', label: 'College student' }, { id: 'graduate', label: 'Graduate' }, { id: 'parent', label: 'Parent' }],
  limits: { name: [2, 60], course: [2, 80], institution: [0, 100], city: [0, 60], title: [0, 80], text: [30, 800] },
  consentText: 'Gyaan Vidhya may show this review publicly with my first name, last initial, course and city.',
};
const EMPTY = { rating: 0, stage: '', name: '', course: '', institution: '', city: '', title: '', text: '', consent: false };
const STATUS_COPY = {
  pending: { icon: 'clock', tone: 'warn', text: 'Your review is waiting for a quick check by our team. It appears publicly once approved.' },
  approved: { icon: 'checkCircle', tone: 'good', text: 'Your review is live. Editing it sends it back for a quick check before it shows again.' },
  rejected: { icon: 'alert', tone: 'bad', text: 'Your review was not published.' },
};

/**
 * "Write a review" button + dialog. Signed-out visitors are asked to log in first (Google sign-in
 * leaves the page, so it returns to /reviews?write=1, which reopens the form). `autoOpen` is set by
 * that page when it sees the flag.
 */
export default function WriteReview({ label = 'Write a review', className = 'lux-button lux-button--primary', autoOpen = false, onSaved }) {
  const { student, status, openLogin } = useStudentAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(FALLBACK_FORM);
  const [values, setValues] = useState(EMPTY);
  const [existing, setExisting] = useState(null);
  const [state, setState] = useState({ phase: 'idle', error: '', fields: {} });
  const autoOpened = useRef(false);
  const id = useId();

  const start = useCallback(async (who) => {
    setOpen(true);
    setState({ phase: 'loading', error: '', fields: {} });
    try {
      const [mine, config] = await Promise.all([api('/reviews/mine'), api('/reviews/form').catch(() => null)]);
      if (config?.stages) setForm(config);
      setExisting(mine.item);
      setValues(mine.item ? { ...EMPTY, ...mine.item, consent: false } : { ...EMPTY, name: who?.name || '' });
      setState({ phase: 'editing', error: '', fields: {} });
    } catch (error) {
      setState({ phase: 'failed', error: error.message, fields: {} });
    }
  }, []);

  const begin = () => {
    if (student) start(student);
    else openLogin({ reason: 'review', returnTo: '/reviews?write=1', onSuccess: (signedIn) => start(signedIn) });
  };

  useEffect(() => {
    if (!autoOpen || autoOpened.current || status === 'loading') return;
    autoOpened.current = true;
    // One-shot: drop ?write=1 so a refresh does not reopen the form.
    const url = new URL(window.location.href);
    url.searchParams.delete('write');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (!student) return undefined;
    // Opened after the page has painted, like a click would.
    const timer = window.setTimeout(() => start(student), 0);
    return () => window.clearTimeout(timer);
  }, [autoOpen, status, student, start]);

  const set = (key) => (event) => {
    const value = event?.target ? (event.target.type === 'checkbox' ? event.target.checked : event.target.value) : event;
    setValues((current) => ({ ...current, [key]: value }));
    setState((current) => (current.fields[key] ? { ...current, fields: { ...current.fields, [key]: undefined } } : current));
  };

  const submit = async (event) => {
    event.preventDefault();
    setState({ phase: 'saving', error: '', fields: {} });
    try {
      const { item } = await api('/reviews/mine', { method: 'PUT', body: { ...values, rating: Number(values.rating) } });
      setExisting(item);
      setState({ phase: 'saved', error: '', fields: {} });
      onSaved?.(item);
    } catch (error) {
      setState({ phase: 'editing', error: error.message, fields: error.fields || {} });
      // Move focus to the first field the server flagged.
      window.requestAnimationFrame(() => document.querySelector(`[data-review-form="${id}"] [aria-invalid="true"], [data-review-form="${id}"] [data-invalid="true"] input`)?.focus());
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete your review? This cannot be undone.')) return;
    setState((current) => ({ ...current, phase: 'saving' }));
    try {
      await api('/reviews/mine', { method: 'DELETE' });
      setExisting(null);
      setValues({ ...EMPTY, name: student?.name || '' });
      setState({ phase: 'deleted', error: '', fields: {} });
      onSaved?.(null);
    } catch (error) {
      setState({ phase: 'editing', error: error.message, fields: {} });
    }
  };

  const field = (key) => ({ id: `${id}-${key}`, value: values[key], onChange: set(key), 'aria-invalid': state.fields[key] ? true : undefined, 'aria-describedby': state.fields[key] ? `${id}-${key}-error` : undefined });
  const error = (key) => state.fields[key] && <p id={`${id}-${key}-error`} className={styles.fieldError}>{state.fields[key]}</p>;
  const max = (key) => form.limits[key]?.[1];
  const textLength = [...values.text].length;
  const busy = state.phase === 'saving';
  const statusInfo = existing && STATUS_COPY[existing.status];

  return <>
    <button type="button" className={className} onClick={begin}><Icon name="edit" />{label}</button>
    <Dialog open={open} onClose={() => setOpen(false)} title={existing ? 'Your review' : 'Write a review'} variant={styles.dialog}>
      {state.phase === 'loading' && <p className={styles.dialogNote} role="status">Loading…</p>}
      {state.phase === 'failed' && <div className={styles.dialogNote} role="alert"><p>{state.error}</p><button type="button" className="lux-button lux-button--outline lux-button--sm" onClick={() => start(student)}>Try again</button></div>}
      {(state.phase === 'saved' || state.phase === 'deleted') && <div className={styles.done} role="status">
        <span className={styles.doneIcon}><Icon name={state.phase === 'saved' ? 'checkCircle' : 'trash'} /></span>
        <h3>{state.phase === 'saved' ? 'Thank you for your review' : 'Your review was deleted'}</h3>
        <p>{state.phase === 'saved' ? 'Our team checks every review before it appears, to keep the page useful and free of spam. You can come back here to edit it at any time.' : 'You can write a new one whenever you like.'}</p>
        <button type="button" className="lux-button lux-button--primary" onClick={() => setOpen(false)}>Done</button>
      </div>}
      {(state.phase === 'editing' || state.phase === 'saving') && <form className={styles.form} onSubmit={submit} noValidate data-review-form={id}>
        {statusInfo && <p className={styles.statusNote} data-tone={statusInfo.tone}><Icon name={statusInfo.icon} /><span>{statusInfo.text}{existing.status === 'rejected' && existing.rejectReason ? ` Reason: ${existing.rejectReason}` : ''}</span></p>}
        {state.error && !Object.keys(state.fields).length && <p className={styles.formError} role="alert">{state.error}</p>}

        <StarInput value={Number(values.rating)} onChange={set('rating')} error={state.fields.rating} describedBy={state.fields.rating ? `${id}-rating-error` : undefined} />
        {error('rating')}

        <fieldset className={styles.chipsField} data-invalid={state.fields.stage ? true : undefined}>
          <legend className={styles.fieldLabel}>I am a <span aria-hidden="true">*</span></legend>
          <div className={styles.chips}>
            {form.stages.map((stage) => <label key={stage.id} className={styles.chipOption}>
              <input type="radio" name={`${id}-stage`} value={stage.id} checked={values.stage === stage.id} onChange={set('stage')} />
              <span>{stage.label}</span>
            </label>)}
          </div>
          {error('stage')}
        </fieldset>

        <div className={styles.grid2}>
          <div className={styles.field}><label htmlFor={`${id}-name`} className={styles.fieldLabel}>Your name <span aria-hidden="true">*</span></label>
            <input className="lux-field" autoComplete="name" maxLength={max('name')} required {...field('name')} />
            <p className={styles.hint}>Shown as first name and last initial.</p>{error('name')}</div>
          <div className={styles.field}><label htmlFor={`${id}-course`} className={styles.fieldLabel}>Course you chose or are exploring <span aria-hidden="true">*</span></label>
            <input className="lux-field" placeholder="e.g. B.Tech CSE, BBA, MBBS" maxLength={max('course')} required {...field('course')} />{error('course')}</div>
          <div className={styles.field}><label htmlFor={`${id}-institution`} className={styles.fieldLabel}>College or school <small>(optional)</small></label>
            <input className="lux-field" maxLength={max('institution')} {...field('institution')} />{error('institution')}</div>
          <div className={styles.field}><label htmlFor={`${id}-city`} className={styles.fieldLabel}>City <small>(optional)</small></label>
            <input className="lux-field" autoComplete="address-level2" maxLength={max('city')} {...field('city')} />{error('city')}</div>
        </div>

        <div className={styles.field}><label htmlFor={`${id}-title`} className={styles.fieldLabel}>Headline <small>(optional)</small></label>
          <input className="lux-field" placeholder="Sum up your experience in a line" maxLength={max('title')} {...field('title')} />{error('title')}</div>
        <div className={styles.field}><label htmlFor={`${id}-text`} className={styles.fieldLabel}>Your review <span aria-hidden="true">*</span></label>
          <textarea className="lux-field" rows={5} maxLength={max('text')} required placeholder="What helped you? What could be better? Be specific — it helps other students most." {...field('text')} />
          <p className={styles.counter} data-low={textLength < (form.limits.text?.[0] ?? 30) || undefined}>{textLength} / {max('text')} · at least {form.limits.text?.[0] ?? 30} characters</p>{error('text')}</div>

        <label className={styles.consent} data-invalid={state.fields.consent ? true : undefined}>
          <input type="checkbox" checked={values.consent} onChange={set('consent')} aria-invalid={state.fields.consent ? true : undefined} />
          <span>{form.consentText} Please don’t include phone numbers, emails or links.</span>
        </label>
        {error('consent')}

        <div className={styles.formActions}>
          {existing && <button type="button" className={`lux-button lux-button--ghost ${styles.delete}`} onClick={remove} disabled={busy}><Icon name="trash" />Delete</button>}
          <button type="button" className="lux-button lux-button--outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          <button type="submit" className="lux-button lux-button--primary" disabled={busy}>{busy ? 'Saving…' : existing ? 'Update review' : 'Submit review'}</button>
        </div>
      </form>}
    </Dialog>
  </>;
}

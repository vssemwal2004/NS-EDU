'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import styles from './ResourceManager.module.css';

// Converts a stored item to editable string state, and back to a typed payload.
function toFormValue(field, value) {
  if (field.type === 'boolean') return Boolean(value ?? field.default ?? false);
  if (field.type === 'numberArray4') return Array.isArray(value) ? value.map(String) : Array.isArray(field.default) ? field.default.map(String) : ['', '', '', ''];
  if (field.type === 'stringList') return Array.isArray(value) ? value.join(', ') : '';
  if (value === null || value === undefined) return field.default !== undefined && field.default !== null ? String(field.default) : '';
  return String(value);
}

export function initialValues(fields, item) {
  return Object.fromEntries(fields.map((field) => [field.name, toFormValue(field, item?.[field.name])]));
}

export function toPayload(fields, values, mode) {
  const payload = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === 'boolean') { payload[field.name] = value; continue; }
    if (field.type === 'numberArray4') {
      const filled = value.filter((part) => part.trim() !== '');
      if (!filled.length) { if (field.nullable) payload[field.name] = null; continue; }
      payload[field.name] = value.map((part) => part.trim() === '' ? NaN : Number(part));
      continue;
    }
    const text = value.trim();
    if (field.type === 'slug' && !text) continue; // the server generates it
    if (field.type === 'stringList') { payload[field.name] = text.split(',').map((part) => part.trim()).filter(Boolean); continue; }
    if (field.type === 'number' || field.type === 'integer') {
      if (!text) { if (field.nullable) payload[field.name] = null; continue; }
      payload[field.name] = Number(text);
      continue;
    }
    if (!text && field.nullable) { payload[field.name] = null; continue; }
    if (!text && !field.required && mode === 'create') continue;
    payload[field.name] = text;
  }
  return payload;
}

// Large reference lists (20k+ universities) are searched on the server instead of preloaded into a <select>.
function ReferenceSearch({ field, common, value, onChange }) {
  const [options, setOptions] = useState([]);
  const listId = `${common.id}-options`;
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api(`/admin/${field.ref}?${new URLSearchParams({ q: term, limit: '8' })}`, { signal: controller.signal })
        .then((data) => setOptions(data.items.map((item) => ({ value: item.slug, label: [item.name, item.city].filter(Boolean).join(' · ') }))))
        .catch(() => {});
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [field.ref, value]);
  return <>
    <input className={styles.input} {...common} type="text" list={listId} autoComplete="off" placeholder="Type a name, pick a slug" maxLength={100} value={value} onChange={(event) => onChange(event.target.value)} />
    <datalist id={listId}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>
  </>;
}

function Field({ field, value, error, onChange, refOptions }) {
  const id = `field-${field.name}`;
  const describedBy = [field.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy };
  let control;
  if (field.type === 'boolean') {
    control = <label className={styles.switch}><input type="checkbox" {...common} checked={value} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /><span>{value ? 'Yes' : 'No'}</span></label>;
  } else if (field.type === 'text') {
    control = <textarea className={styles.input} {...common} rows={3} maxLength={field.maxLength} value={value} onChange={(event) => onChange(event.target.value)} />;
  } else if (field.type === 'reference' && field.ref === 'institutions') {
    control = <ReferenceSearch field={field} common={common} value={value} onChange={onChange} />;
  } else if (field.type === 'select' || field.type === 'reference') {
    const options = field.type === 'select' ? field.options.filter(Boolean).map((option) => ({ value: option, label: option })) : refOptions || [];
    control = <select className={styles.input} {...common} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{field.type === 'reference' && !refOptions ? 'Loading…' : `Choose ${field.label.toLowerCase()}`}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  } else if (field.type === 'numberArray4') {
    control = <div className={styles.quad} role="group" aria-labelledby={`${id}-label`}>{['x', 'y', 'width', 'height'].map((part, index) => <label key={part}><span>{part}</span><input className={styles.input} type="number" inputMode="numeric" min={field.min} max={field.max} value={value[index]} aria-invalid={Boolean(error)} onChange={(event) => onChange(value.map((current, position) => position === index ? event.target.value : current))} /></label>)}</div>;
  } else {
    const numeric = field.type === 'number' || field.type === 'integer';
    control = <input className={styles.input} {...common} type={field.type === 'url' ? 'url' : numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : field.type === 'url' ? 'url' : undefined}
      step={field.type === 'integer' ? 1 : numeric ? 'any' : undefined} min={field.min} max={field.max} maxLength={field.maxLength} placeholder={field.type === 'slug' ? 'auto-generated' : field.type === 'url' ? 'https://' : undefined}
      value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  return <div className={styles.formField} data-wide={field.type === 'text' || field.type === 'numberArray4' || field.type === 'stringList'}>
    {field.type === 'numberArray4' ? <span id={`${id}-label`} className={styles.fieldLabel}>{field.label}{field.required && <em aria-hidden="true">*</em>}</span> : <label htmlFor={id} className={styles.fieldLabel}>{field.label}{field.required && <em aria-hidden="true">*</em>}</label>}
    {control}
    {field.help && <p id={`${id}-help`} className={styles.help}>{field.help}</p>}
    {error && <p id={`${id}-error`} className={styles.fieldError}>{error}</p>}
  </div>;
}

export default function ResourceForm({ meta, mode, item, refOptions, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(meta.fields, item));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const missing = meta.fields.filter((field) => field.required && field.type !== 'boolean' && (field.type === 'numberArray4' ? values[field.name].some((part) => part.trim() === '') : !values[field.name].trim()));
    if (missing.length) { setErrors(Object.fromEntries(missing.map((field) => [field.name, `${field.label} is required.`]))); setFormError('Please complete the required fields.'); return; }
    setBusy(true); setErrors({}); setFormError('');
    try { await onSubmit(toPayload(meta.fields, values, mode)); } catch (error) {
      setErrors(error.fields || {}); setFormError(error.message); setBusy(false);
    }
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <div className={styles.formGrid}>
      {meta.fields.map((field) => <Field key={field.name} field={field} value={values[field.name]} error={errors[field.name]} refOptions={refOptions[field.ref]}
        onChange={(value) => { setValues((previous) => ({ ...previous, [field.name]: value })); setErrors((previous) => ({ ...previous, [field.name]: undefined })); }} />)}
    </div>
    {formError && <p className={styles.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <div className={styles.formActions}>
      <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="submit" className="button button--primary" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? `Create ${meta.singular}` : 'Save changes'}</button>
    </div>
  </form>;
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import ImageField from './media/ImageField';
import cat from './catalogue/Catalogue.module.css';
import styles from './ResourceManager.module.css';

// Structured fields (programme rows, gallery, placements …) have no plain input; forms leave them alone.
export const isEditable = (field) => !field.machine && !['object', 'objectList'].includes(field.type);

// Lists are edited as one line: comma separated, or semicolon separated when a value contains a comma
// (programme names such as "B.Sc (Physics, Maths)"), so saving never splits a value in two.
const joinList = (list) => list.join(list.some((part) => part.includes(',')) ? '; ' : ', ');
const splitList = (text) => text.split(text.includes(';') ? ';' : ',').map((part) => part.trim()).filter(Boolean);

// Converts a stored item to editable string state, and back to a typed payload.
function toFormValue(field, value) {
  if (field.type === 'boolean') return Boolean(value ?? field.default ?? false);
  if (field.type === 'numberArray4') return Array.isArray(value) ? value.map(String) : Array.isArray(field.default) ? field.default.map(String) : ['', '', '', ''];
  if (field.type === 'stringList') return Array.isArray(value) ? joinList(value) : '';
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
    if (field.type === 'stringList') { payload[field.name] = splitList(text); continue; }
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

// An edit sends only what changed, so untouched fields are never rewritten (or locked against imports).
function changedOnly(fields, values, initial) {
  const next = toPayload(fields, values, 'edit');
  const before = toPayload(fields, initial, 'edit');
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])));
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
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [field.ref, value]);
  return <>
    <input className="adm-input" {...common} type="text" list={listId} autoComplete="off" placeholder="Type a name, pick a slug" maxLength={100} value={value} onChange={(event) => onChange(event.target.value)} />
    <datalist id={listId}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>
  </>;
}

const WIDE = ['text', 'numberArray4', 'stringList', 'image'];

function Field({ field, value, error, onChange, onBusyChange, refOptions }) {
  const id = `field-${field.name}`;
  const describedBy = [field.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy };
  const label = <>{field.label}{field.required && <em aria-hidden="true">*</em>}</>;
  // Help text sits behind an ⓘ beside the label (read out through aria-describedby), so the form stays calm.
  const hint = field.help && <i className={cat.hint} title={field.help} aria-hidden="true">i</i>;
  const help = field.help && <span id={`${id}-help`} className="sr-only">{field.help}</span>;
  if (field.type === 'boolean') {
    return <div className={cat.field} data-wide="true">
      <label className={cat.check}><input type="checkbox" {...common} checked={value} onChange={(event) => onChange(event.target.checked)} /><span className={cat.fieldLabel}>{field.label}{hint}</span></label>
      {help}
      {error && <p id={`${id}-error`} className="adm-error">{error}</p>}
    </div>;
  }
  let control;
  if (field.type === 'text') {
    control = <textarea className="adm-textarea" {...common} rows={field.maxLength > 1000 ? 6 : 3} maxLength={field.maxLength} value={value} onChange={(event) => onChange(event.target.value)} />;
  } else if (field.type === 'reference' && field.ref === 'institutions') {
    control = <ReferenceSearch field={field} common={common} value={value} onChange={onChange} />;
  } else if (field.type === 'select' || field.type === 'reference') {
    const listed = field.type === 'select' ? field.options.filter(Boolean).map((option) => ({ value: option, label: option })) : refOptions || [];
    // A stored value outside the list (old data) stays selectable instead of silently disappearing.
    const options = value && !listed.some((option) => option.value === value) ? [...listed, { value, label: value }] : listed;
    control = <select className="adm-select" {...common} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{field.type === 'reference' && !refOptions ? 'Loading…' : `Choose ${field.label.toLowerCase()}`}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  } else if (field.type === 'image') {
    control = <ImageField field={field} common={common} value={value} onChange={onChange} onBusyChange={onBusyChange} />;
  } else if (field.type === 'numberArray4') {
    control = <div className={styles.quad} role="group" aria-labelledby={`${id}-label`}>{['x', 'y', 'width', 'height'].map((part, index) => <label key={part}><span>{part}</span><input className="adm-input" type="number" inputMode="numeric" min={field.min} max={field.max} value={value[index]} aria-invalid={Boolean(error)} onChange={(event) => onChange(value.map((current, position) => position === index ? event.target.value : current))} /></label>)}</div>;
  } else {
    const numeric = field.type === 'number' || field.type === 'integer';
    control = <input className="adm-input" {...common} type={field.type === 'url' ? 'url' : numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : field.type === 'url' ? 'url' : undefined}
      step={field.type === 'integer' ? 1 : numeric ? 'any' : undefined} min={field.min} max={field.max} maxLength={field.maxLength} placeholder={field.type === 'slug' ? 'Generated from the name' : field.type === 'url' ? 'https://' : undefined}
      value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  return <div className={cat.field} data-wide={(field.wide ?? WIDE.includes(field.type)) || undefined}>
    {field.type === 'numberArray4' ? <span id={`${id}-label`} className={cat.fieldLabel}>{label}{hint}</span> : <span className={cat.fieldLabel}><label htmlFor={id}>{label}</label>{hint}</span>}
    {control}
    {help}
    {error && <p id={`${id}-error`} className="adm-error">{error}</p>}
  </div>;
}

/** Keeps the section index in step with the section scrolled into view. */
function useCurrentSection(rootRef, ids) {
  const [current, setCurrent] = useState(ids[0]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window.IntersectionObserver === 'undefined') return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      const top = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setCurrent(top.target.id.replace(/^section-/, ''));
    }, { root, rootMargin: '0px 0px -65% 0px' });
    ids.forEach((id) => { const node = root.querySelector(`#section-${id}`); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [rootRef, ids]);
  return [current, setCurrent];
}

/**
 * The generic record form, built from the API's field metadata.
 * layout="drawer": one grid of fields with a sticky footer (inside AdminDrawer).
 * layout="sections": `sections` [{ id, label, icon, description, fields: [names], extra?: (item) => node }] with an
 * index on the left and a sticky save footer (the university editor). Fields not named in any section go to the first.
 * `onDirtyChange(bool)` reports unsaved changes so the container can confirm before closing.
 */
export default function ResourceForm({ meta, mode, item, refOptions = {}, onSubmit, onCancel, onDirtyChange, layout = 'drawer', sections, fieldOverrides, footerNote }) {
  const fields = useMemo(() => meta.fields.filter(isEditable).map((field) => ({ ...field, ...fieldOverrides?.[field.name] })), [meta.fields, fieldOverrides]);
  const [initial] = useState(() => initialValues(fields, item));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  // Image fields still uploading: saving now would store the old URL and orphan the new upload.
  const [uploading, setUploading] = useState(() => new Set());
  const setFieldUploading = (name, on) => setUploading((previous) => {
    const next = new Set(previous);
    if (on) next.add(name); else next.delete(name);
    return next;
  });
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const groups = useMemo(() => {
    if (layout !== 'sections') return [];
    const named = new Set(sections.flatMap((section) => section.fields));
    const byName = new Map(fields.map((field) => [field.name, field]));
    return sections.map((section, index) => ({
      ...section,
      list: [...section.fields.map((name) => byName.get(name)).filter(Boolean), ...(index === 0 ? fields.filter((field) => !named.has(field.name)) : [])],
    }));
  }, [fields, layout, sections]);
  const sectionIds = useMemo(() => groups.map((group) => group.id), [groups]);
  const scroller = useRef(null);
  const [current, setCurrent] = useCurrentSection(scroller, sectionIds);

  async function submit(event) {
    event.preventDefault();
    if (uploading.size || busy) return;
    const missing = fields.filter((field) => field.required && field.type !== 'boolean' && (field.type === 'numberArray4' ? values[field.name].some((part) => part.trim() === '') : !values[field.name].trim()));
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((field) => [field.name, `${field.label} is required.`])));
      setFormError(`Complete the required field${missing.length === 1 ? '' : 's'}: ${missing.map((field) => field.label).join(', ')}.`);
      return;
    }
    const payload = mode === 'edit' ? changedOnly(fields, values, initial) : toPayload(fields, values, mode);
    if (mode === 'edit' && !Object.keys(payload).length) { onCancel(); return; }
    setBusy(true); setErrors({}); setFormError('');
    try { await onSubmit(payload); } catch (error) {
      setErrors(error.fields || {}); setFormError(error.message); setBusy(false);
    }
  }

  const fieldNode = (field) => <Field key={field.name} field={field} value={values[field.name]} error={errors[field.name]} refOptions={refOptions[field.ref]}
    onChange={(value) => { setValues((previous) => ({ ...previous, [field.name]: value })); setErrors((previous) => ({ ...previous, [field.name]: undefined })); }}
    onBusyChange={(on) => setFieldUploading(field.name, on)} />;
  const saveLabel = busy ? 'Saving…' : uploading.size ? 'Waiting for upload…' : mode === 'create' ? `Create ${meta.singular}` : 'Save changes';
  const errorBox = formError && <p className={cat.alert} role="alert"><Icon name="alert" />{formError}</p>;

  if (layout === 'sections') {
    const hasError = (group) => group.list.some((field) => errors[field.name]);
    return <div className={cat.sheetBody}>
      <nav className={cat.sectionNav} aria-label="Form sections">
        {groups.map((group) => <a key={group.id} href={`#section-${group.id}`} aria-current={current === group.id || undefined} data-error={hasError(group) || undefined}
          onClick={(event) => { event.preventDefault(); setCurrent(group.id); scroller.current?.querySelector(`#section-${group.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          {group.icon && <Icon name={group.icon} />}{group.label}{hasError(group) && <span className="sr-only"> (has errors)</span>}
        </a>)}
      </nav>
      <form className={cat.sheetForm} onSubmit={submit} noValidate>
        <div ref={scroller} className={cat.sheetScroll}>
          {errorBox}
          {groups.map((group) => <section key={group.id} id={`section-${group.id}`} className={cat.section} aria-labelledby={`section-${group.id}-title`}>
            <header><h3 id={`section-${group.id}-title`}>{group.label}</h3>{group.description && <i className={cat.hint} title={group.description} aria-hidden="true">i</i>}</header>
            <div className={cat.sectionBody}>
              {group.list.map(fieldNode)}
              {group.extra?.(item)}
            </div>
          </section>)}
        </div>
        <footer className={cat.footer}>
          <span className={cat.footerNote} data-tone={formError ? 'bad' : undefined} aria-live="polite">{formError ? 'Not saved — see the message above.' : dirty ? 'Unsaved changes' : footerNote}</span>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || uploading.size > 0}>{saveLabel}</button>
        </footer>
      </form>
    </div>;
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <div className={styles.formGrid}>{fields.map(fieldNode)}</div>
    {errorBox}
    <div className={styles.formActions}>
      <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || uploading.size > 0}>{saveLabel}</button>
    </div>
  </form>;
}

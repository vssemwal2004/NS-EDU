'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { formatCount, formatOf, MAX_FILE_BYTES, uploadText } from './data-api';
import styles from './DataOps.module.css';
import form from '../ResourceManager.module.css';

export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
const TYPES = ['university', 'college', 'institute', 'other'];

function Field({ id, label, required, error, help, children }) {
  return <div className={form.formField}>
    <label className={form.fieldLabel} htmlFor={id}>{label}{required && <em aria-hidden="true">*</em>}</label>
    {children}
    {help && <p className="adm-hint">{help}</p>}
    {error && <p className="adm-error">{error}</p>}
  </div>;
}

export function AddSourceForm({ onDone, onCancel }) {
  const { request } = useAdminSession();
  const [values, setValues] = useState({ name: '', website: '', state: '', city: '', type: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => { setValues((previous) => ({ ...previous, [key]: event.target.value })); setErrors((previous) => ({ ...previous, [key]: undefined })); };

  async function submit(event) {
    event.preventDefault();
    if (!values.name.trim() || !values.website.trim()) { setErrors({ name: values.name.trim() ? undefined : 'Enter the institution name.', website: values.website.trim() ? undefined : 'Enter the official website.' }); return; }
    setBusy(true); setFormError('');
    try {
      const { item } = await request('/data-ops/scraper/sources', { method: 'POST', body: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])) });
      onDone(item);
    } catch (failure) { setErrors(failure.fields || {}); setFormError(failure.message); setBusy(false); }
  }

  return <form className={form.form} onSubmit={submit} noValidate>
    <p className="adm-hint">Add one institution to crawl. Use its official website only (the domain the institution owns), not a portal or aggregator.</p>
    <div className={form.formGrid}>
      <Field id="source-name" label="Institution name" required error={errors.name}><input id="source-name" className="adm-input" maxLength={200} value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} /></Field>
      <Field id="source-website" label="Official website" required error={errors.website}><input id="source-website" className="adm-input" inputMode="url" placeholder="https://www.example.ac.in" maxLength={500} value={values.website} onChange={set('website')} aria-invalid={Boolean(errors.website)} /></Field>
      <Field id="source-state" label="State / UT" error={errors.state} help="Needed to publish automatically."><select id="source-state" className="adm-select" value={values.state} onChange={set('state')}><option value="">Detect from the website</option>{STATES.map((state) => <option key={state}>{state}</option>)}</select></Field>
      <Field id="source-city" label="City" error={errors.city}><input id="source-city" className="adm-input" maxLength={80} value={values.city} onChange={set('city')} /></Field>
      <Field id="source-type" label="Type" error={errors.type}><select id="source-type" className="adm-select" value={values.type} onChange={set('type')}><option value="">Detect from the name</option>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
    </div>
    {formError && <p className={form.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <div className={form.formActions}><button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Add source'}</button></div>
  </form>;
}

// Mirrors INSTITUTION_CATEGORIES in backend/src/modules/universities/schema.js.
const CATEGORIES = [
  ['central-university', 'Central university'], ['state-university', 'State university'], ['deemed-university', 'Deemed university'], ['private-university', 'Private university'],
  ['institute-of-national-importance', 'Institute of national importance'], ['autonomous-college', 'Autonomous college'], ['affiliated-college', 'Affiliated college'],
  ['standalone-institution', 'Standalone institution'], ['other', 'Other'],
];
// The editable fields of a crawl source (SOURCE_FIELDS in backend/src/scraper/sources.js; status has its own menu items).
const EDITABLE = ['name', 'website', 'state', 'city', 'type', 'category', 'institutionSlug', 'seedListName', 'notes'];

/** Edit one crawl source; sends only the fields that changed (PATCH /data-ops/scraper/sources/:id). */
export function EditSourceForm({ source, onDone, onCancel }) {
  const { request } = useAdminSession();
  const [initial] = useState(() => Object.fromEntries(EDITABLE.map((key) => [key, source[key] ?? ''])));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => { setValues((previous) => ({ ...previous, [key]: event.target.value })); setErrors((previous) => ({ ...previous, [key]: undefined })); };
  // A state the directory spelt differently stays selectable instead of silently changing.
  const states = values.state && !STATES.includes(values.state) ? [values.state, ...STATES] : STATES;

  async function submit(event) {
    event.preventDefault();
    if (!values.name.trim() || !values.website.trim()) { setErrors({ name: values.name.trim() ? undefined : 'Enter the institution name.', website: values.website.trim() ? undefined : 'Enter the official website.' }); return; }
    const changes = Object.fromEntries(EDITABLE.filter((key) => values[key].trim() !== String(initial[key]).trim()).map((key) => [key, values[key].trim()]));
    if (!Object.keys(changes).length) { onCancel(); return; }
    setBusy(true); setFormError('');
    try {
      const { item } = await request(`/data-ops/scraper/sources/${source.id}`, { method: 'PATCH', body: changes });
      onDone(item, changes);
    } catch (failure) { setErrors(failure.fields || {}); setFormError(failure.message); setBusy(false); }
  }

  return <form className={form.form} onSubmit={submit} noValidate>
    <p className="adm-hint">Changing the website or the target university clears the last crawl result and cancels queued jobs for this source, so the next crawl uses the corrected details.</p>
    <div className={form.formGrid}>
      <Field id="edit-source-name" label="Institution name" required error={errors.name}><input id="edit-source-name" className="adm-input" maxLength={200} value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} /></Field>
      <Field id="edit-source-website" label="Official website" required error={errors.website}><input id="edit-source-website" className="adm-input" inputMode="url" maxLength={500} value={values.website} onChange={set('website')} aria-invalid={Boolean(errors.website)} /></Field>
      <Field id="edit-source-state" label="State / UT" error={errors.state}><select id="edit-source-state" className="adm-select" value={values.state} onChange={set('state')}><option value="">Detect from the website</option>{states.map((state) => <option key={state}>{state}</option>)}</select></Field>
      <Field id="edit-source-city" label="City" error={errors.city}><input id="edit-source-city" className="adm-input" maxLength={80} value={values.city} onChange={set('city')} /></Field>
      <Field id="edit-source-type" label="Type" error={errors.type}><select id="edit-source-type" className="adm-select" value={values.type} onChange={set('type')}><option value="">Detect from the name</option>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
      <Field id="edit-source-category" label="Category" error={errors.category}><select id="edit-source-category" className="adm-select" value={values.category} onChange={set('category')}><option value="">Not set</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field id="edit-source-target" label="Target university slug" error={errors.institutionSlug} help="Optional. The catalogue record this source should update; without it the crawler matches by name and domain."><input id="edit-source-target" className="adm-input" maxLength={100} value={values.institutionSlug} placeholder="e.g. graphic-era-university" onChange={set('institutionSlug')} /></Field>
      <Field id="edit-source-list" label="Seed list" error={errors.seedListName}><input id="edit-source-list" className="adm-input" maxLength={80} value={values.seedListName} onChange={set('seedListName')} /></Field>
      <Field id="edit-source-notes" label="Notes" error={errors.notes}><textarea id="edit-source-notes" className="adm-textarea" rows={3} maxLength={500} value={values.notes} onChange={set('notes')} /></Field>
    </div>
    {formError && <p className={form.formError} role="alert"><Icon name="shield" />{formError}</p>}
    <div className={form.formActions}><button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

export function SeedUploadForm({ onDone, onCancel }) {
  const [file, setFile] = useState(null);
  const [listName, setListName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function choose(selected) {
    setResult(null); setError('');
    const format = selected ? formatOf(selected) : '';
    if (selected && !format) setError('Choose a .csv or .json file.');
    else if (selected?.size > MAX_FILE_BYTES) setError('Seed lists are limited to 5 MB per upload.');
    if (!format || selected.size > MAX_FILE_BYTES) { setFile(null); return; }
    setFile({ name: selected.name, format, text: await selected.text() });
    setListName((previous) => previous || selected.name.replace(/\.[a-z]+$/i, ''));
  }

  async function upload() {
    setBusy(true); setError('');
    try {
      const data = await uploadText('/scraper/sources/import', file.text, { format: file.format, seedListName: listName.trim() || file.name });
      setResult(data); onDone(data);
    } catch (failure) { setError(failure.message); }
    setBusy(false);
  }

  return <div className={form.form}>
    <p className="adm-hint">A seed list names the institutions to crawl, for example a directory list downloaded from an official source. Columns: <strong>name</strong> and <strong>website</strong> (required), <strong>state</strong>, <strong>city</strong>, <strong>type</strong>, <strong>category</strong>. Common header variants such as “Name of the Institution” or “Website URL” are recognised. Rows without a website are skipped. Existing sources are matched by website and updated.</p>
    <label className={styles.drop}>
      <Icon name="document" />
      <input type="file" accept=".csv,.json,.tsv,.txt,text/csv,application/json" onChange={(event) => choose(event.target.files?.[0])} />
      <strong>{file ? file.name : 'Select a CSV or JSON seed list'}</strong><span>Up to 5 MB</span>
    </label>
    <div className={form.formField}><label className={form.fieldLabel} htmlFor="seed-name">Seed list name</label><input id="seed-name" className="adm-input" maxLength={80} value={listName} onChange={(event) => setListName(event.target.value)} placeholder="e.g. State universities, Oct 2026" /><p className="adm-hint">Shown on each source so you can filter and re-queue a list later.</p></div>
    {result && <dl className={styles.summary}>
      {[['Added', result.inserted], ['Updated', result.updated], ['Duplicate rows', result.duplicates], ['Rejected', result.failed, 'bad']].map(([label, value, tone]) => <div key={label} data-tone={tone && value ? tone : undefined}><dt>{label}</dt><dd>{formatCount(value)}</dd></div>)}
    </dl>}
    {result?.errors?.length > 0 && <ul className="adm-hint">{result.errors.slice(0, 8).map((item) => <li key={item.row}>Row {item.row} {item.name}: {Object.values(item.errors).join('; ')}</li>)}</ul>}
    {error && <p className={form.formError} role="alert"><Icon name="shield" />{error}</p>}
    <div className={form.formActions}><button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>{result ? 'Close' : 'Cancel'}</button><button type="button" className="adm-btn adm-btn--primary" disabled={!file || busy} onClick={upload}>{busy ? 'Uploading…' : 'Upload seed list'}</button></div>
  </div>;
}

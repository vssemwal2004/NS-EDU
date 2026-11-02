'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { INDIAN_STATES } from '@/features/apply/apply-options';
import styles from './Drives.module.css';

const EMPTY = { name: '', district: '', state: '', city: '', campaign: '', title: '' };

/** One labelled input: label above, help or the field error under it. */
export function TextField({ id, label, value, onChange, error, help, required = false, wide = false, textarea = false, ...input }) {
  const Tag = textarea ? 'textarea' : 'input';
  const described = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return <div className={styles.field} data-wide={wide || undefined}>
    <label className="adm-label" htmlFor={id}><span>{label}{required && <span className={styles.req} aria-hidden="true">*</span>}</span></label>
    <Tag id={id} className={textarea ? 'adm-textarea' : 'adm-input'} value={value} required={required} aria-invalid={error ? true : undefined}
      aria-describedby={described} onChange={(event) => onChange(event.target.value)} {...input} />
    {error ? <span id={`${id}-error`} className="adm-error">{error}</span> : help && <span id={`${id}-help`} className="adm-hint">{help}</span>}
  </div>;
}

/** School details for a new drive (and for editing them in Settings). `districts` feeds the district suggestions. */
export function SchoolFields({ value, onChange, errors = {}, districts = [], idPrefix }) {
  const id = (name) => `${idPrefix}-${name}`;
  const set = (name) => (next) => onChange({ ...value, [name]: next });
  return <div className={styles.grid}>
    <TextField id={id('name')} label="School name" value={value.name} onChange={set('name')} error={errors.name} required wide maxLength={150} autoComplete="off" />
    <div className={styles.field}>
      <label className="adm-label" htmlFor={id('state')}><span>State<span className={styles.req} aria-hidden="true">*</span></span></label>
      <select id={id('state')} className="adm-select" value={value.state} required aria-invalid={errors.state ? true : undefined} onChange={(event) => onChange({ ...value, state: event.target.value })}>
        <option value="">Choose a state</option>
        {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
      </select>
      {errors.state && <span className="adm-error">{errors.state}</span>}
    </div>
    <TextField id={id('district')} label="District" value={value.district} onChange={set('district')} error={errors.district} required maxLength={80} list={id('districts')} autoComplete="off" />
    <datalist id={id('districts')}>{districts.map((district) => <option key={district} value={district} />)}</datalist>
    <TextField id={id('city')} label="City or town" value={value.city} onChange={set('city')} error={errors.city} maxLength={80} />
  </div>;
}

// Server errors come back as "school.name"; the drawer's inputs are keyed by the bare name.
export const schoolErrors = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([key, message]) => [key.replace(/^school\./, ''), message]));

export default function NewDriveDrawer({ open, onClose, request, groups = [], onCreated }) {
  const [value, setValue] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: '' });
  const districts = [...new Set(groups.filter((group) => !value.state || group.state === value.state).flatMap((group) => group.districts.map((item) => item.district)))].sort();

  function close() { setValue(EMPTY); setErrors({}); setState({ busy: false, error: '' }); onClose(); }

  async function submit(event) {
    event.preventDefault();
    const missing = Object.fromEntries([['name', 'Enter the school name.'], ['state', 'Choose a state.'], ['district', 'Enter the district.']].filter(([key]) => !value[key].trim()));
    setErrors(missing);
    if (Object.keys(missing).length) { setState({ busy: false, error: '' }); return; }
    setState({ busy: true, error: '' });
    try {
      const { item } = await request('/drives', { method: 'POST', body: {
        school: { name: value.name, district: value.district, state: value.state, city: value.city }, campaign: value.campaign, title: value.title,
      } });
      setValue(EMPTY); setErrors({}); setState({ busy: false, error: '' });
      onCreated(item);
    } catch (failure) {
      setErrors(schoolErrors(failure.fields ?? {}));
      setState({ busy: false, error: failure.message });
    }
  }

  return <AdminDrawer open={open} onClose={close} title="New school drive" subtitle="Creates a registration form with its own QR code and link.">
    <form className={styles.form} onSubmit={submit} noValidate>
      <h3 className={styles.formSection}>School</h3>
      <SchoolFields value={value} onChange={setValue} errors={errors} districts={districts} idPrefix="new-drive" />
      <h3 className={styles.formSection}>Registration form</h3>
      <div className={styles.grid}>
        <TextField id="new-drive-campaign" label="Campaign" value={value.campaign} onChange={(campaign) => setValue({ ...value, campaign })} error={errors.campaign} maxLength={120} placeholder="e.g. October 2026 visits" />
        <TextField id="new-drive-title" label="Form title" value={value.title} onChange={(title) => setValue({ ...value, title })} error={errors.title} maxLength={150} placeholder={`Student registration — ${value.name || 'school'}`} />
      </div>
      <p className="adm-hint">Name, mobile, email, class and stream are included. Add your own questions in the form builder next.</p>
      {state.error && <p className={styles.formError} role="alert"><Icon name="alert" />{state.error}</p>}
      <div className={styles.drawerFooter}>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={close}>Cancel</button>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={state.busy}>{state.busy ? 'Creating…' : 'Create drive'}</button>
      </div>
    </form>
  </AdminDrawer>;
}

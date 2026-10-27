'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import { INDIAN_STATES } from '@/features/apply/apply-options';
import rm from '@/features/admin/ResourceManager.module.css';

const EMPTY = { name: '', district: '', state: '', city: '', campaign: '', title: '' };

/** School details for a new drive (and for editing them in Settings). `districts` feeds the district suggestions. */
export function SchoolFields({ value, onChange, errors = {}, districts = [], idPrefix }) {
  const id = (name) => `${idPrefix}-${name}`;
  const field = (name, label, { required = false, wide = false, ...input } = {}) => <div className={rm.formField} data-wide={wide || undefined}>
    <label className={rm.fieldLabel} htmlFor={id(name)}>{label}{required && <em aria-hidden="true">*</em>}</label>
    <input id={id(name)} className={rm.input} value={value[name]} required={required} aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? `${id(name)}-error` : undefined} onChange={(event) => onChange({ ...value, [name]: event.target.value })} {...input} />
    {errors[name] && <span id={`${id(name)}-error`} className={rm.fieldError}>{errors[name]}</span>}
  </div>;
  return <div className={rm.formGrid}>
    {field('name', 'School name', { required: true, wide: true, maxLength: 150, autoComplete: 'off' })}
    <div className={rm.formField}>
      <label className={rm.fieldLabel} htmlFor={id('state')}>State<em aria-hidden="true">*</em></label>
      <select id={id('state')} className={rm.input} value={value.state} required aria-invalid={errors.state ? true : undefined} onChange={(event) => onChange({ ...value, state: event.target.value })}>
        <option value="">Choose a state</option>
        {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
      </select>
      {errors.state && <span className={rm.fieldError}>{errors.state}</span>}
    </div>
    {field('district', 'District', { required: true, maxLength: 80, list: id('districts'), autoComplete: 'off' })}
    <datalist id={id('districts')}>{districts.map((district) => <option key={district} value={district} />)}</datalist>
    {field('city', 'City or town', { maxLength: 80 })}
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
    <form className={rm.form} onSubmit={submit} noValidate>
      <SchoolFields value={value} onChange={setValue} errors={errors} districts={districts} idPrefix="new-drive" />
      <div className={rm.formGrid}>
        <div className={rm.formField}>
          <label className={rm.fieldLabel} htmlFor="new-drive-campaign">Campaign</label>
          <input id="new-drive-campaign" className={rm.input} value={value.campaign} maxLength={120} placeholder="e.g. October 2026 visits" onChange={(event) => setValue({ ...value, campaign: event.target.value })} />
        </div>
        <div className={rm.formField}>
          <label className={rm.fieldLabel} htmlFor="new-drive-title">Form title</label>
          <input id="new-drive-title" className={rm.input} value={value.title} maxLength={150} placeholder={`Student registration — ${value.name || 'school'}`} onChange={(event) => setValue({ ...value, title: event.target.value })} />
        </div>
      </div>
      <p className={rm.help}>Name, mobile, email, class and stream are added for you. Add your own questions in the form builder next.</p>
      {state.error && <p className={rm.formError} role="alert"><Icon name="shield" />{state.error}</p>}
      <div className={rm.formActions}>
        <button type="button" className="button button--ghost" onClick={close}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={state.busy}>{state.busy ? 'Creating…' : 'Create drive'}</button>
      </div>
    </form>
  </AdminDrawer>;
}

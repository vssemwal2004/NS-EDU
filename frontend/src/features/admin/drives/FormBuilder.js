'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import FormFields from '@/features/registration/FormFields';
import { CHOICE_TYPES, FIELD_TYPES, fieldsPayload, fieldTypeLabel, LOCKED_FIELDS, MAX_FIELDS, MAX_OPTIONS, newField, previewField, sameFields, withKeys } from './drive-format';
import styles from './Drives.module.css';

const typeIcon = (type) => FIELD_TYPES.find((item) => item.value === type)?.icon ?? 'edit';

// Server errors are keyed "fields.<index>.<prop>"; the editor keys them by field so they follow reordering.
function errorsByField(fields, serverErrors = {}) {
  const result = {};
  for (const [path, message] of Object.entries(serverErrors)) {
    const match = /^fields\.(\d+)(?:\.(\w+))?$/.exec(path);
    const field = match && fields[Number(match[1])];
    if (field) result[field.key] = { ...result[field.key], [match[2] ?? 'label']: message };
  }
  return result;
}

function OptionsEditor({ field, onChange, error, idBase }) {
  const options = field.options;
  const set = (next) => onChange({ options: next });
  return <fieldset className={styles.options}>
    <legend className="adm-label">Choices</legend>
    <ol>
      {options.map((option, index) => <li key={index}>
        <span className={styles.optionMark} data-type={field.type} aria-hidden="true" />
        <input className="adm-input" value={option} maxLength={80} aria-label={`Choice ${index + 1}`} id={`${idBase}-option-${index}`}
          onChange={(event) => set(options.map((item, at) => (at === index ? event.target.value : item)))}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (options.length < MAX_OPTIONS) { set([...options.slice(0, index + 1), '', ...options.slice(index + 1)]); window.requestAnimationFrame(() => document.getElementById(`${idBase}-option-${index + 1}`)?.focus()); }
          }} />
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon adm-btn--sm" data-tone="danger" disabled={options.length <= 1} aria-label={`Remove choice ${option || index + 1}`} onClick={() => set(options.filter((_, at) => at !== index))}><Icon name="close" /></button>
      </li>)}
    </ol>
    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" disabled={options.length >= MAX_OPTIONS} onClick={() => set([...options, ''])}><Icon name="plus" />Add choice</button>
    {error ? <span className="adm-error">{error}</span> : <span className="adm-hint">Up to {MAX_OPTIONS} choices, 80 characters each. Press Enter to add the next one.</span>}
  </fieldset>;
}

function FieldEditor({ field, index, count, expanded, onToggle, onChange, onMove, onRemove, errors = {}, typeLocked }) {
  const idBase = useId();
  const locked = LOCKED_FIELDS.includes(field.id);
  const title = field.label || 'Untitled question';
  return <li className={styles.fieldCard} data-field-key={field.key} data-expanded={expanded || undefined} data-hidden={!field.enabled || undefined} data-invalid={Object.keys(errors).length ? true : undefined}>
    <div className={styles.fieldRow}>
      <div className={styles.reorder}>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon adm-btn--sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move “${title}” up`}><Icon name="arrowUp" /></button>
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon adm-btn--sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move “${title}” down`}><Icon name="arrowUp" className={styles.down} /></button>
      </div>
      <button type="button" className={styles.fieldSummary} aria-expanded={expanded} aria-controls={`${idBase}-panel`} onClick={onToggle}>
        <span className={styles.typeIcon}><Icon name={typeIcon(field.type)} /></span>
        <span className={styles.fieldName}><strong>{title}</strong>
          <small>{fieldTypeLabel(field.type)}{field.builtIn ? ' · Built-in' : ''}{field.enabled ? (field.required ? ' · Required' : ' · Optional') : ' · Hidden'}</small>
        </span>
        {locked && <Icon name="lock" className={styles.lockIcon} />}
        <Icon name="chevron" className={styles.chevron} />
      </button>
      {!field.builtIn && <button type="button" className="adm-btn adm-btn--ghost adm-btn--icon adm-btn--sm" data-tone="danger" onClick={onRemove} aria-label={`Delete “${title}”`} title="Delete question"><Icon name="trash" /></button>}
    </div>
    {expanded && <div id={`${idBase}-panel`} className={styles.fieldPanel}>
      <div className={styles.grid}>
        <div className={styles.field} data-wide="true">
          <label className="adm-label" htmlFor={`${idBase}-label`}><span>Question<span className={styles.req} aria-hidden="true">*</span></span></label>
          <input id={`${idBase}-label`} className="adm-input" value={field.label} maxLength={120} aria-invalid={errors.label ? true : undefined} onChange={(event) => onChange({ label: event.target.value })} />
          {errors.label && <span className="adm-error">{errors.label}</span>}
        </div>
        <div className={styles.field} data-wide="true">
          <label className="adm-label" htmlFor={`${idBase}-help`}>Help text</label>
          <input id={`${idBase}-help`} className="adm-input" value={field.help} maxLength={200} placeholder="Optional hint under the question" onChange={(event) => onChange({ help: event.target.value })} />
        </div>
        {!field.builtIn && <div className={styles.field}>
          <label className="adm-label" htmlFor={`${idBase}-type`}>Answer type</label>
          <select id={`${idBase}-type`} className="adm-select" value={field.type} disabled={typeLocked} aria-describedby={typeLocked ? `${idBase}-type-help` : undefined}
            onChange={(event) => onChange({ type: event.target.value, options: CHOICE_TYPES.includes(event.target.value) && !field.options.length ? ['Option 1', 'Option 2'] : field.options })}>
            {FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          {typeLocked && <span id={`${idBase}-type-help`} className="adm-hint">Students have answered this question, so its type is fixed. Add a new question instead.</span>}
          {errors.type && <span className="adm-error">{errors.type}</span>}
        </div>}
      </div>
      {field.builtIn && CHOICE_TYPES.includes(field.type) && <p className="adm-hint">Choices: {field.options.join(', ')}. These are fixed so leads can be filtered by class and stream.</p>}
      {!field.builtIn && CHOICE_TYPES.includes(field.type) && <OptionsEditor field={field} onChange={onChange} error={errors.options} idBase={idBase} />}
      <div className={styles.switches}>
        <label className={styles.switch}><input type="checkbox" checked={field.enabled} disabled={locked} onChange={(event) => onChange({ enabled: event.target.checked, required: event.target.checked && field.required })} /><span /><span>Show on form</span></label>
        <label className={styles.switch}><input type="checkbox" checked={field.required} disabled={locked || !field.enabled} onChange={(event) => onChange({ required: event.target.checked })} /><span /><span>Required</span></label>
      </div>
      {locked && <p className="adm-hint"><Icon name="lock" /> Name and mobile number are always asked: every registration needs them for follow-up.</p>}
      {errors.id && <span className="adm-error">{errors.id}</span>}
    </div>}
  </li>;
}

export default function FormBuilder({ item, request, onSaved, onDirtyChange, toast }) {
  const [fields, setFields] = useState(() => withKeys(item.fields));
  const [expanded, setExpanded] = useState('');
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: '' });
  const [previewValues, setPreviewValues] = useState({});
  const dirty = !sameFields(fields, item.fields);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const preview = useMemo(() => fields.filter((field) => field.enabled).map(previewField), [fields]);
  const typeLocked = (field) => Boolean(field.id) && item.submissionCount > 0;

  const change = (key, patch) => {
    setFields((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)));
    setErrors((current) => (current[key] ? { ...current, [key]: {} } : current));
  };
  const move = (index, delta) => setFields((current) => {
    const next = [...current];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  });
  function add(type) {
    const field = newField(type);
    setFields((current) => [...current, field]);
    setExpanded(field.key);
    window.requestAnimationFrame(() => document.querySelector(`[data-field-key="${field.key}"] input`)?.focus());
  }
  function discard() { setFields(withKeys(item.fields)); setErrors({}); setState({ busy: false, error: '' }); }

  async function save() {
    setState({ busy: true, error: '' });
    try {
      const { item: saved } = await request(`/drives/${item.id}`, { method: 'PATCH', body: { fields: fieldsPayload(fields), expectedUpdatedAt: item.updatedAt } });
      setFields(withKeys(saved.fields)); setErrors({}); setState({ busy: false, error: '' });
      onSaved(saved);
      toast.success('Form saved. The link and QR code are unchanged.');
    } catch (failure) {
      const mapped = errorsByField(fields, failure.fields ?? {});
      setErrors(mapped);
      const first = Object.keys(mapped)[0];
      if (first) setExpanded(first);
      setState({ busy: false, error: failure.fields?.fields ?? failure.message });
    }
  }

  return <div className={styles.builder}>
    <div className={styles.builderMain}>
      {item.submissionCount > 0 && <p className={styles.notice}><Icon name="shield" />{item.submissionCount.toLocaleString('en-IN')} students have registered. Edits apply to new registrations; earlier answers keep the question text they saw.</p>}
      <ol className={styles.fieldList} aria-label="Questions">
        {fields.map((field, index) => <FieldEditor key={field.key} field={field} index={index} count={fields.length} expanded={expanded === field.key} errors={errors[field.key]} typeLocked={typeLocked(field)}
          onToggle={() => setExpanded((current) => (current === field.key ? '' : field.key))}
          onChange={(patch) => change(field.key, patch)} onMove={(delta) => move(index, delta)}
          onRemove={() => setFields((current) => current.filter((entry) => entry.key !== field.key))} />)}
      </ol>
      <div className={styles.addPanel}>
        <p className="adm-label">Add a question <small className="adm-hint">{fields.length} of {MAX_FIELDS}</small></p>
        <div className={styles.addTypes}>
          {FIELD_TYPES.map((type) => <button key={type.value} type="button" className={styles.addType} disabled={fields.length >= MAX_FIELDS} onClick={() => add(type.value)}>
            <Icon name={type.icon} />{type.label}
          </button>)}
        </div>
      </div>
      <div className={styles.saveBar} data-dirty={dirty || undefined}>
        <span role="status">{state.error ? <span className="adm-error">{state.error}</span> : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button type="button" className="adm-btn" disabled={!dirty || state.busy} onClick={discard}>Discard</button>
        <button type="button" className="adm-btn adm-btn--primary" disabled={!dirty || state.busy} onClick={save}>{state.busy ? 'Saving…' : 'Save form'}</button>
      </div>
    </div>

    <aside className={styles.previewColumn} aria-label="Live preview">
      <p className={styles.previewLabel}><Icon name="phone" />Live preview</p>
      <div className={styles.phone}>
        <div className={styles.phoneScreen}>
          <p className={styles.previewSchool}>{item.school.name}</p>
          <p className={styles.previewPlace}>{[item.school.district, item.school.state].filter(Boolean).join(', ')}</p>
          <div className={styles.previewForm}>
            <FormFields fields={preview} values={previewValues} onChange={(id, value) => setPreviewValues((current) => ({ ...current, [id]: value }))} idPrefix="preview" />
            <ul className={styles.previewConsents}>
              <li>{item.consentText}</li><li>{item.consent.privacy}</li>{item.guardianConsent && <li>{item.consent.guardian}</li>}
            </ul>
            <span className={styles.previewSubmit} aria-hidden="true">Register</span>
          </div>
        </div>
      </div>
    </aside>
  </div>;
}

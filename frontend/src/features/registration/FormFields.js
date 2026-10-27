'use client';
/**
 * Renders school drive questions from their public definition ({ id, label, type, required, help, options[{value,label}] }).
 * Shared by the public /r/[code] form and the admin builder's live preview, so both always look the same.
 */
import Icon from '@/components/ui/Icon';
import styles from './Registration.module.css';

const AUTOCOMPLETE = { fullName: 'name', phone: 'tel-national', email: 'email' };
const INPUT_TYPES = { text: 'text', email: 'email', number: 'text', date: 'date' };

export const isBlank = (value) => value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
export const PHONE_PATTERN = /^(?:\+?91|0)?[6-9]\d{9}$/;

/** Quick checks before the request; the server repeats every one of them. */
export function checkAnswers(fields, values) {
  const errors = {};
  for (const field of fields) {
    const value = values[field.id];
    if (isBlank(value)) { if (field.required) errors[field.id] = field.type === 'checkbox' || field.type === 'radio' || field.type === 'select' ? 'Choose an option' : 'This field is required'; continue; }
    if (field.type === 'phone' && !PHONE_PATTERN.test(String(value).replace(/[\s-]/g, ''))) errors[field.id] = 'Enter a valid 10-digit mobile number';
    else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) errors[field.id] = 'Enter a valid email address';
    else if (field.type === 'number' && !Number.isFinite(Number(String(value).trim()))) errors[field.id] = 'Enter a number';
    else if (field.id === 'fullName' && String(value).trim().length < 2) errors[field.id] = 'Enter your full name';
  }
  return errors;
}

function Choices({ field, value, onChange, disabled, describedBy, invalid, inputId }) {
  const multiple = field.type === 'checkbox';
  const chosen = multiple ? (Array.isArray(value) ? value : []) : value;
  return <div className={styles.choices} role={multiple ? 'group' : 'radiogroup'} aria-labelledby={`${inputId}-label`} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
    {field.options.map((option) => {
      const checked = multiple ? chosen.includes(option.value) : chosen === option.value;
      return <label key={option.value} className={styles.choice}>
        <input type={multiple ? 'checkbox' : 'radio'} name={inputId} value={option.value} checked={checked} disabled={disabled}
          onChange={(event) => onChange(multiple ? (event.target.checked ? [...chosen, option.value] : chosen.filter((item) => item !== option.value)) : option.value)} />
        <span><Icon name="check" />{option.label}</span>
      </label>;
    })}
  </div>;
}

function Control({ field, value, onChange, disabled, inputId, describedBy, invalid }) {
  const common = { id: inputId, disabled, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, 'aria-required': field.required || undefined };
  if (field.type === 'radio' || field.type === 'checkbox') return <Choices field={field} value={value} onChange={onChange} disabled={disabled} describedBy={describedBy} invalid={invalid} inputId={inputId} />;
  if (field.type === 'select') {
    return <select {...common} className={styles.input} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose…</option>
      {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  if (field.type === 'textarea') return <textarea {...common} className={styles.input} rows={3} maxLength={2000} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === 'phone') {
    return <span className={styles.affix} data-invalid={invalid || undefined}><span aria-hidden="true">+91</span>
      <input {...common} type="tel" inputMode="numeric" autoComplete={AUTOCOMPLETE[field.id] ?? 'tel-national'} maxLength={14} placeholder="98765 43210"
        value={value ?? ''} onChange={(event) => onChange(event.target.value.replace(/[^\d\s+-]/g, ''))} />
    </span>;
  }
  return <input {...common} className={styles.input} type={INPUT_TYPES[field.type] ?? 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined}
    autoComplete={AUTOCOMPLETE[field.id] ?? 'off'} autoCapitalize={field.id === 'fullName' ? 'words' : undefined} maxLength={field.type === 'date' ? undefined : 200}
    value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
}

export default function FormFields({ fields, values, errors = {}, onChange, disabled = false, idPrefix = 'gv-field' }) {
  return fields.map((field) => {
    const inputId = `${idPrefix}-${field.id}`;
    const error = errors[field.id];
    const describedBy = [field.help && `${inputId}-help`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
    const grouped = field.type === 'radio' || field.type === 'checkbox';
    const Label = grouped ? 'p' : 'label';
    return <div key={field.id} className={styles.field} data-invalid={error ? true : undefined}>
      <Label id={`${inputId}-label`} className={styles.label} {...(grouped ? {} : { htmlFor: inputId })}>
        {field.label}{field.required ? <span className={styles.required} aria-hidden="true">*</span> : <span className={styles.optional}>Optional</span>}
        {grouped && field.required && <span className="sr-only"> (required)</span>}
      </Label>
      <Control field={field} value={values[field.id]} onChange={(value) => onChange(field.id, value)} disabled={disabled} inputId={inputId} describedBy={describedBy} invalid={Boolean(error)} />
      {field.help && <p id={`${inputId}-help`} className={styles.hint}>{field.help}</p>}
      {error && <p id={`${inputId}-error`} className={styles.error}><Icon name="close" />{error}</p>}
    </div>;
  });
}

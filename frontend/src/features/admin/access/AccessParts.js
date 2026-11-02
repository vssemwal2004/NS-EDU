'use client';
// Small pieces shared by the Team & access tabs: risk marks, form fields, loading and error states.
import Icon from '@/components/ui/Icon';
import { RISK } from './access-model';
import styles from './Access.module.css';

export { default as ConfirmDialog } from '@/features/admin/crm/ConfirmDialog';

/** Risk as a small icon with a tooltip (not a loud pill). Low risk shows nothing. */
export function RiskMark({ risk }) {
  if (risk !== 'medium' && risk !== 'high') return null;
  const config = RISK[risk];
  return <span className={styles.risk} data-risk={risk} title={`${config.label} risk: ${config.words}`}>
    <Icon name={risk === 'high' ? 'alert' : 'shield'} /><span className="sr-only">{config.label} risk</span>
  </span>;
}

export function ErrorPanel({ error, onRetry, title = 'Could not load this section' }) {
  return <div className={`adm-panel ${styles.stateCard}`} role="alert">
    <span className={styles.stateIcon}><Icon name="alert" /></span>
    <strong>{title}</strong>
    <p>{error?.message || 'Something went wrong. Check your connection and try again.'}</p>
    {onRetry && <button type="button" className="adm-btn adm-btn--primary" onClick={onRetry}><Icon name="refresh" />Retry</button>}
  </div>;
}

/** A table-shaped placeholder: header bar plus rows of shimmering lines. */
export function TableSkeleton({ rows = 8, columns = 5, label = 'Loading' }) {
  return <div className={`adm-panel ${styles.tableSkeleton}`} role="status" aria-label={label}>
    <div className={styles.skHead} />
    {Array.from({ length: rows }, (_, row) => <div key={row} className={styles.skRow}>
      <span className={styles.skAvatar} />
      {Array.from({ length: columns }, (_, cell) => <span key={cell} style={{ width: `${[62, 40, 48, 30, 54][(row + cell) % 5]}%` }} />)}
    </div>)}
  </div>;
}

const STATUS = { active: { label: 'Active', tone: 'good' }, suspended: { label: 'Suspended', tone: 'bad' } };

/** Account status as a small dot + word (tables and drawers; no pill). */
export function StatusDot({ status }) {
  const config = STATUS[status] ?? STATUS.active;
  return <span className={`crm-tone ${styles.status}`} data-tone={config.tone}><i aria-hidden="true" />{config.label}</span>;
}

export function Field({ label, hint, error, htmlFor, required = false, children }) {
  return <div className={styles.field}>
    <label className="adm-label" htmlFor={htmlFor}>{label}{required && <span className={styles.required} aria-hidden="true"> *</span>}</label>
    {children}
    {hint && !error && <small className="adm-hint">{hint}</small>}
    {error && <small className="adm-error" role="alert">{error}</small>}
  </div>;
}

/** Two or three options as one pill row (List / Org chart, Own / Team / All). */
export function Segmented({ label, value, options, onChange, disabled = false }) {
  const enabled = options.filter((option) => !disabled && !option.disabled);
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || !enabled.length) return;
    event.preventDefault();
    const at = enabled.findIndex((option) => option.value === value);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.value);
    event.currentTarget.querySelector(`[data-value="${next.value}"]`)?.focus();
  };
  return <div className={styles.segmented} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} data-value={option.value}
      tabIndex={option.value === value ? 0 : -1} disabled={disabled || option.disabled} title={option.title} onClick={() => onChange(option.value)}>
      {option.icon && <Icon name={option.icon} />}{option.label}
    </button>)}
  </div>;
}

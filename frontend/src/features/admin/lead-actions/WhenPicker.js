'use client';
// "When?" control for follow-ups: quick presets plus a custom date and time.
//   const [when, setWhen] = useState(() => initialWhen({ allowNone: true }));
//   <WhenPicker value={when} onChange={setWhen} allowNone legend="Next follow-up" />   →   whenIso(when) is an ISO string or ''.
import { useId } from 'react';
import Icon from '@/components/ui/Icon';
import { followUpPresets, isoFromLocalInput, localInputValue } from '@/features/admin/crm/format';
import styles from './LeadActions.module.css';

export const initialWhen = ({ allowNone = false, choice } = {}) => ({
  choice: choice ?? (allowNone ? 'none' : 'tomorrow'),
  presets: followUpPresets().map((preset) => ({ ...preset, at: preset.date.toISOString() })),
  custom: localInputValue(),
});
export const whenIso = (when) => {
  if (when.choice === 'none') return '';
  if (when.choice === 'custom') return isoFromLocalInput(when.custom);
  return when.presets.find((preset) => preset.key === when.choice)?.at ?? '';
};
const pretty = (date) => date.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function WhenPicker({ value, onChange, allowNone = false, legend = 'When', error }) {
  const id = useId();
  const pick = (choice) => onChange({ ...value, choice });
  return <fieldset className={styles.field}>
    <legend className={styles.label}>{legend}</legend>
    <div className={styles.presets} role="radiogroup" aria-label={legend}>
      {allowNone && <button type="button" role="radio" aria-checked={value.choice === 'none'} className={styles.option} onClick={() => pick('none')}>
        <span>No follow-up</span><small>Decide later</small>
      </button>}
      {value.presets.map((preset) => <button key={preset.key} type="button" role="radio" aria-checked={value.choice === preset.key} className={styles.option} onClick={() => pick(preset.key)}>
        <span>{preset.label}</span><small>{pretty(preset.date)}</small>
      </button>)}
      <button type="button" role="radio" aria-checked={value.choice === 'custom'} className={styles.option} onClick={() => pick('custom')}>
        <span><Icon name="calendar" /> Pick a time</span><small>Any date and time</small>
      </button>
    </div>
    {value.choice === 'custom' && <label className={styles.field} htmlFor={`${id}-custom`}>
      <span className={styles.label}>Date and time</span>
      <input id={`${id}-custom`} type="datetime-local" className={styles.input} value={value.custom} aria-invalid={error ? 'true' : undefined}
        onChange={(event) => onChange({ ...value, custom: event.target.value })} />
    </label>}
    {error && <span className={styles.fieldError} role="alert">{error}</span>}
  </fieldset>;
}

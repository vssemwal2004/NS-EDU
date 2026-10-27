'use client';
import { useEffect, useId, useState } from 'react';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import styles from './Table.module.css';

// Multi-value filters travel as comma lists ("new,contacted").
export const splitList = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const joinList = (values) => values.join(',');

function Search({ value, onChange, label }) {
  return <input type="search" className={drawerStyles.input} value={value} placeholder={`Search ${label.toLowerCase()}…`} aria-label={`Search ${label}`}
    onChange={(event) => onChange(event.target.value)} />;
}
const matches = (option, term) => !term || `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(term.toLowerCase());

function Checks({ section, value, onChange }) {
  const [term, setTerm] = useState('');
  const chosen = splitList(value);
  const shown = section.options.filter((option) => matches(option, term) || chosen.includes(option.value));
  return <>
    {section.searchable && <Search value={term} onChange={setTerm} label={section.label} />}
    <div className={styles.checks} data-scroll={section.options.length > 10 || undefined}>
      {shown.map((option) => <label key={option.value}>
        <input type="checkbox" checked={chosen.includes(option.value)}
          onChange={(event) => onChange(joinList(event.target.checked ? [...chosen, option.value] : chosen.filter((item) => item !== option.value)))} />
        <span>{option.label}</span>
      </label>)}
      {!shown.length && <p className={drawerStyles.help}>No matches.</p>}
    </div>
  </>;
}

function Choice({ section, value, onChange, name }) {
  const [term, setTerm] = useState('');
  const shown = section.options.filter((option) => matches(option, term) || option.value === value);
  return <>
    {section.searchable && <Search value={term} onChange={setTerm} label={section.label} />}
    <div className={styles.checks} data-scroll={section.options.length > 8 || undefined} role="radiogroup" aria-label={section.label}>
      <label><input type="radio" name={name} checked={!value} onChange={() => onChange('')} /><span>{section.anyLabel ?? 'Any'}</span></label>
      {shown.map((option) => <label key={option.value}>
        <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span>{option.label}{option.hint && <small>{option.hint}</small>}</span>
      </label>)}
      {!shown.length && <p className={drawerStyles.help}>{section.options.length ? 'No matches.' : section.emptyText ?? 'Nothing to choose yet.'}</p>}
    </div>
  </>;
}

// Preset chips (server-resolved in IST) or a custom from/to; choosing one clears the other.
function DateRange({ section, draft, patch, id }) {
  const { range = 'range', from = 'from', to = 'to' } = section.keys ?? {};
  return <>
    <div className={styles.presetChips} role="group" aria-label={section.label}>
      <button type="button" aria-pressed={!draft[range] && !draft[from] && !draft[to]} onClick={() => patch({ [range]: '', [from]: '', [to]: '' })}>Any time</button>
      {section.options.map((option) => <button key={option.value} type="button" aria-pressed={draft[range] === option.value}
        onClick={() => patch({ [range]: option.value, [from]: '', [to]: '' })}>{option.label}</button>)}
    </div>
    <div className={styles.dateRow}>
      <label htmlFor={`${id}-from`}>From<input id={`${id}-from`} type="date" className={drawerStyles.input} value={draft[from] ?? ''} max={draft[to] || undefined}
        onChange={(event) => patch({ [from]: event.target.value, [range]: '' })} /></label>
      <label htmlFor={`${id}-to`}>To<input id={`${id}-to`} type="date" className={drawerStyles.input} value={draft[to] ?? ''} min={draft[from] || undefined}
        onChange={(event) => patch({ [to]: event.target.value, [range]: '' })} /></label>
    </div>
  </>;
}

function Section({ section, draft, patch, id }) {
  const value = draft[section.key] ?? '';
  const set = (next) => patch({ [section.key]: next });
  const control = `${id}-${section.key}`;
  let body;
  if (section.type === 'checks') body = <Checks section={section} value={value} onChange={set} />;
  else if (section.type === 'choice') body = <Choice section={section} value={value} onChange={set} name={control} />;
  else if (section.type === 'date') body = <DateRange section={section} draft={draft} patch={patch} id={control} />;
  else if (section.type === 'select') body = <select id={control} className={drawerStyles.input} value={value} onChange={(event) => set(event.target.value)}>
    <option value="">{section.anyLabel ?? 'Any'}</option>
    {section.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
  else if (section.type === 'text') body = <input id={control} className={drawerStyles.input} value={value} maxLength={section.maxLength ?? 80} placeholder={section.placeholder} onChange={(event) => set(event.target.value)} />;
  else body = section.render?.({ id: control, draft, patch });
  const labelled = ['select', 'text', 'custom'].includes(section.type ?? 'custom');
  const active = (section.keys ? Object.values(section.keys) : [section.key]).some((key) => draft[key]);
  return <fieldset className={styles.filterSection}>
    <legend>{labelled ? <label htmlFor={control}>{section.label}</label> : section.label}{active && <><span className={styles.dot} aria-hidden="true" /><span className="sr-only"> (set)</span></>}</legend>
    {section.help && <p className={drawerStyles.help}>{section.help}</p>}
    {body}
  </fieldset>;
}

function Body({ sections, value, emptyValue, onApply, countFor, noun }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [count, setCount] = useState({ draft: null, total: undefined });
  const patch = (next) => setDraft((current) => ({ ...current, ...next }));

  // Live "Show N" count for the draft, debounced so ticking several boxes sends one request.
  useEffect(() => {
    if (!countFor) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      countFor(draft, controller.signal).then((total) => setCount({ draft, total })).catch((failure) => {
        if (failure?.name !== 'AbortError') setCount({ draft, total: null });
      });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [countFor, draft]);

  const counted = count.draft === draft;
  const label = !countFor ? 'Apply filters' : !counted ? 'Counting…' : typeof count.total === 'number'
    ? `Show ${count.total.toLocaleString('en-IN')} ${count.total === 1 ? noun.one : noun.many}` : `Show ${noun.many}`;
  return <form className={styles.filterForm} onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
    {sections.map((section) => <Section key={section.key} section={section} draft={draft} patch={patch} id={id} />)}
    <div className={`${drawerStyles.formActions} ${styles.actions}`}>
      <button type="button" className="button button--ghost" onClick={() => setDraft({ ...draft, ...emptyValue })}>Reset</button>
      <button type="submit" className="button button--primary" aria-live="polite">{label}</button>
    </div>
  </form>;
}

/**
 * Side drawer of filter sections, edited as a draft and applied in one go.
 * Section types: checks (multi, comma list), choice (single, radio list, optional search), select, text,
 * date (preset chips + custom from/to; `keys: {range, from, to}`), custom (`render({id, draft, patch})`).
 * Options are [{ value, label, hint? }]. `countFor(draft, signal)` → Promise<number|null> for the live count.
 */
export default function FilterDrawer({ open, onClose, title = 'Filters', subtitle, sections, value, emptyValue, onApply, countFor, noun = { one: 'result', many: 'results' } }) {
  return <AdminDrawer open={open} onClose={onClose} title={title} subtitle={subtitle}>
    {open && <Body sections={sections} value={value} emptyValue={emptyValue} onApply={onApply} countFor={countFor} noun={noun} />}
  </AdminDrawer>;
}

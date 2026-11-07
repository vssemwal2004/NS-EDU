'use client';
// A form generated from a site_content JSON value: text → input/textarea, numbers, yes/no switches,
// grouped objects and editable lists. Property names are structural (code reads them), so they can
// only be added or renamed in the JSON tab; list items can be added, removed and reordered here.
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { resizedImage } from '@/lib/image-url';
import { blankLike, humanize, itemTitle, kindOf } from './content-format';
import styles from './Content.module.css';

const idOf = (path) => `cf-${path.join('-').replace(/[^\w-]/g, '_')}`;
// Links, ids and other single tokens stay one-line inputs; prose gets a textarea.
const isLong = (text, key) => !/\s/.test(text.trim()) ? false : text.length > 72 || text.includes('\n') || /description|text|body|intro|answer|summary|note/i.test(String(key));
const isImage = (value) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.src === 'string';
const imagePreview = (src) => resizedImage(src, 320);

function errorFor(errors, path) {
  const key = path.join('.');
  return errors?.[key];
}

function Primitive({ value, path, label, onChange, errors, hideLabel = false }) {
  const id = idOf(path);
  const kind = kindOf(value);
  const error = errorFor(errors, path);
  const described = error ? `${id}-error` : undefined;
  if (kind === 'boolean') {
    return <label className={styles.switch} htmlFor={id} data-short>
      <input id={id} type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" /><span className={styles.switchText}>{label}</span>
    </label>;
  }
  const control = kind === 'number'
    ? <input id={id} className={`adm-input ${styles.short}`} type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} aria-invalid={Boolean(error) || undefined} aria-describedby={described}
      onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />
    : kind === 'null'
      ? <input id={id} className="adm-input" value="" placeholder="Not set" aria-describedby={described} onChange={(event) => onChange(event.target.value)} />
      : isLong(value, path.at(-1))
        ? <textarea id={id} className="adm-textarea" value={value} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 70)))} aria-invalid={Boolean(error) || undefined} aria-describedby={described} onChange={(event) => onChange(event.target.value)} />
        : <input id={id} className="adm-input" value={value} aria-invalid={Boolean(error) || undefined} aria-describedby={described} onChange={(event) => onChange(event.target.value)} />;
  const short = !hideLabel && (kind === 'number' || (kind === 'string' && !isLong(value, path.at(-1))));
  return <div className={styles.field} data-short={short || undefined}>
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'adm-label'}>{label}</label>
    {control}
    {error && <span id={described} className="adm-error">{error}</span>}
  </div>;
}

// Many sibling groups (e.g. the 12 supporting pages) start folded so a section stays scannable.
function FoldedGroup({ value, path, label, onChange, errors }) {
  const [open, setOpen] = useState(false);
  const prefix = path.join('.');
  const hasError = Object.keys(errors ?? {}).some((key) => key === prefix || key.startsWith(`${prefix}.`));
  const bodyId = `${idOf(path)}-body`;
  const title = itemTitle(value, 0);
  return <div className={styles.listItem} data-open={open || undefined}>
    <div className={styles.itemHead}>
      <button type="button" className={styles.itemToggle} aria-expanded={open || hasError} aria-controls={bodyId} onClick={() => setOpen((current) => !current)}>
        <Icon name="chevron" className={styles.chevron} /><span className={styles.itemTitle} title={label}>{label}</span>
        <small className={styles.itemMeta}>{hasError ? 'Has an error' : title !== 'Item 1' && title !== label ? title : `${Object.keys(value).length} fields`}</small>
      </button>
    </div>
    {(open || hasError) && <div id={bodyId} className={styles.itemBody}><ValueEditor value={value} path={path} label={label} bare errors={errors} onChange={onChange} /></div>}
  </div>;
}

function ObjectFields({ value, path, onChange, errors }) {
  const fold = Object.values(value).filter((child) => kindOf(child) === 'object').length > 3;
  return <div className={styles.fields}>
    {Object.entries(value).map(([key, child]) => (fold && kindOf(child) === 'object'
      ? <FoldedGroup key={key} value={child} path={[...path, key]} label={humanize(key)} errors={errors} onChange={(next) => onChange({ ...value, [key]: next })} />
      : <ValueEditor key={key} value={child} path={[...path, key]} label={humanize(key)} errors={errors} onChange={(next) => onChange({ ...value, [key]: next })} />))}
    {!Object.keys(value).length && <p className="adm-hint">No fields. Add properties in the JSON tab.</p>}
  </div>;
}

function ListEditor({ value, path, label, onChange, errors, bare = false }) {
  const [open, setOpen] = useState(() => new Set());
  const objects = value.some((item) => kindOf(item) === 'object' || kindOf(item) === 'array');
  const error = errorFor(errors, path);
  const move = (index, delta) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  const remove = (index) => onChange(value.filter((_, at) => at !== index));
  const add = () => {
    const template = value.length ? blankLike(value.at(-1)) : '';
    onChange([...value, template]);
    if (objects) setOpen((current) => new Set(current).add(value.length));
  };
  const toggle = (index) => setOpen((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const controls = (index, title) => <span className={styles.itemControls}>
    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-btn--icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${title} up`} title="Move up"><Icon name="arrowUp" /></button>
    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-btn--icon" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${title} down`} title="Move down"><Icon name="arrowUp" className={styles.down} /></button>
    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-btn--icon" data-tone="danger" onClick={() => remove(index)} aria-label={`Remove ${title}`} title="Remove"><Icon name="trash" /></button>
  </span>;

  const Frame = bare ? 'div' : 'fieldset';
  return <Frame className={bare ? styles.bareList : styles.group} data-error={error ? true : undefined}>
    {!bare && <legend>{label}<small className="crm-tabnum">{value.length} {value.length === 1 ? 'item' : 'items'}</small></legend>}
    {error && <p className="adm-error">{error}</p>}
    <ol className={styles.list}>
      {value.map((item, index) => {
        const title = itemTitle(item, index);
        if (!objects) {
          return <li key={index} className={styles.listRow}>
            <span className={`${styles.index} crm-tabnum`}>{index + 1}</span>
            <div className={styles.grow}><Primitive value={item} path={[...path, index]} label={`${label} ${index + 1}`} hideLabel errors={errors} onChange={(next) => onChange(value.map((entry, at) => (at === index ? next : entry)))} /></div>
            {controls(index, `item ${index + 1}`)}
          </li>;
        }
        const expanded = open.has(index);
        return <li key={index} className={styles.listItem} data-open={expanded || undefined}>
          <div className={styles.itemHead}>
            <button type="button" className={styles.itemToggle} aria-expanded={expanded} aria-controls={`${idOf([...path, index])}-body`} onClick={() => toggle(index)}>
              <Icon name="chevron" className={styles.chevron} /><span className={`${styles.index} crm-tabnum`}>{index + 1}</span>
              <span className={styles.itemTitle} title={title}>{title}</span>
            </button>
            {controls(index, title)}
          </div>
          {expanded && <div id={`${idOf([...path, index])}-body`} className={styles.itemBody}>
            <ValueEditor value={item} path={[...path, index]} label={title} bare errors={errors} onChange={(next) => onChange(value.map((entry, at) => (at === index ? next : entry)))} />
          </div>}
        </li>;
      })}
    </ol>
    {!value.length && <p className="adm-hint">The list is empty.</p>}
    <button type="button" className={`adm-btn adm-btn--sm ${styles.addButton}`} onClick={add}><Icon name="plus" />Add {objects ? 'item' : 'entry'}</button>
  </Frame>;
}

/** One value of any kind. `bare` skips the group frame (used inside list items and for a whole section). */
export function ValueEditor({ value, path, label, onChange, errors, bare = false }) {
  const kind = kindOf(value);
  if (kind === 'array') return <ListEditor value={value} path={path} label={label} onChange={onChange} errors={errors} bare={bare} />;
  if (kind !== 'object') return <Primitive value={value} path={path} label={label} onChange={onChange} errors={errors} />;
  const error = errorFor(errors, path);
  const preview = isImage(value) && value.src;
  const body = <>
    {error && <p className="adm-error">{error}</p>}
    {preview && <div className={styles.imagePreview}>
      {/* Admin preview of any URL: a plain img avoids the optimiser's host allow-list. */}
      <img src={imagePreview(value.src)} alt={value.alt || ''} loading="lazy" />
      <small className="crm-tabnum">{value.width ?? '?'} × {value.height ?? '?'} px</small>
    </div>}
    <ObjectFields value={value} path={path} onChange={onChange} errors={errors} />
  </>;
  if (bare) return body;
  return <fieldset className={styles.group} data-error={error ? true : undefined}><legend>{label}</legend>{body}</fieldset>;
}

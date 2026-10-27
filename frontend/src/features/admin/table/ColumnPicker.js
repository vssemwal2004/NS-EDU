'use client';
import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import AdminDrawer from '@/features/admin/AdminDrawer';
import drawerStyles from '@/features/admin/ResourceManager.module.css';
import styles from './Table.module.css';

function groupsOf(columns) {
  const groups = new Map();
  for (const column of columns) groups.set(column.group || 'Other', [...(groups.get(column.group || 'Other') ?? []), column]);
  return [...groups];
}

function Body({ columns, value, defaults, onApply }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [term, setTerm] = useState('');
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const shown = draft.filter((key) => byKey.has(key));
  const toggle = (key, on) => setDraft((current) => (on ? [...current.filter((item) => item !== key), key] : current.filter((item) => item !== key)));
  const move = (index, step) => {
    const next = [...shown];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setDraft(next);
  };
  const search = term.trim().toLowerCase();
  const groups = groupsOf(columns.filter((column) => !search || `${column.label} ${column.group}`.toLowerCase().includes(search)));

  return <form className={styles.filterForm} onSubmit={(event) => { event.preventDefault(); if (shown.length) onApply(shown); }}>
    <fieldset className={styles.filterSection}>
      <legend>Shown, in this order <span className={styles.legendCount}>{shown.length}</span></legend>
      {shown.length ? <ol className={styles.orderList}>
        {shown.map((key, index) => <li key={key}>
          <span><strong>{byKey.get(key).label}</strong><small>{byKey.get(key).group}</small></span>
          <button type="button" className={drawerStyles.iconButton} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${byKey.get(key).label} up`}><Icon name="arrowUp" /></button>
          <button type="button" className={drawerStyles.iconButton} disabled={index === shown.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${byKey.get(key).label} down`}><Icon name="arrowUp" className={styles.flipY} /></button>
          <button type="button" className={drawerStyles.iconButton} disabled={shown.length === 1} onClick={() => toggle(key, false)} aria-label={`Hide ${byKey.get(key).label}`}><Icon name="close" /></button>
        </li>)}
      </ol> : <p className={drawerStyles.fieldError} role="alert">Choose at least one column.</p>}
    </fieldset>
    <fieldset className={styles.filterSection}>
      <legend><label htmlFor={`${id}-search`}>All columns</label></legend>
      <input id={`${id}-search`} type="search" className={drawerStyles.input} value={term} placeholder="Search columns…" onChange={(event) => setTerm(event.target.value)} />
      {groups.map(([group, items]) => <div key={group} className={styles.columnGroup} role="group" aria-label={group}>
        <h3>{group}</h3>
        <div className={styles.checks}>
          {items.map((column) => <label key={column.key}>
            <input type="checkbox" checked={shown.includes(column.key)} disabled={shown.length === 1 && shown.includes(column.key)} onChange={(event) => toggle(column.key, event.target.checked)} />
            <span>{column.label}</span>
          </label>)}
        </div>
      </div>)}
      {!groups.length && <p className={drawerStyles.help}>No column matches “{term}”.</p>}
    </fieldset>
    <div className={`${drawerStyles.formActions} ${styles.actions}`}>
      <button type="button" className="button button--ghost" onClick={() => setDraft(defaults)}>Reset to default</button>
      <button type="submit" className="button button--primary" disabled={!shown.length}>Apply columns</button>
    </div>
  </form>;
}

/** Choose and order table columns. `columns` = [{ key, label, group }]; onApply(keys) receives the ordered keys. */
export default function ColumnPicker({ open, onClose, columns, value, defaults, onApply }) {
  return <AdminDrawer open={open} onClose={onClose} title="Columns" subtitle="Pick what the table shows. Your choice is saved on this device.">
    {open && <Body columns={columns} value={value} defaults={defaults} onApply={onApply} />}
  </AdminDrawer>;
}

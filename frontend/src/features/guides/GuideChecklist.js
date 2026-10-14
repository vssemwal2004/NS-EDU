'use client';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Guides.module.css';

// Interactive checklist. Ticks persist per guide in localStorage ('nsedu:guide-checklist:<guide>'
// = [itemId, ...]); the server snapshot is empty so hydration never mismatches.
const PREFIX = 'nsedu:guide-checklist:';
const listeners = new Set();
const read = (key) => { try { return window.localStorage.getItem(key) || ''; } catch { return ''; } };
function subscribe(callback) {
  listeners.add(callback);
  const onStorage = (event) => { if (!event.key || event.key.startsWith(PREFIX)) callback(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
}
function write(key, ids) {
  try { window.localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  listeners.forEach((callback) => callback());
}

export default function GuideChecklist({ guide, title, intro, items, note }) {
  const key = PREFIX + guide;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '');
  const done = useMemo(() => {
    try { const list = JSON.parse(raw || '[]'); return new Set(Array.isArray(list) ? list.filter((id) => items.some((item) => item.id === id)) : []); } catch { return new Set(); }
  }, [raw, items]);
  const listRef = useRef(null);
  const count = done.size;
  const total = items.length;

  const toggle = (id) => write(key, items.map((item) => item.id).filter((itemId) => (itemId === id ? !done.has(id) : done.has(itemId))));
  const clear = () => { write(key, []); listRef.current?.querySelector('input')?.focus(); };

  return <section id="checklist" className={styles.checklist} aria-labelledby="checklist-title">
    <header className={styles.checklistHead}>
      <p className={styles.checklistEyebrow}><Icon name="guidesChecklist" />Your checklist</p>
      <h2 id="checklist-title">{title}</h2>
      {intro && <p>{intro}</p>}
      <div className={styles.progress} aria-hidden="true"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
      <p className={styles.progressText} role="status" aria-live="polite"><strong>{count} of {total}</strong> {count === total ? '— all done' : 'ready'}</p>
    </header>
    <ul ref={listRef} className={styles.checkItems}>
      {items.map((item) => <li key={item.id}>
        <label data-checked={done.has(item.id) || undefined}>
          <input type="checkbox" checked={done.has(item.id)} onChange={() => toggle(item.id)} />
          <span className={styles.checkBox} aria-hidden="true"><Icon name="check" /></span>
          <span className={styles.checkText}><span>{item.label}</span>{item.hint && <small>{item.hint}</small>}</span>
        </label>
      </li>)}
    </ul>
    <footer className={styles.checklistFoot}>
      <button type="button" className="button button--ghost" onClick={clear} disabled={count === 0}><Icon name="guidesReset" />Clear ticks</button>
      {note && <p>{note}</p>}
    </footer>
  </section>;
}

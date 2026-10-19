'use client';
import { useMemo, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import { useTicks } from './ticks';
import styles from './Checklist.module.css';

// A guide's saved checklist (scholarships: on oxblood; career guidance: on paper). Ticks stay on this device.
export default function Checklist({ guide, title, intro, items, note, eyebrow, icon = 'guidesChecklist', variant = 'paper', headingLevel = 2 }) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const listRef = useRef(null);
  const { done, toggle, clear, count, total } = useTicks(guide, ids);
  const Heading = `h${headingLevel}`;
  const percent = total ? Math.round((count / total) * 100) : 0;

  return <div className={`${styles.checklist} ${styles[variant]}`}>
    <header className={styles.head}>
      {eyebrow && <p className="lux-eyebrow"><Icon name={icon} />{eyebrow}</p>}
      <Heading id="checklist-title" className={styles.title}>{title}</Heading>
      {intro && <p className={styles.intro}>{intro}</p>}
      <div className={styles.meter}>
        <span className={styles.track} aria-hidden="true"><span style={{ transform: `scaleX(${percent / 100})` }} /></span>
        <p role="status" aria-live="polite"><strong>{count} of {total}</strong> {count === total && total > 0 ? 'done' : 'ticked'}</p>
      </div>
    </header>
    <ul ref={listRef} className={styles.items} aria-labelledby="checklist-title">
      {items.map((item) => <li key={item.id}>
        <label data-checked={done.has(item.id) || undefined}>
          <input type="checkbox" checked={done.has(item.id)} onChange={() => toggle(item.id)} />
          <span className={styles.box} aria-hidden="true"><Icon name="check" /></span>
          <span className={styles.text}><span>{item.label}</span>{item.hint && <small>{item.hint}</small>}</span>
        </label>
      </li>)}
    </ul>
    <footer className={styles.foot}>
      <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => { clear(); listRef.current?.querySelector('input')?.focus(); }} disabled={count === 0}><Icon name="guideReset" />Clear ticks</button>
      {note && <p>{note}</p>}
    </footer>
  </div>;
}

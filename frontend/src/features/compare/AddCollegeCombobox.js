'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { filterCollegeRecords, formatTuition } from '@/lib/college-catalog';
import styles from './Compare.module.css';

// ARIA 1.2 combobox with a listbox popup, scoped to the programmes of one course.
export default function AddCollegeCombobox({ id, label, courseName, options, onSelect, inputRef, align = 'start' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);
  const matches = useMemo(() => filterCollegeRecords(options, { query }), [options, query]);
  const listId = `${id}-list`;
  const current = active < matches.length ? active : -1;
  const expanded = open && matches.length > 0;

  useEffect(() => {
    if (current >= 0) listRef.current?.children[current]?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function show(index) { setOpen(true); setActive(index); }
  function choose(row) { setQuery(''); setOpen(false); setActive(-1); onSelect(row); }
  function onKeyDown(event) {
    const last = matches.length - 1;
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!expanded) show(0); else setActive(current >= last ? 0 : current + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (!expanded) show(last); else setActive(current <= 0 ? last : current - 1); }
    else if ((event.key === 'Home' || event.key === 'End') && expanded) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : last); }
    else if (event.key === 'Enter' && expanded && current >= 0) { event.preventDefault(); choose(matches[current]); }
    else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); setOpen(false); setActive(-1); }
      else if (query) { event.preventDefault(); setQuery(''); }
    }
  }

  return <div className={styles.combo} data-align={align}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <div className={styles.comboField}>
      <Icon name="search" />
      <input ref={inputRef} id={id} className="field" type="text" role="combobox" autoComplete="off" spellCheck="false"
        placeholder={`Search ${courseName} colleges`} value={query}
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
        aria-activedescendant={expanded && current >= 0 ? `${id}-${matches[current].id}` : undefined}
        onChange={(event) => { setQuery(event.target.value); show(event.target.value.trim() ? 0 : -1); }}
        onClick={() => setOpen(true)} onKeyDown={onKeyDown} onBlur={() => { setOpen(false); setActive(-1); }} />
      <Icon name="chevron" className={styles.comboChevron} />
    </div>
    <ul ref={listRef} id={listId} role="listbox" aria-label={`${courseName} colleges`} className={styles.listbox} hidden={!expanded}>
      {matches.map((row, index) => <li key={row.id} id={`${id}-${row.id}`} role="option" aria-selected={index === current}
        onMouseDown={(event) => event.preventDefault()} onMouseMove={() => index !== current && setActive(index)} onClick={() => choose(row)}>
        <span aria-hidden="true"><CollegeArtwork row={row} className={styles.optionThumb} /></span>
        <span className={styles.optionText}><strong>{row.name}</strong><small>{row.city} · {formatTuition(row.annualTuitionInr)}/yr</small></span>
        <span className={styles.optionRating}>{row.demoRating.toFixed(1)}<small>demo</small></span>
      </li>)}
    </ul>
    {open && !matches.length && <p className={styles.comboEmpty} role="status">No {courseName} colleges match “{query.trim()}”</p>}
  </div>;
}

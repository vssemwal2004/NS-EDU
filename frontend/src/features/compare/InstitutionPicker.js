'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { monogram, placeOf } from '@/features/universities/labels';
import styles from './InstitutionCompare.module.css';

// ARIA 1.2 combobox over /api/universities/suggest (9,000+ records, so the server does the matching).
// Debounced, aborts the previous request, and never guesses: with no match it says so.
export default function InstitutionPicker({ label, placeholder = 'Search any university or college', exclude = [], onSelect, inputRef, dark = true }) {
  const id = useId().replaceAll(':', '');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ items: [], status: 'idle', query: '' });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);

  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api(`/universities/suggest?q=${encodeURIComponent(term)}&limit=12`, { signal: controller.signal }).then(
        (data) => setResult({ items: data?.items ?? [], status: 'done', query: term }),
        (error) => { if (error?.name !== 'AbortError') setResult({ items: [], status: 'failed', query: term }); },
      );
    }, 220);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [term]);

  // The stored result is only shown while it still answers what is typed; anything else is "searching".
  const settled = term.length >= 2 && result.query === term;
  const status = term.length < 2 ? 'short' : settled ? result.status : 'loading';
  const matches = settled && result.status === 'done' ? result.items.filter((item) => !exclude.includes(item.id)) : [];
  const expanded = open && matches.length > 0;
  const current = active < matches.length ? active : -1;
  const listId = `${id}-list`;

  useEffect(() => { if (current >= 0) listRef.current?.children[current]?.scrollIntoView({ block: 'nearest' }); }, [current]);

  function choose(item) { setQuery(''); setResult({ items: [], status: 'idle', query: '' }); setOpen(false); setActive(-1); onSelect(item); }
  function onKeyDown(event) {
    const last = matches.length - 1;
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!expanded) { setOpen(true); setActive(0); } else setActive(current >= last ? 0 : current + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (!expanded) { setOpen(true); setActive(last); } else setActive(current <= 0 ? last : current - 1); }
    else if ((event.key === 'Home' || event.key === 'End') && expanded) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : last); }
    else if (event.key === 'Enter' && expanded && current >= 0) { event.preventDefault(); choose(matches[current]); }
    else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); setOpen(false); setActive(-1); }
      else if (query) { event.preventDefault(); setQuery(''); }
    }
  }

  return <div className={styles.combo} data-dark={dark || undefined}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <div className={styles.comboField}>
      <Icon name="search" />
      <input ref={inputRef} id={id} className="lux-field" type="text" role="combobox" autoComplete="off" spellCheck="false"
        placeholder={placeholder} value={query}
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
        aria-activedescendant={expanded && current >= 0 ? `${id}-${matches[current].id}` : undefined}
        aria-describedby={`${id}-status`}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onClick={() => setOpen(true)} onKeyDown={onKeyDown}
        onBlur={() => { setOpen(false); setActive(-1); }} />
      {status === 'loading' && <span className={styles.comboSpinner} aria-hidden="true" />}
    </div>
    <ul ref={listRef} id={listId} role="listbox" aria-label="Matching institutions" className={styles.listbox} hidden={!expanded}>
      {matches.map((item, index) => <li key={item.id} id={`${id}-${item.id}`} role="option" aria-selected={index === current}
        onMouseDown={(event) => event.preventDefault()} onMouseMove={() => index !== current && setActive(index)} onClick={() => choose(item)}>
        <span className={styles.optionMark} aria-hidden="true">{item.logoUrl ? <img src={item.logoUrl} alt="" width={36} height={36} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : monogram(item.name)}</span>
        <span className={styles.optionText}><strong>{item.name}</strong><small>{placeOf(item) || 'Location not listed'}</small></span>
      </li>)}
    </ul>
    <p id={`${id}-status`} className={styles.comboHint} role="status">
      {term.length > 0 && status === 'short' ? 'Keep typing to search'
        : status === 'failed' ? 'Search is unavailable right now. Try again in a moment.'
          : status !== 'done' ? ''
            : matches.length ? `${matches.length} match${matches.length === 1 ? '' : 'es'}`
              : `No institution matches “${term}”`}
    </p>
  </div>;
}

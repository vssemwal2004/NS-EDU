'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import styles from './UniversityCombobox.module.css';

const place = (item) => [item.city, item.state].filter(Boolean).join(', ');

// ARIA 1.2 combobox over GET /universities/suggest (debounced, abortable).
// Typing after a choice clears it, so the parent always holds either a picked university or null.
export default function UniversityCombobox({ id, value, onSelect, placeholder = 'Search by university or college name', invalid = false, describedBy, inputRef, size = 'large', label, autoFocus = false }) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [synced, setSynced] = useState(value?.id ?? null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState({ q: '', items: [] });
  const [status, setStatus] = useState('idle');
  const listRef = useRef(null);
  const listId = `${id}-list`;
  const q = query.trim();

  // A university chosen elsewhere (URL, restored draft) replaces the text.
  if (value && value.id !== synced) { setSynced(value.id); setQuery(value.name); }
  if (!value && synced) setSynced(null);

  const searching = open && q.length >= 2 && !(value && value.name === query);
  useEffect(() => {
    if (!searching) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus('loading');
      api(`/universities/suggest?q=${encodeURIComponent(q)}&limit=8`, { signal: controller.signal })
        .then((data) => { setResults({ q, items: data.items ?? [] }); setStatus('idle'); setActive(-1); })
        .catch((error) => { if (error.name !== 'AbortError') setStatus('error'); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [q, searching]);

  const items = searching ? results.items : [];
  const expanded = searching && items.length > 0;
  const current = active < items.length ? active : -1;
  useEffect(() => {
    if (current >= 0) listRef.current?.children[current]?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function choose(item) {
    setQuery(item.name); setSynced(item.id); setOpen(false); setActive(-1);
    onSelect({ id: item.id, name: item.name, city: item.city || '', state: item.state || '', logoUrl: item.logoUrl || '' });
  }
  function change(next) {
    setQuery(next); setOpen(true); setActive(-1);
    if (value) onSelect(null);
  }
  function onKeyDown(event) {
    const last = items.length - 1;
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); if (expanded) setActive(current >= last ? 0 : current + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (expanded) setActive(current <= 0 ? last : current - 1); }
    else if ((event.key === 'Home' || event.key === 'End') && expanded && current >= 0) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : last); }
    else if (event.key === 'Enter' && expanded) { event.preventDefault(); if (current >= 0) choose(items[current]); else if (items.length === 1) choose(items[0]); }
    else if (event.key === 'Escape') {
      if (expanded) { event.preventDefault(); setOpen(false); setActive(-1); }
      else if (query) { event.preventDefault(); change(''); }
    }
  }

  const message = !searching ? '' : status === 'error' ? 'Search is unavailable right now. Try again in a moment.'
    : status === 'loading' && results.q !== q ? 'Searching…'
      : results.q === q && !items.length ? `No universities match “${q}”. Check the spelling or try the short name.` : '';
  return <div className={styles.combo} data-size={size}>
    <div className={styles.field} data-invalid={invalid || undefined} data-selected={Boolean(value) || undefined}>
      <Icon name={value ? 'building' : 'search'} />
      <input ref={inputRef} id={id} type="text" role="combobox" autoComplete="off" spellCheck="false" maxLength={120}
        placeholder={placeholder} value={query} aria-label={label} autoFocus={autoFocus}
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={expanded && current >= 0 ? `${id}-option-${current}` : undefined}
        onChange={(event) => change(event.target.value)} onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown} onBlur={() => { setOpen(false); setActive(-1); }} />
      {value && <span className={styles.picked}><Icon name="check" /><span className="sr-only">Selected</span></span>}
      {query && <button type="button" className={styles.clear} aria-label="Clear university" onMouseDown={(event) => event.preventDefault()} onClick={() => change('')}><Icon name="close" /></button>}
    </div>
    <ul ref={listRef} id={listId} role="listbox" aria-label="Matching universities" className={styles.listbox} hidden={!expanded}>
      {items.map((item, index) => <li key={item.id} id={`${id}-option-${index}`} role="option" aria-selected={index === current}
        onMouseDown={(event) => event.preventDefault()} onMouseMove={() => index !== current && setActive(index)} onClick={() => choose(item)}>
        <span className={styles.optionIcon} aria-hidden="true"><Icon name="building" /></span>
        <span className={styles.optionText}><strong>{item.name}</strong>{place(item) && <small>{place(item)}</small>}</span>
      </li>)}
    </ul>
    {message && <p className={styles.status} aria-hidden="true">{status === 'loading' && <span className={styles.spinner} />}{message}</p>}
    <p className="sr-only" role="status">{message || (expanded ? `${items.length} ${items.length === 1 ? 'university' : 'universities'} found. Use the arrow keys to choose.` : '')}</p>
  </div>;
}

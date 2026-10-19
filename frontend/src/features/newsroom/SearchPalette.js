'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import styles from './Search.module.css';

const ITEM = '[data-palette-item]';
const searchHref = (value, tab) => `/search?${new URLSearchParams({ ...(value ? { q: value } : {}), ...(tab !== 'all' && value ? { tab } : {}) })}`;

// Command-palette shell: big query field that refreshes server results as you type (debounced),
// ↑/↓ to move between result rows, "/" to jump back to the field. Results arrive as server-rendered children.
export default function SearchPalette({ query, tab, children }) {
  const router = useRouter();
  const input = useRef(null);
  const list = useRef(null);
  const [value, setValue] = useState(query);
  const [synced, setSynced] = useState(query);
  const [pushed, setPushed] = useState(query);
  const [pending, startTransition] = useTransition();
  // Follow outside navigation (a suggestion link, back button) without clobbering what is being typed.
  if (query !== synced) { setSynced(query); if (query !== pushed && query !== value.trim()) setValue(query); }

  useEffect(() => {
    const trimmed = value.trim().slice(0, 120);
    if (trimmed === query) return undefined;
    const timer = window.setTimeout(() => { setPushed(trimmed); startTransition(() => router.replace(searchHref(trimmed, tab), { scroll: false })); }, 380);
    return () => window.clearTimeout(timer);
  }, [value, query, tab, router]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function move(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...(list.current?.querySelectorAll(ITEM) || [])];
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowUp' && index <= 0) { input.current?.focus(); return; }
    items[event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : index - 1].focus();
  }

  function submit(event) {
    event.preventDefault();
    const trimmed = value.trim().slice(0, 120);
    setPushed(trimmed);
    startTransition(() => router.push(searchHref(trimmed, tab), { scroll: false }));
  }

  return <div className={styles.palette} data-pending={pending || undefined} onKeyDown={move}>
    <form className={styles.form} action="/search" role="search" data-page-search onSubmit={submit}>
      <label className={styles.field}>
        <Icon name="search" />
        <span className="sr-only">Search universities, courses and exams</span>
        <input ref={input} type="search" name="q" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search universities, courses, exams or cities"
          maxLength={120} enterKeyHint="search" autoComplete="off" spellCheck={false} autoFocus={!query} aria-describedby="palette-help" />
        {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
        {value && <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { setValue(''); input.current?.focus(); }}><Icon name="close" /></button>}
      </label>
      <button className={`lux-button lux-button--primary ${styles.go}`} type="submit"><span className={styles.goLabel}>Search</span><Icon name="arrow" /></button>
    </form>
    <span className={styles.progress} aria-hidden="true" />
    <div ref={list} className={styles.results} aria-busy={pending || undefined}>{children}</div>
    <p id="palette-help" className={styles.help}><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>/</kbd> search again</span></p>
  </div>;
}
